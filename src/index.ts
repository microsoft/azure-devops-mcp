#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBasicHandler, getBearerHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";
import { getAzureDevOpsConfig } from "./utils.js";

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
    choices: ["interactive", "azcli", "env", "envvar"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;
const { orgUrl, mode: deploymentMode } = getAzureDevOpsConfig(orgName);

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, authentication: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const isBasicAuth = process.env["ADO_MCP_AUTH_TYPE"] == "basic";
    const authHandler = isBasicAuth ? getBasicHandler("", accessToken) : getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  logger.info("Starting Azure DevOps MCP Server v" + packageVersion);

  logger.info("Used params and settings", {
    organization: orgName,
    organizationUrl: orgUrl,
    deploymentMode: deploymentMode,
    authentication: argv.authentication,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
  });

  const server = new McpServer({
    name: "DevOps MCP Server - WEM Fork (On Premise)",
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
  const tenantId = deploymentMode === "cloud" ? ((await getOrgTenant(orgName)) ?? argv.tenant) : undefined;
  const authenticator = createAuthenticator(argv.authentication, tenantId);

  // removing prompts untill further notice
  // configurePrompts(server);

  const connectionProvider = getAzureDevOpsClient(authenticator, userAgentComposer, argv.authentication);

  configureAllTools(server, authenticator, connectionProvider, () => userAgentComposer.userAgent, enabledDomains);

  // TESTING CONNECTION TO DevOps API
  // await testApi(connectionProvider, authenticator);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function testApi(connectionProvider: () => Promise<WebApi>, tokenProvider: () => Promise<string>) {
  const connection = await connectionProvider();
  const coreApi = await connection.getCoreApi();
  const workItemApi = await connection.getWorkItemTrackingApi();

  const accessToken = await tokenProvider();

  const baseUrl = connection.serverUrl.replace(/\/$/, "");
  const isOnPrem = process.env["ADO_MCP_MODE"] === "onprem";
  const url = isOnPrem
    ? `${baseUrl}/${orgName}/_apis/search/workitemsearchresults?api-version=6.0-preview`
    : `https://almsearch.dev.azure.com/${orgName}/_apis/search/workitemsearchresults?api-version=6.0`;

  const searchText = "Antonio";
  const includeFacets = false;
  const requestBody: Record<string, unknown> = {
    searchText,
    includeFacets,
    $skip: 0,
    $top: 10,
  };

  const isBasicAuth = process.env["ADO_MCP_AUTH_TYPE"] === "basic";
  const authHeader = isBasicAuth ? `Basic ${Buffer.from(":" + accessToken).toString("base64")}` : `Bearer ${accessToken}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "User-Agent": "AzureDevOps.MCP TestApi",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Azure DevOps Work Item Search API error", {
      status: response.status,
      statusText: response.statusText,
      url,
      requestBody,
      responseBody: errorBody,
    });
    throw new Error(`Azure DevOps Work Item Search API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.text();
  logger.info("Test API Work Item Search result:", result);
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
