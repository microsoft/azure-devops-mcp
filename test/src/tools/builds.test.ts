import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from '@jest/globals';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { configureBuildTools } from '../../../src/tools/builds';
import {apiVersion} from '../../../src/utils.js';
import { 
  mockUpdateBuildStageResponse 
} from '../../mocks/builds';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureBuildTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getBuildApi: jest.Mock; serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockConnection = {
      getBuildApi: jest.fn(),
      serverUrl: "https://dev.azure.com/test-org"
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers build tools on the server", () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock)).toHaveBeenCalled();
    });
  });

  describe("update_build_stage tool", () => {
    it("should update build stage with correct parameters and return the expected result", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "build_update_build_stage"
      );
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      // Mock successful fetch response
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockUpdateBuildStageResponse))
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: true
      };
      
      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer mock-token"
          },
          body: JSON.stringify({
            forceRetryAllJobs: true,
            state: StageUpdateType.Retry.valueOf()
          })
        }
      );
      expect(result.content[0].text).toBe(JSON.stringify(JSON.stringify(mockUpdateBuildStageResponse), null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle HTTP errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "build_update_build_stage"
      );
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      // Mock failed fetch response
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Build stage not found")
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 999,
        stageName: "NonExistentStage",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: false
      };

      await expect(handler(params)).rejects.toThrow(
        "Failed to update build stage: 404 Build stage not found"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/test-org/test-project/_apis/build/builds/999/stages/NonExistentStage?api-version=${apiVersion}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer mock-token"
          },
          body: JSON.stringify({
            forceRetryAllJobs: false,
            state: StageUpdateType.Retry.valueOf()
          })
        }
      );
    });

    it("should handle network errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "build_update_build_stage"
      );
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      // Mock network error
      const networkError = new Error("Network connection failed");
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(networkError);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: false
      };

      await expect(handler(params)).rejects.toThrow("Network connection failed");

      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer mock-token"
          },
          body: JSON.stringify({
            forceRetryAllJobs: false,
            state: StageUpdateType.Retry.valueOf()
          })
        }
      );
    });

    it("should handle token provider errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "build_update_build_stage"
      );
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock token provider error
      const tokenError = new Error("Failed to get access token");
      (tokenProvider as jest.Mock).mockRejectedValue(tokenError);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: false
      };

      await expect(handler(params)).rejects.toThrow("Failed to get access token");

      // Should not call fetch if token provider fails
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle different StageUpdateType values correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "build_update_build_stage"
      );
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockUpdateBuildStageResponse))
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      // Test with Cancel status
      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Deploy",
        status: StageUpdateType.Cancel,
        forceRetryAllJobs: false
      };
      
      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            forceRetryAllJobs: false,
            state: StageUpdateType.Cancel.valueOf()
          })
        })
      );
    });
  });
});
