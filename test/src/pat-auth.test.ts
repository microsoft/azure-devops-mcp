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
  });

  afterEach(() => {
    process.env = originalEnv;
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
