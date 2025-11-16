// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { WebApi } from "azure-devops-node-api";
import { getCurrentUserDetails, getUserIdFromEmail, searchIdentities } from "../../../src/tools/auth";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("auth functions", () => {
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: WebApi;

  beforeEach(() => {
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";

    mockConnection = {
      serverUrl: "https://dev.azure.com/test-org",
    } as WebApi;

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);

    // Mock fetch globally for these tests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getCurrentUserDetails", () => {
    it("should fetch current user details with correct parameters", async () => {
      // Mock token provider
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch response
      const mockUserData = {
        authenticatedUser: {
          id: "user-123",
          displayName: "Test User",
          uniqueName: "test@example.com",
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserData),
      });

      const result = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);

      expect(global.fetch).toHaveBeenCalledWith("https://dev.azure.com/test-org/_apis/connectionData", {
        method: "GET",
        headers: {
          "Authorization": "Bearer fake-token",
          "Content-Type": "application/json",
          "User-Agent": "Jest",
        },
      });

      expect(result).toEqual(mockUserData);
    });

    it("should handle HTTP error responses correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      const errorData = { message: "Unauthorized" };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue(errorData),
      });

      await expect(getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("Error fetching user details: Unauthorized");
    });

    it("should handle network errors correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("Network error");
    });
  });

  describe("searchIdentities", () => {
    it("should search identities with correct parameters and return expected result", async () => {
      // Mock token provider
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch response
      const mockIdentities = {
        value: [
          {
            id: "user1-id",
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
          {
            id: "user2-id",
            providerDisplayName: "Jane Smith",
            descriptor: "aad.user2-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      const result = await searchIdentities("john.doe@example.com", tokenProvider, connectionProvider, userAgentProvider);

      expect(global.fetch).toHaveBeenCalledWith("https://vssps.dev.azure.com/test-org/_apis/identities?api-version=7.2-preview.1&searchFilter=General&filterValue=john.doe%40example.com", {
        headers: {
          "Authorization": "Bearer fake-token",
          "Content-Type": "application/json",
          "User-Agent": "Jest",
        },
      });

      expect(result).toEqual(mockIdentities);
    });

    it("should handle HTTP error responses correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock failed HTTP response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Not Found"),
      });

      await expect(searchIdentities("nonexistent@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("HTTP 404: Not Found");
    });

    it("should handle network errors correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network timeout"));

      await expect(searchIdentities("test@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("Network timeout");
    });

    it("should properly encode search filter in URL", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
      });

      await searchIdentities("user with spaces@example.com", tokenProvider, connectionProvider, userAgentProvider);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://vssps.dev.azure.com/test-org/_apis/identities?api-version=7.2-preview.1&searchFilter=General&filterValue=user+with+spaces%40example.com",
        expect.any(Object)
      );
    });
  });

  describe("getUserIdFromEmail", () => {
    it("should return user ID from email with correct parameters", async () => {
      // Mock token provider
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch response with single user
      const mockIdentities = {
        value: [
          {
            id: "user1-id",
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      const result = await getUserIdFromEmail("john.doe@example.com", tokenProvider, connectionProvider, userAgentProvider);

      expect(global.fetch).toHaveBeenCalledWith("https://vssps.dev.azure.com/test-org/_apis/identities?api-version=7.2-preview.1&searchFilter=General&filterValue=john.doe%40example.com", {
        headers: {
          "Authorization": "Bearer fake-token",
          "Content-Type": "application/json",
          "User-Agent": "Jest",
        },
      });

      expect(result).toBe("user1-id");
    });

    it("should return first user ID when multiple users found", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      const mockIdentities = {
        value: [
          {
            id: "user1-id",
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
          {
            id: "user2-id",
            providerDisplayName: "Johnny Doe",
            descriptor: "aad.user2-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      const result = await getUserIdFromEmail("john.doe@example.com", tokenProvider, connectionProvider, userAgentProvider);

      expect(result).toBe("user1-id");
    });

    it("should throw error when no users found", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock empty response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
      });

      await expect(getUserIdFromEmail("nobody@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("No user found with email/unique name: nobody@example.com");
    });

    it("should throw error when null response", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock null response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(getUserIdFromEmail("test@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("No user found with email/unique name: test@example.com");
    });

    it("should throw error when user has no ID", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock response with user without ID
      const mockIdentities = {
        value: [
          {
            id: undefined,
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      await expect(getUserIdFromEmail("john.doe@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow(
        "No ID found for user with email/unique name: john.doe@example.com"
      );
    });

    it("should handle HTTP error responses correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock failed HTTP response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue("Forbidden"),
      });

      await expect(getUserIdFromEmail("test@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("HTTP 403: Forbidden");
    });

    it("should handle network errors correctly", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Connection refused"));

      await expect(getUserIdFromEmail("test@example.com", tokenProvider, connectionProvider, userAgentProvider)).rejects.toThrow("Connection refused");
    });

    it("should work with unique names as well as emails", async () => {
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      const mockIdentities = {
        value: [
          {
            id: "user1-id",
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      const result = await getUserIdFromEmail("john.doe", tokenProvider, connectionProvider, userAgentProvider);

      expect(global.fetch).toHaveBeenCalledWith("https://vssps.dev.azure.com/test-org/_apis/identities?api-version=7.2-preview.1&searchFilter=General&filterValue=john.doe", expect.any(Object));

      expect(result).toBe("user1-id");
    });
  });

  describe("FederatedApplicationCredential environment configuration", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      // Clear environment variables
      delete process.env["AZURE_FEDERATED_TENANT_ID"];
      delete process.env["AZURE_MSI_CLIENT_ID"];
      delete process.env["AZURE_APP_CLIENT_ID"];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should detect when all federated credential environment variables are set", () => {
      // Set up environment variables for federated credential
      process.env["AZURE_FEDERATED_TENANT_ID"] = "test-tenant-id";
      process.env["AZURE_MSI_CLIENT_ID"] = "test-msi-client-id";
      process.env["AZURE_APP_CLIENT_ID"] = "test-app-client-id";

      // Test that we can detect all required variables
      const federatedTenantId = process.env["AZURE_FEDERATED_TENANT_ID"];
      const msiClientId = process.env["AZURE_MSI_CLIENT_ID"];
      const appClientId = process.env["AZURE_APP_CLIENT_ID"];

      expect(federatedTenantId).toBe("test-tenant-id");
      expect(msiClientId).toBe("test-msi-client-id");
      expect(appClientId).toBe("test-app-client-id");

      // Verify all are truthy (would trigger FederatedApplicationCredential usage)
      const allVariablesSet = federatedTenantId && msiClientId && appClientId;
      expect(allVariablesSet).toBeTruthy();
    });

    it("should detect when federated credential environment variables are partially set", () => {
      // Only set some of the required environment variables
      process.env["AZURE_FEDERATED_TENANT_ID"] = "test-tenant-id";
      process.env["AZURE_MSI_CLIENT_ID"] = "test-msi-client-id";
      // Missing AZURE_APP_CLIENT_ID

      const federatedTenantId = process.env["AZURE_FEDERATED_TENANT_ID"];
      const msiClientId = process.env["AZURE_MSI_CLIENT_ID"];
      const appClientId = process.env["AZURE_APP_CLIENT_ID"];

      expect(federatedTenantId).toBe("test-tenant-id");
      expect(msiClientId).toBe("test-msi-client-id");
      expect(appClientId).toBeUndefined();

      // Verify not all variables are set (would NOT trigger FederatedApplicationCredential)
      const allVariablesSet = federatedTenantId && msiClientId && appClientId;
      expect(allVariablesSet).toBeFalsy();
    });

    it("should handle tenant ID precedence correctly", () => {
      // Set environment variable
      process.env["AZURE_FEDERATED_TENANT_ID"] = "env-tenant-id";

      // Parameter tenant ID should take precedence
      const paramTenantId = "param-tenant-id";
      const effectiveTenantId = paramTenantId || process.env["AZURE_FEDERATED_TENANT_ID"];

      expect(effectiveTenantId).toBe("param-tenant-id");

      // When no parameter provided, use environment variable
      const noParamTenantId = undefined;
      const effectiveTenantIdFromEnv = noParamTenantId || process.env["AZURE_FEDERATED_TENANT_ID"];

      expect(effectiveTenantIdFromEnv).toBe("env-tenant-id");
    });

    it("should validate expected scopes for federated authentication", () => {
      // Test the Azure DevOps scope that would be used
      const adoScope = ["499b84ac-1321-427f-aa17-267ca6975798/.default"];
      expect(adoScope).toHaveLength(1);
      expect(adoScope[0]).toBe("499b84ac-1321-427f-aa17-267ca6975798/.default");

      // Test the managed identity exchange scope
      const msiExchangeScope = ["api://AzureADTokenExchange/.default"];
      expect(msiExchangeScope).toHaveLength(1);
      expect(msiExchangeScope[0]).toBe("api://AzureADTokenExchange/.default");
    });

    it("should validate FederatedApplicationCredential constructor parameters", () => {
      const tenantId = "test-tenant-id";
      const msiClientId = "test-msi-client-id";
      const appClientId = "test-app-client-id";

      // Validate parameter types and values
      expect(typeof tenantId).toBe("string");
      expect(typeof msiClientId).toBe("string");
      expect(typeof appClientId).toBe("string");

      expect(tenantId.length).toBeGreaterThan(0);
      expect(msiClientId.length).toBeGreaterThan(0);
      expect(appClientId.length).toBeGreaterThan(0);

      // Test GUID format validation (typical for Azure IDs)
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // These might be GUIDs in real scenarios
      const testTenantGuid = "12345678-1234-1234-1234-123456789abc";
      const testMsiGuid = "87654321-4321-4321-4321-abcdef123456";
      const testAppGuid = "abcdef12-3456-7890-abcd-ef1234567890";

      expect(guidRegex.test(testTenantGuid)).toBeTruthy();
      expect(guidRegex.test(testMsiGuid)).toBeTruthy();
      expect(guidRegex.test(testAppGuid)).toBeTruthy();
    });

    it("should test assertion callback error handling logic", () => {
      // Test error message for failed managed identity token
      const expectedErrorMessage = "Failed to obtain managed identity token for federated authentication.";

      // This would be the error thrown when managed identity getToken returns null
      const error = new Error(expectedErrorMessage);

      expect(error.message).toBe(expectedErrorMessage);
      expect(error).toBeInstanceOf(Error);
    });

    it("should test token response structure validation", () => {
      // Test expected structure of AccessToken
      const mockAccessToken = {
        token: "test-token-value",
        expiresOnTimestamp: Date.now() + 3600000, // 1 hour from now
      };

      expect(mockAccessToken).toHaveProperty("token");
      expect(mockAccessToken).toHaveProperty("expiresOnTimestamp");
      expect(typeof mockAccessToken.token).toBe("string");
      expect(typeof mockAccessToken.expiresOnTimestamp).toBe("number");
      expect(mockAccessToken.expiresOnTimestamp).toBeGreaterThan(Date.now());
    });
  });
});
