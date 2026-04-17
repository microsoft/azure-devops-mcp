// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";

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

import { createAuthenticator } from "../../src/auth";

describe("PAT authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["ADO_PAT"];
    delete process.env["PERSONAL_ACCESS_TOKEN"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAuthenticator('pat')", () => {
    it("should return raw PAT from ADO_PAT", async () => {
      process.env["ADO_PAT"] = "raw-pat-token";

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe("raw-pat-token");
    });

    it("should use PERSONAL_ACCESS_TOKEN when ADO_PAT is not set", async () => {
      process.env["PERSONAL_ACCESS_TOKEN"] = "raw-pat-from-personal-access-token";

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe("raw-pat-from-personal-access-token");
    });

    it("should decode legacy base64(email:pat) from PERSONAL_ACCESS_TOKEN", async () => {
      const legacy = Buffer.from("user@example.com:legacy-pat-token").toString("base64");
      process.env["PERSONAL_ACCESS_TOKEN"] = legacy;

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe("legacy-pat-token");
    });

    it("should prefer ADO_PAT over PERSONAL_ACCESS_TOKEN", async () => {
      process.env["ADO_PAT"] = "preferred-pat";
      process.env["PERSONAL_ACCESS_TOKEN"] = "fallback-pat";

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe("preferred-pat");
    });

    it("should throw if neither ADO_PAT nor PERSONAL_ACCESS_TOKEN is set", async () => {
      delete process.env["ADO_PAT"];
      delete process.env["PERSONAL_ACCESS_TOKEN"];

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'ADO_PAT' or 'PERSONAL_ACCESS_TOKEN' must be set");
    });

    it("should throw if ADO_PAT is an empty string", async () => {
      process.env["ADO_PAT"] = "";
      process.env["PERSONAL_ACCESS_TOKEN"] = "";

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'ADO_PAT' or 'PERSONAL_ACCESS_TOKEN' must be set");
    });
  });
});
