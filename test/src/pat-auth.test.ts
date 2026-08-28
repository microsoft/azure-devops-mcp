// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential } from "@azure/identity";
import { PublicClientApplication } from "@azure/msal-node";
import open from "open";

jest.mock("../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@azure/identity", () => ({
  AzureCliCredential: jest.fn(),
  ChainedTokenCredential: jest.fn(),
  DefaultAzureCredential: jest.fn(),
}));

jest.mock("@azure/msal-node", () => ({
  PublicClientApplication: jest.fn(),
}));

jest.mock("open", () => jest.fn());

import { createAuthenticator, installPatFetchInterceptor } from "../../src/auth";

describe("PAT authentication", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    (AzureCliCredential as unknown as jest.Mock).mockReset();
    (ChainedTokenCredential as unknown as jest.Mock).mockReset();
    (DefaultAzureCredential as unknown as jest.Mock).mockReset();
    (PublicClientApplication as unknown as jest.Mock).mockReset();
    (open as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  describe("installPatFetchInterceptor", () => {
    const basicValue = Buffer.from("user@example.com:myrawpat").toString("base64");

    it.each(["https://dev.azure.com/org", "https://vssps.dev.azure.com/org", "https://almsearch.dev.azure.com/org", "https://contoso.visualstudio.com/project"])(
      "rewrites this PAT for trusted Azure DevOps host %s",
      async (url) => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(basicValue);

        await fetch(url, { headers: { Authorization: `Bearer ${basicValue}` } });

        const rewrittenInit = fetchMock.mock.calls[0][1];
        expect(new Headers(rewrittenInit?.headers).get("Authorization")).toBe(`Basic ${basicValue}`);
      }
    );

    it.each([
      "https://attacker.example/path",
      "http://dev.azure.com/org",
      "https://dev.azure.com.attacker.example/org",
      "https://visualstudio.com",
      "https://contoso.visualstudio.com.attacker.example",
    ])("refuses to send this PAT to untrusted destination %s", async (url) => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(basicValue);

      await expect(fetch(url, { headers: { Authorization: `Bearer ${basicValue}` } })).rejects.toThrow("Refusing to send a Personal Access Token to untrusted destination");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not replace an unrelated bearer token", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(basicValue);

      await fetch("https://attacker.example/path", { headers: { Authorization: "Bearer unrelated-token" } });

      expect(fetchMock).toHaveBeenCalledWith("https://attacker.example/path", { headers: { Authorization: "Bearer unrelated-token" } });
    });

    it("passes through requests without headers", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(basicValue);

      await fetch("https://example.com/path");

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/path", undefined);
    });

    it("rewrites headers supplied by a Request object", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(basicValue);

      await fetch(new Request("https://dev.azure.com/org", { headers: { Authorization: `Bearer ${basicValue}` } }));

      const rewrittenRequest = fetchMock.mock.calls[0][0] as Request;
      expect(rewrittenRequest.headers.get("Authorization")).toBe(`Basic ${basicValue}`);
    });
  });

  describe("createAuthenticator('pat')", () => {
    it("should return the base64 value as-is from PERSONAL_ACCESS_TOKEN", async () => {
      const b64Pat = Buffer.from("user@example.com:myrawpat").toString("base64");
      process.env["PERSONAL_ACCESS_TOKEN"] = b64Pat;

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe(b64Pat);
    });

    it("should throw if PERSONAL_ACCESS_TOKEN is not set", async () => {
      delete process.env["PERSONAL_ACCESS_TOKEN"];

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty");
    });

    it("should throw if PERSONAL_ACCESS_TOKEN is an empty string", async () => {
      process.env["PERSONAL_ACCESS_TOKEN"] = "";

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty");
    });

    it("should return a different value each call if env var changes between calls", async () => {
      const b64PatA = Buffer.from("user@example.com:token-a").toString("base64");
      const b64PatB = Buffer.from("user@example.com:token-b").toString("base64");

      process.env["PERSONAL_ACCESS_TOKEN"] = b64PatA;
      const authenticator = createAuthenticator("pat");
      const resultA = await authenticator();

      process.env["PERSONAL_ACCESS_TOKEN"] = b64PatB;
      const resultB = await authenticator();

      expect(resultA).toBe(b64PatA);
      expect(resultB).toBe(b64PatB);
    });
  });

  describe("createAuthenticator('envvar')", () => {
    it("should return ADO_MCP_AUTH_TOKEN", async () => {
      process.env["ADO_MCP_AUTH_TOKEN"] = "environment-token";

      await expect(createAuthenticator("envvar")()).resolves.toBe("environment-token");
    });

    it("should throw when ADO_MCP_AUTH_TOKEN is not set", async () => {
      delete process.env["ADO_MCP_AUTH_TOKEN"];

      await expect(createAuthenticator("envvar")()).rejects.toThrow("Environment variable 'ADO_MCP_AUTH_TOKEN' is not set or empty");
    });
  });

  describe("Azure credential authentication", () => {
    it("should use DefaultAzureCredential for env authentication", async () => {
      const getToken = jest.fn().mockResolvedValue({ token: "default-token" });
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken }));
      delete process.env.AZURE_TOKEN_CREDENTIALS;

      await expect(createAuthenticator("env")()).resolves.toBe("default-token");

      expect(process.env.AZURE_TOKEN_CREDENTIALS).toBeUndefined();
      expect(getToken).toHaveBeenCalledWith(["499b84ac-1321-427f-aa17-267ca6975798/.default"]);
    });

    it("should use a tenant-specific Azure CLI credential chain for azcli authentication", async () => {
      const defaultCredential = { getToken: jest.fn() };
      const azureCliCredential = { getToken: jest.fn() };
      const getToken = jest.fn().mockResolvedValue({ token: "chained-token" });
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => defaultCredential);
      (AzureCliCredential as unknown as jest.Mock).mockImplementation(() => azureCliCredential);
      (ChainedTokenCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken }));

      await expect(createAuthenticator("azcli", "tenant-id")()).resolves.toBe("chained-token");

      expect(process.env.AZURE_TOKEN_CREDENTIALS).toBe("dev");
      expect(AzureCliCredential).toHaveBeenCalledWith({ tenantId: "tenant-id" });
      expect(ChainedTokenCredential).toHaveBeenCalledWith(azureCliCredential, defaultCredential);
    });

    it("should throw when the Azure credential returns no token", async () => {
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken: jest.fn().mockResolvedValue(null) }));

      await expect(createAuthenticator("env")()).rejects.toThrow("Failed to obtain Azure DevOps token");
    });
  });

  describe("OAuth authentication", () => {
    it("forwards MSAL log messages to the application logger", () => {
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive: jest.fn() }));

      createAuthenticator("oauth");

      const config = (PublicClientApplication as unknown as jest.Mock).mock.calls[0][0];
      expect(() => config.system.loggerOptions.loggerCallback(2, "MSAL message")).not.toThrow();
    });

    it.each([new Error("broker failure"), { platformBrokerError: { code: "broker_failure" } }])(
      "falls back to browser authentication when broker authentication rejects with %p",
      async (brokerError) => {
        const brokerAcquireTokenInteractive = jest.fn().mockRejectedValue(brokerError);
        const fallbackAcquireTokenInteractive = jest.fn().mockImplementation(async ({ openBrowser }) => {
          await openBrowser("https://login.example.com/fallback");
          return { accessToken: "fallback-token", account: null };
        });
        (PublicClientApplication as unknown as jest.Mock)
          .mockImplementationOnce(() => ({ acquireTokenInteractive: brokerAcquireTokenInteractive }))
          .mockImplementationOnce(() => ({ acquireTokenInteractive: fallbackAcquireTokenInteractive }));

        await expect(createAuthenticator("oauth")()).resolves.toBe("fallback-token");

        expect(fallbackAcquireTokenInteractive).toHaveBeenCalledWith(expect.objectContaining({ scopes: ["499b84ac-1321-427f-aa17-267ca6975798/.default"] }));
        expect(open).toHaveBeenCalledWith("https://login.example.com/fallback");
      }
    );

    it("should use tenant-specific interactive authentication, open the browser, and cache the account", async () => {
      const account = { homeAccountId: "account-id" };
      const acquireTokenSilent = jest.fn().mockResolvedValue({ accessToken: "silent-token", account });
      const acquireTokenInteractive = jest.fn().mockImplementation(async ({ openBrowser }) => {
        await openBrowser("https://login.example.com");
        return { accessToken: "interactive-token", account };
      });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenSilent, acquireTokenInteractive }));

      const authenticator = createAuthenticator("oauth", "tenant-id");

      await expect(authenticator()).resolves.toBe("interactive-token");
      await expect(authenticator()).resolves.toBe("silent-token");
      expect(PublicClientApplication).toHaveBeenCalledWith({
        auth: {
          clientId: "0d50963b-7bb9-4fe7-94c7-a99af00b5136",
          authority: "https://login.microsoftonline.com/tenant-id",
        },
      });
      expect(open).toHaveBeenCalledWith("https://login.example.com");
      expect(acquireTokenSilent).toHaveBeenCalledWith(expect.objectContaining({ account }));
      expect(acquireTokenInteractive).toHaveBeenCalledTimes(1);
    });

    it.each([new Error("silent failure"), "silent failure"])("should fall back to interactive authentication when silent acquisition rejects with %p", async (error) => {
      const account = { homeAccountId: "account-id" };
      const acquireTokenSilent = jest.fn().mockRejectedValue(error);
      const acquireTokenInteractive = jest.fn().mockResolvedValueOnce({ accessToken: "first-token", account }).mockResolvedValueOnce({ accessToken: "fallback-token", account });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenSilent, acquireTokenInteractive }));

      const authenticator = createAuthenticator("oauth");

      await expect(authenticator()).resolves.toBe("first-token");
      await expect(authenticator()).resolves.toBe("fallback-token");
      expect(acquireTokenInteractive).toHaveBeenCalledTimes(2);
    });

    it("should use the common authority for the zero tenant ID", async () => {
      const acquireTokenInteractive = jest.fn().mockResolvedValue({ accessToken: "token", account: null });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive }));

      await expect(createAuthenticator("oauth", "00000000-0000-0000-0000-000000000000")()).resolves.toBe("token");

      expect(PublicClientApplication).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ authority: "https://login.microsoftonline.com/common" }) }));
    });

    it("should throw when interactive authentication returns no access token", async () => {
      const acquireTokenInteractive = jest.fn().mockResolvedValue({ accessToken: "", account: null });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive }));

      await expect(createAuthenticator("oauth")()).rejects.toThrow("Failed to obtain Azure DevOps OAuth token");
    });
  });

  describe("PAT token extraction for WebApi handler", () => {
    it("should correctly extract raw PAT from base64(email:pat)", () => {
      const email = "user@example.com";
      const rawPat = "myRawPatToken123";
      const b64 = Buffer.from(`${email}:${rawPat}`).toString("base64");

      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const extractedPat = decoded.split(":").slice(1).join(":");

      expect(extractedPat).toBe(rawPat);
    });

    it("should correctly extract raw PAT when PAT itself contains colons", () => {
      const email = "user@example.com";
      const rawPat = "part1:part2:part3";
      const b64 = Buffer.from(`${email}:${rawPat}`).toString("base64");

      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const extractedPat = decoded.split(":").slice(1).join(":");

      expect(extractedPat).toBe(rawPat);
    });

    it("should produce a valid Basic auth header value from base64(email:pat)", () => {
      const email = "user@example.com";
      const rawPat = "myRawPatToken123";
      const b64Pat = Buffer.from(`${email}:${rawPat}`).toString("base64");

      // The fetch interceptor uses b64Pat directly as the Basic credential
      const authHeaderValue = `Basic ${b64Pat}`;

      // Verify the header can be decoded back to the expected credentials
      const decoded = Buffer.from(b64Pat, "base64").toString("utf8");
      expect(decoded).toBe(`${email}:${rawPat}`);
      expect(authHeaderValue).toBe(`Basic ${b64Pat}`);
    });
  });
});
