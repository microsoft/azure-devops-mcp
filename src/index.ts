#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Allow self-signed certificates for on-premise TFS/Azure DevOps Server
// Only disable SSL verification if explicitly requested via environment variable
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined &&
    process.env.AZURE_DEVOPS_IGNORE_SSL_ERRORS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name or full URL for on-premise installations",
      type: "string",
      demandOption: true,
    });
  })
  .option("url", {
    alias: "u",
    describe: "Full organization URL for on-premise TFS/Azure DevOps Server (e.g., 'https://tfs.company.com/DefaultCollection'). If not provided, uses cloud URL.",
    type: "string",
  })
  .option("domains", {
    alias: "d",
    describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use. Supported values are 'interactive', 'azcli' and 'env' (default: 'interactive')",
    type: "string",
    choices: ["interactive", "azcli", "env"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .help()
  .parseSync();

// Determine organization URL based on input
// Priority: --url option > auto-detect URL in organization param > construct cloud URL
let orgUrl: string;
let orgName: string;

if (argv.url) {
  // Explicit URL provided via --url option
  orgUrl = argv.url as string;
  // Extract org name from URL for display purposes
  const urlParts = orgUrl.replace(/\/$/, '').split('/');
  orgName = urlParts[urlParts.length - 1];
} else if ((argv.organization as string).includes('://')) {
  // Full URL provided in organization parameter (auto-detect)
  orgUrl = argv.organization as string;
  // Extract org name from URL
  const urlParts = orgUrl.replace(/\/$/, '').split('/');
  orgName = urlParts[urlParts.length - 1];
} else {
  // Organization name only - use cloud URL (backward compatible)
  orgName = argv.organization as string;
  orgUrl = "https://dev.azure.com/" + orgName;
}

export { orgName };

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();

    // Use PAT handler for on-premise or when PAT token is detected
    // Otherwise use Bearer token for cloud OAuth scenarios
    const isPAT = process.env.AZURE_DEVOPS_EXT_PAT || process.env.AZURE_DEVOPS_PAT;
    const authHandler = isPAT
      ? getPersonalAccessTokenHandler(accessToken)
      : getBearerHandler(accessToken);

    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };
  const tenantId = (await getOrgTenant(orgName)) ?? argv.tenant;
  const authenticator = createAuthenticator(argv.authentication, tenantId);

  // removing prompts untill further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
