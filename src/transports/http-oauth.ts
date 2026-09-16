// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// HTTP transport that fronts the MCP server with a full OAuth 2.1 authorization
// server (dynamic client registration + metadata), bridging sign-in to
// Microsoft Entra ID. This lets MCP clients that rely on DCR (e.g. Claude)
// connect with just a URL and a browser login, instead of a pre-supplied token.

import { createServer as createHttpServer, Server } from "node:http";

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";

import { logger } from "../logger.js";
import { isOriginAllowed, runWithRequestToken } from "./http.js";
import { EntraOAuthProvider } from "../shared/oauth/entra-oauth-provider.js";
import { PRESET_NAMES, resolvePreset } from "../shared/presets.js";

export interface OAuthHttpTransportOptions {
  host: string;
  port: number;
  mcpPath: string;
  /** Public base URL clients reach (TLS-terminated), used as the OAuth issuer. */
  publicBaseUrl: string;
  allowedHosts: string[];
  allowedOrigins?: string[];
  provider: EntraOAuthProvider;
  /**
   * Builds a fully configured MCP server (called once per request, stateless).
   * `preset` is the trailing path segment of the MCP URL, when one was given.
   */
  createServer: (preset?: string) => McpServer;
}

/** Start the OAuth-fronted HTTP MCP server and resolve once it is listening. */
export async function startOAuthHttpServer(opts: OAuthHttpTransportOptions): Promise<Server> {
  const app = express();
  app.disable("x-powered-by");
  // ACA ingress sets X-Forwarded-For; without this express-rate-limit (used by
  // the MCP SDK auth router) throws a ValidationError and breaks every request.
  app.set("trust proxy", 1);

  const issuerUrl = new URL(opts.publicBaseUrl);
  const resourceMetadataUrl = new URL("/.well-known/oauth-protected-resource", opts.publicBaseUrl).toString();

  // OAuth metadata, dynamic client registration, authorize and token endpoints.
  app.use(
    mcpAuthRouter({
      provider: opts.provider,
      issuerUrl,
      scopesSupported: opts.provider.scopes,
      resourceName: "Azure DevOps MCP Server",
      resourceServerUrl: issuerUrl,
    })
  );

  // Entra redirect target — exchanges the upstream code and bounces back to the client.
  app.get(new URL(opts.provider.redirectUri).pathname, (req, res) => {
    void opts.provider.handleCallback(req, res);
  });

  // The MCP endpoint, gated by a valid bearer token (validated by the provider).
  // Served both bare and under a preset name ("/mcp" and "/mcp/dev"), which is
  // how a client asks for a narrower tool list — see shared/presets.ts. The
  // OAuth metadata stays at the issuer root, so all paths share one sign-in.
  const handleMcpPost = async (req: express.Request, res: express.Response) => {
    const preset = typeof req.params.preset === "string" ? req.params.preset : undefined;
    if (preset && !resolvePreset(preset)) {
      res.status(404).json({ error: `Unknown tool preset '${preset}'. Available presets: ${PRESET_NAMES.join(", ")}.` });
      return;
    }

    // Access log: record the caller's source IP. Behind the ACA ingress the real
    // client address is the first hop in X-Forwarded-For. Lets you verify the
    // connector's egress IPs (e.g. against Anthropic's published ranges) and
    // correlate with the 401/403 alert. No token or request body is logged.
    const forwardedFor = Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"];
    const clientIp = (forwardedFor?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown").trim();
    logger.info("MCP request", { clientIp });

    // Match the passthrough transport's Origin policy: reject any browser Origin
    // not on the allow-list (the SDK only checks Origin when one is configured).
    const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    if (!isOriginAllowed(origin, opts.allowedOrigins)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }

    const server = opts.createServer(preset);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: true,
      allowedHosts: opts.allowedHosts,
      allowedOrigins: opts.allowedOrigins,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      // requireBearerAuth guarantees req.auth on success; guard for type-safety.
      const token = req.auth?.token;
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await server.connect(transport as unknown as Transport);
      // The validated token is the Azure DevOps access token; expose it to tools.
      await runWithRequestToken(token, () => transport.handleRequest(req, res));
    } catch (error) {
      logger.error("Error handling MCP request", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };

  const bearerAuth = requireBearerAuth({ verifier: opts.provider, resourceMetadataUrl });
  app.post(opts.mcpPath, bearerAuth, handleMcpPost);
  app.post(`${opts.mcpPath}/:preset`, bearerAuth, handleMcpPost);

  const httpServer = createHttpServer(app);
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(opts.port, opts.host, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  logger.info("Azure DevOps MCP Server listening over HTTP with OAuth", {
    host: opts.host,
    port: opts.port,
    path: opts.mcpPath,
    presetPaths: PRESET_NAMES.map((name) => `${opts.mcpPath}/${name}`),
    issuer: opts.publicBaseUrl,
    callback: opts.provider.redirectUri,
  });

  return httpServer;
}
