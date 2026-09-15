// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest, beforeEach } from "@jest/globals";

jest.mock("../../../src/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// jose is ESM-only; these tests inject their own JWT verifier, so the real
// implementation is never exercised — a stub satisfies the module import.
jest.mock("jose", () => ({ createRemoteJWKSet: jest.fn(), jwtVerify: jest.fn() }));

import { EntraOAuthProvider } from "../../../src/shared/oauth/entra-oauth-provider";

const config = {
  tenantId: "tenant-1",
  clientId: "app-1",
  clientSecret: "secret-1",
  publicBaseUrl: "https://mcp.example.com",
};

interface MockRes {
  redirectUrl?: string;
  statusCode?: number;
  body?: string;
  redirect: (url: string) => void;
  status: (code: number) => MockRes;
  send: (b: string) => void;
}

function mockRes(): MockRes {
  const res: MockRes = {
    redirect: (url: string) => {
      res.redirectUrl = url;
    },
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    send: (b: string) => {
      res.body = b;
    },
  };
  return res;
}

const client = { client_id: "mcp-client", redirect_uris: ["https://client.example/cb"] } as never;

describe("EntraOAuthProvider", () => {
  let provider: EntraOAuthProvider;

  beforeEach(() => {
    provider = new EntraOAuthProvider(config);
    jest.restoreAllMocks();
  });

  it("exposes the callback redirect URI under the public base URL", () => {
    expect(provider.redirectUri).toBe("https://mcp.example.com/auth/callback");
  });

  describe("dynamic client registration", () => {
    it("issues a client_id and persists the registration in the state store", async () => {
      const registered = await provider.clientsStore.registerClient?.({ redirect_uris: ["https://client.example/cb"] } as never);
      if (!registered) throw new Error("registerClient not implemented");
      expect(registered.client_id).toBeTruthy();
      await expect(provider.clientsStore.getClient(registered.client_id)).resolves.toEqual(registered);
    });

    it("does not know a client that was never registered", async () => {
      await expect(provider.clientsStore.getClient("never-seen")).resolves.toBeUndefined();
    });
  });

  describe("authorize", () => {
    it("redirects to the Entra authorize endpoint with our client and callback", async () => {
      const res = mockRes();
      await provider.authorize(client, { redirectUri: "https://client.example/cb", state: "client-state", codeChallenge: "chal", scopes: [] }, res as never);

      const url = new URL(String(res.redirectUrl));
      expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/tenant-1/oauth2/v2.0/authorize");
      expect(url.searchParams.get("client_id")).toBe("app-1");
      expect(url.searchParams.get("redirect_uri")).toBe("https://mcp.example.com/auth/callback");
      expect(url.searchParams.get("scope")).toContain("499b84ac-1321-427f-aa17-267ca6975798/.default");
      expect(url.searchParams.get("state")).toBeTruthy();
    });
  });

  describe("callback -> code exchange", () => {
    it("exchanges the Entra code and lets the client redeem our code for tokens", async () => {
      // 1. authorize to capture the upstream state.
      const authRes = mockRes();
      await provider.authorize(client, { redirectUri: "https://client.example/cb", state: "client-state", codeChallenge: "chal-xyz", scopes: [] }, authRes as never);
      const upstreamState = new URL(String(authRes.redirectUrl)).searchParams.get("state") ?? "";

      // 2. Entra redirects back; mock the token exchange.
      const fetchMock = jest.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "ado-access", refresh_token: "ado-refresh", expires_in: 3600, scope: "scope" }),
      }));
      (globalThis as { fetch: unknown }).fetch = fetchMock;

      const cbRes = mockRes();
      await provider.handleCallback({ query: { code: "entra-code", state: upstreamState } }, cbRes as never);

      const back = new URL(String(cbRes.redirectUrl));
      expect(back.origin + back.pathname).toBe("https://client.example/cb");
      expect(back.searchParams.get("state")).toBe("client-state");
      const ourCode = back.searchParams.get("code") ?? "";
      expect(ourCode).toBeTruthy();

      // 3. PKCE challenge is preserved, and the code redeems the Entra tokens.
      await expect(provider.challengeForAuthorizationCode(client, ourCode)).resolves.toBe("chal-xyz");
      const tokens = await provider.exchangeAuthorizationCode(client, ourCode);
      expect(tokens.access_token).toBe("ado-access");
      expect(tokens.refresh_token).toBe("ado-refresh");
      expect(tokens.token_type).toBe("Bearer");

      // code is single-use
      await expect(provider.exchangeAuthorizationCode(client, ourCode)).rejects.toThrow();
    });

    it("redirects back with an error when the upstream state is unknown", async () => {
      const res = mockRes();
      await provider.handleCallback({ query: { code: "x", state: "unknown" } }, res as never);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("refresh", () => {
    it("requests new tokens from Entra with the refresh grant", async () => {
      const fetchMock = jest.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }),
      }));
      (globalThis as { fetch: unknown }).fetch = fetchMock;

      const tokens = await provider.exchangeRefreshToken(client, "old-refresh");
      expect(tokens.access_token).toBe("new-access");
      const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(init.body).toContain("grant_type=refresh_token");
      expect(init.body).toContain("old-refresh");
    });

    // A stale grant must not look like a server outage: MCP clients re-run the
    // authorization flow on invalid_grant, but report a 500 as "server not
    // responding" and give up.
    it.each([
      ["invalid_grant", "invalid_grant", 400],
      ["interaction_required", "invalid_grant", 400],
      ["invalid_client", "unauthorized_client", 400],
      ["invalid_scope", "invalid_scope", 400],
      ["invalid_request", "invalid_request", 400],
    ])("maps the Entra error '%s' to the OAuth error '%s'", async (entraError, expectedCode, expectedStatus) => {
      (globalThis as { fetch: unknown }).fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: entraError, error_description: "AADSTS70008: expired" }),
      }));

      const error = await provider.exchangeRefreshToken(client, "stale-refresh").catch((e) => e);

      expect(error.errorCode).toBe(expectedCode);
      expect(error.toResponseObject().error).toBe(expectedCode);
      expect(error).toMatchObject({ message: expect.stringContaining("AADSTS70008") });
      expect(expectedStatus).toBe(400);
    });

    it("reports an Entra outage as temporarily_unavailable rather than a server fault", async () => {
      (globalThis as { fetch: unknown }).fetch = jest.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }));

      const error = await provider.exchangeRefreshToken(client, "any").catch((e) => e);

      expect(error.errorCode).toBe("temporarily_unavailable");
    });

    it("falls back to server_error for an unrecognised 4xx", async () => {
      (globalThis as { fetch: unknown }).fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "something_new" }),
      }));

      const error = await provider.exchangeRefreshToken(client, "any").catch((e) => e);

      expect(error.errorCode).toBe("server_error");
    });
  });

  describe("authorization code errors", () => {
    it("reports an unknown code as invalid_grant", async () => {
      const error = await provider.challengeForAuthorizationCode(client, "nope").catch((e) => e);

      expect(error.errorCode).toBe("invalid_grant");
    });

    it("reports redeeming an unknown code as invalid_grant", async () => {
      const error = await provider.exchangeAuthorizationCode(client, "nope").catch((e) => e);

      expect(error.errorCode).toBe("invalid_grant");
    });
  });

  describe("verifyAccessToken", () => {
    it("verifies a JWT against the injected verifier and uses its exp", async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const verifyJwt = jest.fn(async () => ({ exp }));
      const p = new EntraOAuthProvider(config, { verifyJwt: verifyJwt as never });

      const info = await p.verifyAccessToken("header.payload.sig");

      expect(verifyJwt).toHaveBeenCalledWith("header.payload.sig");
      expect(info.token).toBe("header.payload.sig");
      expect(info.expiresAt).toBe(exp);
    });

    it("rejects a JWT that fails signature/issuer verification", async () => {
      const verifyJwt = jest.fn(async () => {
        throw new Error("signature verification failed");
      });
      const p = new EntraOAuthProvider(config, { verifyJwt: verifyJwt as never });

      // invalid_token → the 401 carries a WWW-Authenticate challenge, so the
      // client refreshes instead of treating the server as down.
      const error = await p.verifyAccessToken("header.payload.sig").catch((e) => e);
      expect(error.errorCode).toBe("invalid_token");
      expect(error.message).toMatch(/Invalid access token/);
    });

    it("accepts a non-JWT opaque token with a fallback expiry (validated downstream by ADO)", async () => {
      const verifyJwt = jest.fn();
      const p = new EntraOAuthProvider(config, { verifyJwt: verifyJwt as never });

      const info = await p.verifyAccessToken("opaque-token");

      expect(verifyJwt).not.toHaveBeenCalled(); // not a JWT → signature check skipped
      expect(info.token).toBe("opaque-token");
      expect(typeof info.expiresAt).toBe("number");
      expect(info.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});
