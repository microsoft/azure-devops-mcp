#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";

import { createAuthenticator, installPatFetchInterceptor } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools, configureOnPremTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { getCliArgs } from "./utils.js";
import { packageVersion } from "./version.js";
import { Domain, DomainsManager } from "./shared/domains.js";
import { DEFAULT_ONPREM_API_VERSION, resolveOnPremConfig } from "./onprem/config.js";
import { AzureDevOpsServerClient } from "./onprem/client.js";
import { createPatTransport, createWindowsIntegratedTransport } from "./onprem/transport.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(getCliArgs())
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
    describe: `Type of authentication to use. Defaults to '${defaultAuthenticationType}', or 'windows' when --server-url is set. 'windows' (Windows integrated authentication) is only valid with --server-url.`,
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar", "pat", "windows"],
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("server-url", {
    describe:
      "Azure DevOps Server (on-premises) base URL, e.g. https://server or https://server/tfs. Enables the read-only on-premises pull request review mode; the <organization> argument is then the project collection name.",
    type: "string",
  })
  .option("api-version", {
    describe: `REST API version for Azure DevOps Server requests (only with --server-url). Defaults to ${DEFAULT_ONPREM_API_VERSION} (Azure DevOps Server 2019).`,
    type: "string",
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;
const orgUrl = "https://dev.azure.com/" + orgName;
const serverUrl = argv["server-url"] as string | undefined;
const authenticationType = (argv.authentication as string | undefined) ?? (serverUrl ? "windows" : defaultAuthenticationType);

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, authType: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    // For pat, accessToken is base64("{email}:{token}"). Decode to extract the token part,
    // since getPersonalAccessTokenHandler prepends ":" internally and just needs the raw token.
    const authHandler = authType === "pat" ? getPersonalAccessTokenHandler(Buffer.from(accessToken, "base64").toString("utf8").split(":").slice(1).join(":")) : getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

function createMcpServer() {
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
  return { server, userAgentComposer };
}

/**
 * Gated Azure DevOps Server (on-premises) mode: read-only pull request review tools only.
 * Skips all Azure DevOps Services discovery (tenant lookup, Entra ID authentication).
 */
async function startOnPrem(serverUrlValue: string) {
  const config = resolveOnPremConfig({ serverUrl: serverUrlValue, collection: orgName, authentication: authenticationType, apiVersion: argv["api-version"] as string | undefined });

  logger.info("Starting Azure DevOps MCP Server (Azure DevOps Server on-premises, read-only pull request review mode)", {
    collectionUrl: config.collectionUrl,
    authentication: config.authentication,
    apiVersion: config.apiVersion,
    version: packageVersion,
  });
  if (!enabledDomains.has(Domain.REPOSITORIES)) {
    throw new Error("On-premises mode only provides the 'repositories' domain (read-only pull request review tools). Remove -d or include 'repositories'.");
  }
  const requestedDomains = DomainsManager.parseDomainsInput(argv.domains as string | string[]);
  if (!requestedDomains.includes("all") && requestedDomains.some((domain) => domain !== Domain.REPOSITORIES)) {
    logger.warn("On-premises mode only provides read-only pull request review tools; other requested domains are ignored.");
  }
  if (config.collectionUrl.startsWith("http:")) {
    logger.warn("--server-url uses http; credentials and source code are sent without TLS. Prefer https.");
  }

  const { server, userAgentComposer } = createMcpServer();
  const transport = config.authentication === "windows" ? createWindowsIntegratedTransport() : createPatTransport();
  const client = new AzureDevOpsServerClient(config, transport, () => userAgentComposer.userAgent);
  configureOnPremTools(server, client, config.collectionUrl);

  await server.connect(new StdioServerTransport());
}

async function main() {
  if (serverUrl) {
    await startOnPrem(serverUrl);
    return;
  }
  if (authenticationType === "windows") {
    throw new Error("Authentication type 'windows' requires --server-url (Azure DevOps Server on-premises).");
  }
  if (argv["api-version"]) {
    logger.warn("--api-version is only used with --server-url and will be ignored.");
  }

  logger.info("Starting Azure DevOps MCP Server", {
    organization: orgName,
    organizationUrl: orgUrl,
    authentication: authenticationType,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

  const { server, userAgentComposer } = createMcpServer();
  const tenantId = argv.tenant ?? (await getOrgTenant(orgName));
  const authenticator = createAuthenticator(authenticationType, tenantId);

  if (authenticationType === "pat") {
    const basicValue = await authenticator();
    installPatFetchInterceptor(basicValue);
    logger.debug("PAT mode: global fetch interceptor installed to rewrite Bearer -> Basic auth headers");
  }

  // removing prompts until further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer, authenticationType), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
