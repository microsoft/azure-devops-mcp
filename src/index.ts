#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { getOrgTenant } from "./org-tenants.js";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";
import { createHttpServer } from "./http-server.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Detect transport mode from environment variable
const transportMode = process.env.MCP_TRANSPORT || "stdio";
const httpPort = parseInt(process.env.PORT || "3000", 10);

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

export const orgName = argv.organization as string;
const orgUrl = "https://dev.azure.com/" + orgName;

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer): () => Promise<azdev.WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = azdev.getBearerHandler(accessToken);
    const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  console.log(`🚀 Starting Azure DevOps MCP Server v${packageVersion}`);
  console.log(`📡 Transport mode: ${transportMode}`);
  console.log(`🏢 Organization: ${orgName}`);

  if (transportMode === "http") {
    // HTTP mode - for Copilot Studio and web clients
    console.log(`🌐 Starting HTTP server on port ${httpPort}...`);

    await createHttpServer({
      port: httpPort,
      orgName,
      authenticationType: argv.authentication,
      tenantId: argv.tenant,
      domains: argv.domains,
    });

    // Keep process alive
    process.on("SIGTERM", () => {
      console.log("\n👋 Received SIGTERM, shutting down gracefully...");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("\n👋 Received SIGINT, shutting down gracefully...");
      process.exit(0);
    });
  } else {
    // Stdio mode - for local MCP clients (Claude, VS Code, etc.)
    console.log(`📟 Starting stdio server for local MCP clients...`);

    const server = new McpServer({
      name: "Azure DevOps MCP Server",
      version: packageVersion,
    });

    const userAgentComposer = new UserAgentComposer(packageVersion);
    server.server.oninitialized = () => {
      userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
    };
    const tenantId = (await getOrgTenant(orgName)) ?? argv.tenant;
    const authenticator = createAuthenticator(argv.authentication, tenantId);

    configurePrompts(server);

    configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer), () => userAgentComposer.userAgent, enabledDomains);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log(`✅ Stdio server connected and ready`);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
