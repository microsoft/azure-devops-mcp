#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, AzureCliCredential, DefaultAzureCredential, InteractiveBrowserCredential} from "@azure/identity";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization>", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
    });
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, required for multi-tenant scenarios)",
    type: "string",
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;
const tenantId = argv.tenant;
const orgUrl = "https://dev.azure.com/" + orgName;

async function getAzureDevOpsToken(): Promise<AccessToken> {
  if (process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS) {
    process.env.AZURE_TOKEN_CREDENTIALS = process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS;
  } else {
    process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  }
  
  const scope = "499b84ac-1321-427f-aa17-267ca6975798/.default";
  const errors: string[] = [];
  
  // Try Azure CLI credential if tenantId is provided
  if (tenantId) {
    try {
      const azureCliCredential = new AzureCliCredential({ tenantId });
      const token = await azureCliCredential.getToken(scope);
      if (token) {
        return token;
      }
    } catch (error) {
      errors.push(`AzureCliCredential failed: ${error}`);
    }
  }

  // Try DefaultAzureCredential first (includes managed identity, environment variables, etc.)
  try {
    const defaultCredential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
    const token = await defaultCredential.getToken(scope);
    if (token) {
      return token;
    }
  } catch (error) {
    errors.push(`DefaultAzureCredential failed: ${error}`);
  }
    
  // Try InteractiveBrowserCredential as final fallback
  try {
    const interactiveBrowserCredential = new InteractiveBrowserCredential({ tenantId });
    const token = await interactiveBrowserCredential.getToken(scope, {
      requestOptions: { timeout: 60000 } // 1 minute timeout for interactive authentication
    });
    if (token) {
      return token;
    }
  } catch (error) {
    errors.push(`InteractiveBrowserCredential failed: ${error}`);
  }

  // If all credentials failed, throw an error with details
  throw new Error(`Failed to obtain Azure DevOps token. All authentication methods failed:\n${errors.join('\n')}\n\nTroubleshooting steps:\n1. Install Azure CLI and run 'az login'\n2. Set environment variables for service principal authentication\n3. Ensure you have access to Azure DevOps with the specified tenant`);
}

function getAzureDevOpsClient(userAgentComposer: UserAgentComposer): () => Promise<azdev.WebApi> {
  return async () => {
    const token = await getAzureDevOpsToken();
    const authHandler = azdev.getBearerHandler(token.token);
    const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
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
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  configurePrompts(server);

  configureAllTools(server, getAzureDevOpsToken, getAzureDevOpsClient(userAgentComposer), () => userAgentComposer.userAgent);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
