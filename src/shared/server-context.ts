// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deployment context for the Azure DevOps MCP server.
 *
 * Two independent concerns are tracked separately:
 *  - isOnPremise: controls URL routing (cloud VSSPS vs. on-premise TFS base URL)
 *  - isPATAuth:   controls auth-header format (Basic for PAT, Bearer for OAuth)
 *
 * A cloud user may authenticate with a PAT, and an on-premise user may
 * theoretically use OAuth, so these must not be conflated.
 */
export interface ServerContext {
  orgUrl: string;
  orgName: string;
  /** True when the server URL was provided explicitly or contains "://" (on-premise TFS/Azure DevOps Server). */
  isOnPremise: boolean;
  /** True when AZURE_DEVOPS_PAT env var is set — mirrors the check in getAzureDevOpsClient. */
  isPATAuth: boolean;
}

let _context: ServerContext | null = null;

/**
 * Initialize the server context. Must be called once at startup (from index.ts)
 * before any tool handlers are invoked.
 */
export function initializeServerContext(context: ServerContext): void {
  _context = context;
}

/**
 * Retrieve the server context. Throws if called before initializeServerContext().
 */
export function getServerContext(): ServerContext {
  if (!_context) {
    throw new Error("Server context not initialized. Call initializeServerContext() first.");
  }
  return _context;
}

/**
 * Convenience helper — returns true when connected to an on-premise TFS /
 * Azure DevOps Server instance.
 */
export function isOnPremiseServer(): boolean {
  return getServerContext().isOnPremise;
}

/**
 * Build the HTTP Authorization header value for raw fetch() calls.
 *
 * When authenticating with a Personal Access Token (AZURE_DEVOPS_PAT),
 * the header must use HTTP Basic auth with the PAT as the
 * password (empty username). When authenticating via OAuth/AAD, a Bearer token
 * is used instead.
 */
export function buildAuthorizationHeader(token: string): string {
  const { isPATAuth } = getServerContext();
  if (isPATAuth) {
    // PAT basic auth: Base64(:<pat>)
    return `Basic ${Buffer.from(`:${token}`).toString("base64")}`;
  }
  return `Bearer ${token}`;
}
