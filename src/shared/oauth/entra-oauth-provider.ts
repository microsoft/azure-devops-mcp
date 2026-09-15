// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// OAuth Authorization Server provider that bridges MCP clients to Microsoft
// Entra ID. MCP clients (e.g. Claude) dynamically register with THIS server
// (which supports DCR), while the actual user sign-in is delegated to Entra
// using a pre-registered confidential application. The token handed back to the
// client is the Entra-issued access token for Azure DevOps, so the existing
// pass-through tool code can use it unchanged.
//
// Why this exists: Entra ID does not support dynamic client registration, which
// MCP clients require. By acting as the authorization server we provide DCR
// locally and proxy the login to Entra.

import { randomUUID } from "node:crypto";
import { Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidScopeError,
  InvalidTokenError,
  ServerError,
  TemporarilyUnavailableError,
  UnauthorizedClientError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

import { logger } from "../../logger.js";

/**
 * Translates an Entra token-endpoint failure into the matching OAuth 2.1 error.
 *
 * Without this every upstream refusal surfaced as a generic `500 server_error`,
 * which tells an MCP client that the server is broken. The usual case is the
 * opposite: the client's grant is simply stale (this server keeps its OAuth
 * state in memory, so a restart invalidates it) and the client should re-run
 * the authorization flow. `invalid_grant` says exactly that, and clients act
 * on it by re-authenticating instead of reporting an outage.
 *
 * The Entra error code and description are logged and passed through; neither
 * contains the token or the client secret.
 */
function toOAuthError(status: number, data: Record<string, unknown>): Error {
  const code = typeof data.error === "string" ? data.error : "";
  const description = typeof data.error_description === "string" ? data.error_description : "";
  const message = `Entra token endpoint error: ${code || status} ${description}`.trim();

  logger.warn("Entra token request rejected", { status, error: code || undefined });

  switch (code) {
    // Expired, revoked, already-redeemed or otherwise unusable grant — the
    // client must start a new authorization flow.
    case "invalid_grant":
    case "interaction_required":
    case "consent_required":
    case "login_required":
      return new InvalidGrantError(message);
    // Our confidential app is misconfigured (wrong secret, missing consent).
    // Not the client's fault, but not a transient server fault either.
    case "invalid_client":
    case "unauthorized_client":
      return new UnauthorizedClientError(message);
    case "invalid_scope":
      return new InvalidScopeError(message);
    case "invalid_request":
    case "unsupported_grant_type":
      return new InvalidRequestError(message);
    default:
      // Entra itself is unavailable — retryable, so say so rather than
      // claiming a permanent server fault.
      return status >= 500 ? new TemporarilyUnavailableError(message) : new ServerError(message);
  }
}

/** Verifies a JWT and returns its claims (at least `exp`). Throws on any failure. */
export type JwtVerifier = (token: string) => Promise<{ exp?: number }>;

/** Default verifier: validates the signature against the Entra tenant JWKS and the issuer (v1 or v2). */
function createEntraJwtVerifier(tenantId: string): JwtVerifier {
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  // Audience is intentionally not enforced here — the token targets Azure DevOps,
  // which validates the audience on every API call. We verify signature + issuer
  // to reject forged/unsigned tokens.
  const issuer = [`https://login.microsoftonline.com/${tenantId}/v2.0`, `https://sts.windows.net/${tenantId}/`];
  return async (token: string) => {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return payload;
  };
}

export interface EntraOAuthConfig {
  /** Entra tenant ID. */
  tenantId: string;
  /** Confidential app (client) ID registered in Entra. */
  clientId: string;
  /** Confidential app client secret. */
  clientSecret: string;
  /** Public base URL of this server (e.g. https://host), used for the Entra redirect URI. */
  publicBaseUrl: string;
  /** Path that receives the Entra redirect. Defaults to /auth/callback. */
  callbackPath?: string;
  /** Scopes requested from Entra. Defaults to the Azure DevOps resource + offline_access. */
  scopes?: string[];
}

// Azure DevOps resource ID — tokens for this audience work against the ADO REST API.
const ADO_DEFAULT_SCOPE = "499b84ac-1321-427f-aa17-267ca6975798/.default";

interface PendingAuthorization {
  clientId: string;
  redirectUri: string;
  clientState?: string;
  codeChallenge: string;
  createdAt: number;
}

interface IssuedCode {
  tokens: OAuthTokens;
  codeChallenge: string;
  clientId: string;
  expiresAt: number;
}

const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the Entra login
const CODE_TTL_MS = 60 * 1000; // 1 minute to redeem our authorization code

class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.clients.get(clientId);
  }

  registerClient(client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">): OAuthClientInformationFull {
    const registered: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(registered.client_id, registered);
    return registered;
  }
}

export class EntraOAuthProvider implements OAuthServerProvider {
  public readonly clientsStore = new InMemoryClientsStore();
  // false → the MCP SDK token handler validates the client's PKCE locally
  // against the challenge we stored (challengeForAuthorizationCode). Entra is
  // not involved in the client's PKCE; the upstream leg uses our own redirect.
  public readonly skipLocalPkceValidation = false;

  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly issuedCodes = new Map<string, IssuedCode>();
  private readonly callbackPath: string;
  /** Scopes requested from Entra; also advertised as the server's supported scopes. */
  public readonly scopes: string[];
  private readonly verifyJwt: JwtVerifier;

