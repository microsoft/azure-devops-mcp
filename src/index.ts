#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, DefaultAzureCredential, AzureCliCredential, ChainedTokenCredential } from "@azure/identity";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { userAgent } from "./utils.js";
import { packageVersion } from "./version.js";
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: mcp-server-azuredevops <organization_name> [tenant_id]");
  process.exit(1);
}

export const orgName = args[0];
export const tenantId = args[1]; 
const orgUrl = "https://dev.azure.com/" + orgName;

async function getAzureDevOpsToken(): Promise<AccessToken> {
  const credentialOptions = tenantId ? { tenantId } : {};

  const azureCliCredential = new AzureCliCredential(credentialOptions);

  const credential = new ChainedTokenCredential(azureCliCredential, new DefaultAzureCredential(credentialOptions));

  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  return token;
}

async function getAzureDevOpsClient(): Promise<azdev.WebApi> {
  const token = await getAzureDevOpsToken();
  const authHandler = azdev.getBearerHandler(token.token);
  const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
    productName: "AzureDevOps.MCP",
    productVersion: packageVersion,
    userAgent: userAgent,
  });
  return connection;
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
  });

  configurePrompts(server);

  configureAllTools(server, getAzureDevOpsToken, getAzureDevOpsClient);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
