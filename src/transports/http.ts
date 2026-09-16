// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AsyncLocalStorage } from "node:async_hooks";
import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { logger } from "../logger.js";
import { PRESET_NAMES, resolvePreset } from "../shared/presets.js";

interface RequestAuthContext {
  token: string;
}

const requestAuthStore = new AsyncLocalStorage<RequestAuthContext>();

/**
 * Retrieve the Azure DevOps access token for the in-flight HTTP request.
 *
 * The HTTP transport uses token pass-through: each request carries its own
 * bearer token, so credentials are never stored on the server and every
 * caller acts as themselves. Tool handlers run inside the request's async
 * context, so this resolves the correct token per request.
 *
 * @throws if called outside of a request context or without a bearer token.
 */
export function getRequestToken(): string {
  const ctx = requestAuthStore.getStore();
  if (!ctx?.token) {
    throw new Error("No Azure DevOps access token in request context. The HTTP transport requires a bearer token in the 'Authorization' header.");
  }
  return ctx.token;
}

/** Run `fn` within a request context carrying the given Azure DevOps token, so tool handlers resolve it via {@link getRequestToken}. */
export function runWithRequestToken<T>(token: string, fn: () => T): T {
  return requestAuthStore.run({ token }, fn);
}

/**
 * Extract a bearer token from an Authorization header value.
 * Returns null if the header is missing, malformed, or the token is empty.
 */
export function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }
  // Parsed without an ambiguous regex (avoids polynomial backtracking): split
  // the "Bearer" scheme from the token at the first run of whitespace.
  const value = authorizationHeader.trim();
  const firstSpace = value.search(/\s/);
  if (firstSpace === -1) {
    return null;
  }
  if (value.slice(0, firstSpace).toLowerCase() !== "bearer") {
    return null;
  }
  const token = value.slice(firstSpace + 1).trim();
  return token.length > 0 ? token : null;
}

/** Minimal transport contract used by the request handler (eases testing). */
interface TransportLike {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
  close(): Promise<void>;
}

export interface HttpTransportOptions {
  host: string;
  port: number;
  mcpPath: string;
  /** Hosts permitted in the Host header (DNS rebinding protection). */
  allowedHosts: string[];
  /** Origins permitted in the Origin header. When omitted/empty, requests carrying any Origin header are rejected (non-browser clients send no Origin). */
  allowedOrigins?: string[];
  /**
   * Builds a fully configured MCP server. Called once per request (stateless).
   * `preset` is the trailing path segment of the MCP URL, when one was given.
   */
  createServer: (preset?: string) => McpServer;
  /** Test seam: override transport construction. */
  createTransport?: () => TransportLike;
}

function defaultCreateTransport(opts: HttpTransportOptions): TransportLike {
  // Stateless mode (sessionIdGenerator: undefined): a fresh server/transport pair
  // is created per request, so no session state — and therefore no credential —
  // is ever shared across callers. DNS rebinding protection guards against
  // browser-based attackers reaching a locally bound server.
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: true,
    allowedHosts: opts.allowedHosts,
    allowedOrigins: opts.allowedOrigins,
  });
}

/**
 * Decide whether a request's Origin header is acceptable.
 *
 * Non-browser MCP clients send no Origin, so the absence of the header is
 * always allowed. When an Origin is present it must be explicitly listed in
 * `allowedOrigins`; by default (no allow-list) any cross-origin browser
 * request is rejected. This complements the SDK's Host-header (DNS rebinding)
 * check, which only validates Origin when an allow-list is configured.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins?: string[]): boolean {
  if (!origin) {
    return true;
  }
  return Boolean(allowedOrigins?.includes(origin));
}

/**
 * Match a request path against the MCP endpoint, optionally followed by a
 * preset name (`/mcp` or `/mcp/dev`).
 *
 * Returns `{ preset }` for a match — `preset` undefined on the bare path — and
 * `undefined` when the path is not ours or names a preset that does not exist,
 * both of which the caller answers with 404.
 */
export function matchMcpPath(pathname: string, mcpPath: string): { preset?: string } | undefined {
  if (pathname === mcpPath) {
    return {};
  }
  if (!pathname.startsWith(`${mcpPath}/`)) {
    return undefined;
  }
  const preset = pathname.slice(mcpPath.length + 1);
  if (!preset || preset.includes("/") || !resolvePreset(preset)) {
    return undefined;
  }
  return { preset };
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

/**
 * Build the Node HTTP request listener that serves the MCP endpoint.
 * Exported for testing; production code uses {@link startHttpServer}.
 */
export function createMcpRequestListener(opts: HttpTransportOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const createTransport = opts.createTransport ?? (() => defaultCreateTransport(opts));

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const route = matchMcpPath(url.pathname, opts.mcpPath);
      if (!route) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
      if (!isOriginAllowed(origin, opts.allowedOrigins)) {
        sendJson(res, 403, { error: "Origin not allowed." });
        return;
      }

      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        sendJson(res, 401, { error: "Missing or invalid Authorization header. Provide 'Authorization: Bearer <azure-devops-token>'." }, { "WWW-Authenticate": 'Bearer realm="azure-devops-mcp"' });
        return;
      }

      const server = opts.createServer(route.preset);
      const transport = createTransport();
      res.on("close", () => {
        void transport.close();
        void server.close();
      });

      await server.connect(transport as unknown as Transport);
      await runWithRequestToken(token, () => transport.handleRequest(req, res));
    } catch (error) {
      // Never include the token or request body in logs.
      logger.error("Error handling MCP HTTP request", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  };
}

/** Start the HTTP MCP server and resolve once it is listening. */
export async function startHttpServer(opts: HttpTransportOptions): Promise<Server> {
  const listener = createMcpRequestListener(opts);
  const httpServer = createHttpServer((req, res) => {
    void listener(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(opts.port, opts.host, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  logger.info("Azure DevOps MCP Server listening over HTTP", {
    host: opts.host,
    port: opts.port,
    path: opts.mcpPath,
    presetPaths: PRESET_NAMES.map((name) => `${opts.mcpPath}/${name}`),
    allowedHosts: opts.allowedHosts,
  });

  return httpServer;
}