  constructor(
    private readonly config: EntraOAuthConfig,
    options?: { verifyJwt?: JwtVerifier }
  ) {
    this.callbackPath = config.callbackPath ?? "/auth/callback";
    this.scopes = config.scopes ?? [ADO_DEFAULT_SCOPE, "offline_access"];
    this.verifyJwt = options?.verifyJwt ?? createEntraJwtVerifier(config.tenantId);
  }

  get redirectUri(): string {
    return new URL(this.callbackPath, this.config.publicBaseUrl).toString();
  }

  private get authorizeEndpoint(): string {
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize`;
  }

  private get tokenEndpoint(): string {
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    this.evictExpired();

    const state = randomUUID();
    this.pending.set(state, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      clientState: params.state,
      codeChallenge: params.codeChallenge,
      createdAt: Date.now(),
    });

    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", this.scopes.join(" "));
    url.searchParams.set("state", state);

    res.redirect(url.toString());
  }

  /**
   * Express handler for the Entra redirect. Exchanges the Entra authorization
   * code for tokens and redirects back to the MCP client with our own code.
   */
  handleCallback = async (req: { query: Record<string, unknown> }, res: Response): Promise<void> => {
    this.evictExpired();

    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const error = typeof req.query.error === "string" ? req.query.error : undefined;

    const pending = state ? this.pending.get(state) : undefined;
    if (!state || !pending) {
      res.status(400).send("Invalid or expired authorization state.");
      return;
    }
    this.pending.delete(state);

    if (error || !code) {
      const desc = typeof req.query.error_description === "string" ? req.query.error_description : "Authorization failed.";
      const target = new URL(pending.redirectUri);
      target.searchParams.set("error", error ?? "invalid_request");
      target.searchParams.set("error_description", desc);
      if (pending.clientState) target.searchParams.set("state", pending.clientState);
      res.redirect(target.toString());
      return;
    }

    let tokens: OAuthTokens;
    try {
      tokens = await this.entraTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      });
    } catch (e) {
      logger.error("Entra token exchange failed", e instanceof Error ? e.message : String(e));
      const target = new URL(pending.redirectUri);
      target.searchParams.set("error", "server_error");
      if (pending.clientState) target.searchParams.set("state", pending.clientState);
      res.redirect(target.toString());
      return;
    }

    const ourCode = randomUUID();
    this.issuedCodes.set(ourCode, {
      tokens,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    const target = new URL(pending.redirectUri);
    target.searchParams.set("code", ourCode);
    if (pending.clientState) target.searchParams.set("state", pending.clientState);
    res.redirect(target.toString());
  };

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const entry = this.issuedCodes.get(authorizationCode);
    if (!entry || entry.expiresAt < Date.now()) {
      // Codes live in memory, so a server restart also loses them. Reported as
      // invalid_grant, which tells the client to re-authorize rather than retry.
      throw new InvalidGrantError("Invalid or expired authorization code.");
    }
    return entry.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const entry = this.issuedCodes.get(authorizationCode);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new InvalidGrantError("Invalid or expired authorization code.");
    }
    if (entry.clientId !== client.client_id) {
      throw new InvalidGrantError("Authorization code was issued to a different client.");
    }
    this.issuedCodes.delete(authorizationCode);
    return entry.tokens;
  }

  async exchangeRefreshToken(_client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
    return this.entraTokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: (scopes && scopes.length > 0 ? scopes : this.scopes).join(" "),
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const fallbackExpiry = Math.floor(Date.now() / 1000) + 3600;

    // JWTs (the normal case for Azure DevOps tokens) are cryptographically
    // verified against the Entra JWKS — this rejects forged/unsigned tokens and
    // also enforces expiry. Opaque (non-JWT) tokens can't be verified here, so
    // they pass through; Azure DevOps remains the authority and rejects them on
    // the actual API call.
    let expiresAt = fallbackExpiry;
    if (token.split(".").length === 3) {
      try {
        const payload = await this.verifyJwt(token);
        if (typeof payload.exp === "number") {
          expiresAt = payload.exp;
        }
      } catch (error) {
        // Never log the token itself.
        logger.warn("Access token verification failed", error instanceof Error ? error.message : String(error));
        // invalid_token makes the 401 carry a WWW-Authenticate challenge, so the
        // client refreshes or re-authorizes instead of treating it as an outage.
        throw new InvalidTokenError("Invalid access token.");
      }
    }

    return {
      token,
      clientId: this.config.clientId,
      scopes: this.scopes,
      expiresAt,
    };
  }

  private async entraTokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...params,
    });
    if (!body.has("scope")) {
      body.set("scope", this.scopes.join(" "));
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw toOAuthError(response.status, data);
    }

    return {
      access_token: String(data.access_token),
      token_type: "Bearer",
      expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
      refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      scope: typeof data.scope === "string" ? data.scope : this.scopes.join(" "),
    };
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.pending) {
      if (now - v.createdAt > PENDING_TTL_MS) this.pending.delete(k);
    }
    for (const [k, v] of this.issuedCodes) {
      if (v.expiresAt < now) this.issuedCodes.delete(k);
    }
  }
}
