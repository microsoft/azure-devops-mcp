#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebServer } from "./transport/http.js";
import { StreamableHTTPServerTransport as MCPStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, DefaultAzureCredential } from "@azure/identity";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { randomUUID } from "crypto";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: mcp-server-azuredevops <organization_name>");
  process.exit(1);
}

export const orgName = args[0];
const orgUrl = "https://dev.azure.com/" + orgName;

async function getAzureDevOpsToken(): Promise<AccessToken> {
  if (process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS) {
    process.env.AZURE_TOKEN_CREDENTIALS = process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS;
  } else {
    process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  }
  const credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  return token;
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

  const args = process.argv.slice(2);
  const transportType = args.includes("--transport=http") ? "http" : "stdio";

  let transport;
  if (transportType === "http") {
    transport = new MCPStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
    });

    const httpServer = new WebServer(transport);
    await httpServer.start();
  } else {
    transport = new StdioServerTransport();
  }

  console.log(`Initializing transport: ${transportType}`);
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
