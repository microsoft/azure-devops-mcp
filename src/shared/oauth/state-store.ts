// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Storage for the OAuth authorization server's own state: the MCP clients that
// registered via DCR, the in-flight authorizations waiting on the Entra login,
// and the authorization codes we issue to clients.
//
// The default implementation keeps everything in process memory, which is right
// for the stdio transport and local runs. In a deployed HTTP server that state
// must outlive a restart: without it every deploy silently invalidates the
// clients' registrations and grants, and they can only recover by having the
// user sign in again. See TableOAuthStateStore for the persistent variant.

import { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

/** An authorization started by a client and waiting for the user to finish signing in to Entra. */
export interface PendingAuthorization {
  clientId: string;
  redirectUri: string;
  clientState?: string;
  codeChallenge: string;
  createdAt: number;
}

/** An authorization code this server issued to a client, holding the Entra tokens it can redeem. */
export interface IssuedCode {
  tokens: OAuthTokens;
  codeChallenge: string;
  clientId: string;
  expiresAt: number;
}

export interface OAuthStateStore {
  getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
  saveClient(client: OAuthClientInformationFull): Promise<void>;

  savePending(state: string, pending: PendingAuthorization): Promise<void>;
  /** Reads and removes the pending authorization; a state may only be used once. */
  takePending(state: string): Promise<PendingAuthorization | undefined>;

  saveCode(code: string, issued: IssuedCode): Promise<void>;
  /** Reads without consuming — the PKCE challenge is looked up before the code is redeemed. */
  getCode(code: string): Promise<IssuedCode | undefined>;
  deleteCode(code: string): Promise<void>;

  /** Drops entries past their TTL. Called opportunistically, never on a hot path. */
  evictExpired(): Promise<void>;
}

export const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the Entra login
export const CODE_TTL_MS = 60 * 1000; // 1 minute to redeem our authorization code

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly codes = new Map<string, IssuedCode>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async saveClient(client: OAuthClientInformationFull): Promise<void> {
    this.clients.set(client.client_id, client);
  }

  async savePending(state: string, pending: PendingAuthorization): Promise<void> {
    this.pending.set(state, pending);
  }

  async takePending(state: string): Promise<PendingAuthorization | undefined> {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (!entry || Date.now() - entry.createdAt > PENDING_TTL_MS) {
      return undefined;
    }
    return entry;
  }

  async saveCode(code: string, issued: IssuedCode): Promise<void> {
    this.codes.set(code, issued);
  }

  async getCode(code: string): Promise<IssuedCode | undefined> {
    const entry = this.codes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return undefined;
    }
    return entry;
  }

  async deleteCode(code: string): Promise<void> {
    this.codes.delete(code);
  }

  async evictExpired(): Promise<void> {
    const now = Date.now();
    for (const [k, v] of this.pending) {
      if (now - v.createdAt > PENDING_TTL_MS) this.pending.delete(k);
    }
    for (const [k, v] of this.codes) {
      if (v.expiresAt < now) this.codes.delete(k);
    }
  }
}
