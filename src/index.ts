#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator, getAuthorizationHeader } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";
import { setApiVersions } from "./utils.js";
import { setConfig } from "./config.js";
import { ar } from "zod/v4/locales";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
      demandOption: true,
    });
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
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar", "pat"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("url", {
    alias: "u",
    describe: "Custom Azure DevOps base URL (e.g. https://tfs.contoso.com/tfs/DefaultCollection)",
    type: "string",
  })
  .option("api-version", {
    alias: "v",
    describe: "Azure DevOps REST API version (defaults to 7.2-preview.1)",
    type: "string",
  })
  .help()
  .parseSync();

const name = argv.organization as string;
const url = (argv.url as string) || "https://dev.azure.com/" + name;
const custom = !!argv.url;
const insecure = !!argv.insecure;

setConfig(name, url, custom, insecure);

export { name as orgName, url as orgUrl, custom as isCustomUrl };

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authType = argv.authentication as string;
    // Use Personal Access Token handler for 'pat' or 'envvar' types, which is required for ADO Server
    const authHandler = authType === "pat" || authType === "envvar" ? getPersonalAccessTokenHandler(accessToken) : getBearerHandler(accessToken);
    const connection = new WebApi(
      url,
      authHandler,
      { ignoreSslError: insecure },
      {
        productName: "AzureDevOps.MCP",
        productVersion: packageVersion,
        userAgent: userAgentComposer.userAgent,
      }
    );
    return connection;
  };
}

async function main() {
  if (argv["api-version"]) {
    setApiVersions(argv["api-version"] as string);
  }

  logger.info("Starting Azure DevOps MCP Server", {
    organization: name,
    organizationUrl: url,
    authentication: argv.authentication,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

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
  const tenantId = (await getOrgTenant(name)) ?? (argv.tenant as string);
  const authenticator = createAuthenticator(argv.authentication as string, tenantId);

  // Define a provider that returns the full Authorization header
  const authHeaderProvider = async () => {
    const token = await authenticator();
    return getAuthorizationHeader(argv.authentication as string, token);
  };

  // removing prompts untill further notice
  // configurePrompts(server);

  configureAllTools(server, authHeaderProvider, getAzureDevOpsClient(authenticator, userAgentComposer), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
