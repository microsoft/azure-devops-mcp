#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getBearerHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { requireEasyAuth, makeAllowlistMiddleware } from "./auth/easyauth.js";
import { logger, logIncomingMcpMessage } from "./logger.js";
import { LoggingStreamableHTTPServerTransport } from "./logging-streamable-http-transport.js";
import { getOrgTenant } from "./org-tenants.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

const defaultPort = Number(process.env["PORT"]) || 3000;

const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops-http")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server (HTTP)", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
      demandOption: true,
    });
  })
  .option("domains", {
    alias: "d",
    describe:
      "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar"],
    default: "envvar",
  })
  .option("tenant", {
    alias: "t",
    describe:
      "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("port", {
    describe: "HTTP port to listen on",
    type: "number",
    default: defaultPort,
  })
  .help()
  .parseSync();

const orgName = argv.organization as string;
const orgUrl = "https://dev.azure.com/" + orgName;

const domainsManager = new DomainsManager(argv.domains as string | string[]);
const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(
  getAzureDevOpsToken: () => Promise<string>,
  userAgentComposer: UserAgentComposer
): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

function failFastIfEnvVarAuthMissing(): void {
  if (argv.authentication !== "envvar") return;
  const token = process.env["ADO_MCP_AUTH_TOKEN"];
  if (!token || typeof token !== "string" || !token.trim()) {
    logger.error("ADO_MCP_AUTH_TOKEN is required when using --authentication envvar");
    throw new Error(
      "Environment variable 'ADO_MCP_AUTH_TOKEN' is required when using --authentication envvar. Set it with a valid Azure DevOps Personal Access Token."
    );
  }
}

async function main(): Promise<void> {
  failFastIfEnvVarAuthMissing();

  logger.info("Starting Azure DevOps MCP Server (HTTP)", {
    organization: orgName,
    organizationUrl: orgUrl,
    authentication: argv.authentication,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    port: argv.port,
  });

  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [{ src: "https://cdn.vsassets.io/content/icons/favicon.ico" }],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  const tenantId = (await getOrgTenant(orgName)) ?? (argv.tenant as string | undefined);
  const authenticator = createAuthenticator(argv.authentication as string, tenantId);

  configureAllTools(
    server,
    authenticator,
    getAzureDevOpsClient(authenticator, userAgentComposer),
    () => userAgentComposer.userAgent,
    enabledDomains
  );

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).send("OK");
  });

  const skipEasyAuth = process.env["MCP_HTTP_SKIP_EASY_AUTH"] === "1";
  const mcpAuth = skipEasyAuth ? [] : [requireEasyAuth, makeAllowlistMiddleware()];

  app.all("/mcp", mcpAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const bodyMessages = Array.isArray(req.body) ? req.body : req.body ? [req.body] : [];
      for (const message of bodyMessages) {
        if (message && typeof message === "object" && "method" in message) {
          logIncomingMcpMessage("http", message, {
            httpMethod: req.method,
            sessionId,
          });
        }
      }

      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
        transport = new LoggingStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            if (sid) transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else if (sessionId && !transports[sessionId]) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        });
        return;
      } else if (req.method !== "POST" && req.method !== "GET") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
      } else if (!sessionId) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: mcp-session-id required for non-initialize requests" },
          id: null,
        });
        return;
      } else {
        transport = transports[sessionId];
      }

      if (req.method === "GET") {
        await transport.handleRequest(req, res);
      } else {
        await transport.handleRequest(req, res, req.body);
      }
    } catch (error) {
      logger.error("Error handling /mcp request", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const serverInstance = app.listen(argv.port, () => {
    logger.info("HTTP server listening", { port: argv.port, path: "/mcp", healthz: "/healthz" });
  });

  process.on("SIGINT", async () => {
    for (const sid of Object.keys(transports)) {
      try {
        await transports[sid].close();
      } catch (e) {
        logger.error("Error closing transport", { sessionId: sid, error: e });
      }
    }
    serverInstance.close(() => process.exit(0));
  });
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
