#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, AzureCliCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";
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
  .option("pat", {
    alias: "p",
    describe: "Personal Access Token for Azure DevOps authentication",
    type: "string",
  })
  .option("use-pat-env", {
    describe: "Use PAT from AZURE_DEVOPS_EXT_PAT environment variable",
    type: "boolean",
    default: false,
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;
const tenantId = argv.tenant;
const pat = argv.pat || (argv["use-pat-env"] ? process.env.AZURE_DEVOPS_EXT_PAT : undefined);

const orgUrl = "https://dev.azure.com/" + orgName;

async function getAzureDevOpsToken(): Promise<AccessToken> {
  // If PAT is provided, create a mock AccessToken for consistency
  if (pat) {
    console.log("✅ Using PAT authentication (skipping Azure CLI)");
    const expirationTime = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year from now
    return {
      token: pat,
      expiresOnTimestamp: expirationTime,
    };
  }

  console.log("🔍 No PAT detected, trying Azure CLI authentication...");

  // For non-PAT authentication, be very explicit about credential selection
  let credential: TokenCredential;

  if (tenantId) {
    // Use Azure CLI credential with specific tenant
    console.log("Using Azure CLI credential with tenant:", tenantId);
    credential = new AzureCliCredential({ tenantId });
  } else {
    // Try Azure CLI credential first, but don't fall back silently
    console.log("Attempting Azure CLI credential authentication...");
    try {
      credential = new AzureCliCredential();
      // Test the credential immediately to ensure it works
      const testToken = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
      if (!testToken) {
        throw new Error("Azure CLI credential returned null token");
      }
      console.log("✅ Azure CLI credential successful");
      return testToken;
    } catch (azCliError) {
      console.error("❌ Azure CLI credential failed:", (azCliError as Error).message);
      console.error("This usually means 'az login' hasn't been run or has expired.");
      console.error("");
      console.error("🎯 RECOMMENDED SOLUTION: Use PAT authentication instead:");
      console.error("1. Create PAT: https://dev.azure.com/{org}/_usersSettings/tokens");
      console.error('2. export AZURE_DEVOPS_EXT_PAT="your_pat_token"');
      console.error("3. Run: npx @azure-devops/mcp your-org --use-pat-env");
      console.error("");

      // Only fall back to DefaultAzureCredential if explicitly configured
      if (process.env.ALLOW_DEFAULT_CREDENTIAL === "true") {
        console.warn("⚠️ Falling back to DefaultAzureCredential (might authenticate as wrong user)");
        if (process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS) {
          process.env.AZURE_TOKEN_CREDENTIALS = process.env.ADO_MCP_AZURE_TOKEN_CREDENTIALS;
        } else {
          process.env.AZURE_TOKEN_CREDENTIALS = "dev";
        }
        credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
      } else {
        throw new Error(`Azure CLI authentication failed. Please run 'az login' first, or use PAT authentication instead.

🎯 QUICK FIX - Use PAT authentication:
1. Create PAT: https://dev.azure.com/{org}/_usersSettings/tokens
2. export AZURE_DEVOPS_EXT_PAT="your_pat_token"
3. npx @azure-devops/mcp ${orgName} --use-pat-env

For detailed setup: see docs/PAT-AUTHENTICATION.md`);
      }
    }
  }

  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  if (!token) {
    throw new Error("Failed to obtain Azure DevOps token. Please use PAT authentication for most reliable results.");
  }
  return token;
}

function getAzureDevOpsClient(userAgentComposer: UserAgentComposer): () => Promise<azdev.WebApi> {
  return async () => {
    const token = await getAzureDevOpsToken();

    // Use different authentication handlers based on authentication method
    let authHandler: ReturnType<typeof azdev.getPersonalAccessTokenHandler> | ReturnType<typeof azdev.getBearerHandler>;
    if (pat) {
      // For PAT authentication, use the proper Personal Access Token handler
      authHandler = azdev.getPersonalAccessTokenHandler(pat);
    } else {
      // For OAuth token authentication
      authHandler = azdev.getBearerHandler(token.token);
    }

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
