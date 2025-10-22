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
});
