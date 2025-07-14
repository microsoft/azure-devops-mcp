import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { configureBuildTools } from "../../../src/tools/builds";
import { apiVersion } from "../../../src/utils.js";
import { mockUpdateBuildStageResponse } from "../../mocks/builds";

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureBuildTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getBuildApi: jest.Mock; getPipelinesApi: jest.Mock; serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockConnection = {
      getBuildApi: jest.fn(),
      getPipelinesApi: jest.fn(),
      serverUrl: "https://dev.azure.com/test-org",
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers build tools on the server", () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("update_build_stage tool", () => {
    it("should update build stage with correct parameters and return the expected result", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_update_build_stage");
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      // Mock successful fetch response
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockUpdateBuildStageResponse)),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: true,
      };

      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
        },
        body: JSON.stringify({
          forceRetryAllJobs: true,
          state: StageUpdateType.Retry.valueOf(),
        }),
      });
      expect(result.content[0].text).toBe(JSON.stringify(JSON.stringify(mockUpdateBuildStageResponse), null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle HTTP errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_update_build_stage");
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      // Mock failed fetch response
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Build stage not found"),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 999,
        stageName: "NonExistentStage",
        status: StageUpdateType.Retry,
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Failed to update build stage: 404 Build stage not found");

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/999/stages/NonExistentStage?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
        },
        body: JSON.stringify({
          forceRetryAllJobs: false,
          state: StageUpdateType.Retry.valueOf(),
        }),
      });
    });

    it("should handle network errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_update_build_stage");
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
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Network connection failed");

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
        },
        body: JSON.stringify({
          forceRetryAllJobs: false,
          state: StageUpdateType.Retry.valueOf(),
        }),
      });
    });

    it("should handle token provider errors correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_update_build_stage");
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
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Failed to get access token");

      // Should not call fetch if token provider fails
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle different StageUpdateType values correctly", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_update_build_stage");
      if (!call) throw new Error("build_update_build_stage tool not registered");
      const [, , , handler] = call;

      const mockToken = { token: "mock-token" };
      (tokenProvider as jest.Mock).mockResolvedValue(mockToken);

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockUpdateBuildStageResponse)),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Deploy",
        status: StageUpdateType.Cancel,
        forceRetryAllJobs: false,
      };

      await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            forceRetryAllJobs: false,
            state: StageUpdateType.Cancel.valueOf(),
          }),
        })
      );
    });
  });

  describe("get_definitions tool", () => {
    it("should call getDefinitions with correct parameters and return expected result", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_definitions");
      if (!call) throw new Error("build_get_definitions tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinitions: jest.fn().mockResolvedValue([
          { id: 1, name: "Build Definition 1" },
          { id: 2, name: "Build Definition 2" },
        ]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        repositoryId: "repo-123",
        repositoryType: "TfsGit" as const,
        name: "test-build",
        top: 10,
      };

      const result = await handler(params);

      expect(mockBuildApi.getDefinitions).toHaveBeenCalledWith(
        "test-project",
        "test-build",
        "repo-123",
        "TfsGit",
        undefined, // queryOrder
        10, // top
        undefined, // continuationToken
        undefined, // minMetricsTime
        undefined, // definitionIds
        undefined, // path
        undefined, // builtAfter
        undefined, // notBuiltAfter
        undefined, // includeAllProperties
        undefined, // includeLatestBuilds
        undefined, // taskIdFilter
        undefined, // processType
        undefined // yamlFilename
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            { id: 1, name: "Build Definition 1" },
            { id: 2, name: "Build Definition 2" },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors for get_definitions", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_definitions");
      if (!call) throw new Error("build_get_definitions tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinitions: jest.fn().mockRejectedValue(new Error("API Error")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = { project: "test-project" };

      await expect(handler(params)).rejects.toThrow("API Error");
    });
  });

  describe("get_definition_revisions tool", () => {
    it("should call getDefinitionRevisions with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_definition_revisions");
      if (!call) throw new Error("build_get_definition_revisions tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinitionRevisions: jest.fn().mockResolvedValue([
          { revision: 1, comment: "Initial revision" },
          { revision: 2, comment: "Updated build steps" },
        ]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        definitionId: 123,
      };

      const result = await handler(params);

      expect(mockBuildApi.getDefinitionRevisions).toHaveBeenCalledWith("test-project", 123);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            { revision: 1, comment: "Initial revision" },
            { revision: 2, comment: "Updated build steps" },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors for get_definition_revisions", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_definition_revisions");
      if (!call) throw new Error("build_get_definition_revisions tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinitionRevisions: jest.fn().mockRejectedValue(new Error("Definition not found")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        definitionId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Definition not found");
    });
  });

  describe("get_builds tool", () => {
    it("should call getBuilds with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_builds");
      if (!call) throw new Error("build_get_builds tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuilds: jest.fn().mockResolvedValue([
          { id: 1, buildNumber: "20241201.1", status: "completed" },
          { id: 2, buildNumber: "20241201.2", status: "inProgress" },
        ]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        definitions: [1, 2],
        top: 5,
        branchName: "refs/heads/main",
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuilds).toHaveBeenCalledWith(
        "test-project",
        [1, 2], // definitions
        undefined, // queues
        undefined, // buildNumber
        undefined, // minTime
        undefined, // maxTime
        undefined, // requestedFor
        undefined, // reasonFilter
        undefined, // statusFilter
        undefined, // resultFilter
        undefined, // tagFilters
        undefined, // properties
        5, // top
        undefined, // continuationToken
        undefined, // maxBuildsPerDefinition
        undefined, // deletedFilter
        undefined, // queryOrder (default BuildQueryOrder.QueueTimeDescending)
        "refs/heads/main", // branchName
        undefined, // buildIds
        undefined, // repositoryId
        undefined // repositoryType
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            { id: 1, buildNumber: "20241201.1", status: "completed" },
            { id: 2, buildNumber: "20241201.2", status: "inProgress" },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors for get_builds", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_builds");
      if (!call) throw new Error("build_get_builds tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuilds: jest.fn().mockRejectedValue(new Error("Project not found")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = { project: "nonexistent-project" };

      await expect(handler(params)).rejects.toThrow("Project not found");
    });
  });

  describe("get_log tool", () => {
    it("should call getBuildLogs with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_log");
      if (!call) throw new Error("build_get_log tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildLogs: jest.fn().mockResolvedValue([
          { id: 1, lineCount: 100 },
          { id: 2, lineCount: 50 },
        ]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuildLogs).toHaveBeenCalledWith("test-project", 123);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            { id: 1, lineCount: 100 },
            { id: 2, lineCount: 50 },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors for get_log", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_log");
      if (!call) throw new Error("build_get_log tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildLogs: jest.fn().mockRejectedValue(new Error("Build not found")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Build not found");
    });
  });

  describe("get_log_by_id tool", () => {
    it("should call getBuildLogLines with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_log_by_id");
      if (!call) throw new Error("build_get_log_by_id tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildLogLines: jest.fn().mockResolvedValue(["2024-12-01T10:00:00.000Z Starting build...", "2024-12-01T10:01:00.000Z Build completed successfully"]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
        logId: 1,
        startLine: 10,
        endLine: 20,
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuildLogLines).toHaveBeenCalledWith("test-project", 123, 1, 10, 20);
      expect(result.content[0].text).toBe(JSON.stringify(["2024-12-01T10:00:00.000Z Starting build...", "2024-12-01T10:01:00.000Z Build completed successfully"], null, 2));
    });

    it("should handle API errors for get_log_by_id", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_log_by_id");
      if (!call) throw new Error("build_get_log_by_id tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildLogLines: jest.fn().mockRejectedValue(new Error("Log not found")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
        logId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Log not found");
    });
  });

  describe("get_changes tool", () => {
    it("should call getBuildChanges with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_changes");
      if (!call) throw new Error("build_get_changes tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildChanges: jest.fn().mockResolvedValue([
          { id: "abc123", message: "Fixed bug in login" },
          { id: "def456", message: "Added new feature" },
        ]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
        continuationToken: "token123",
        top: 50,
        includeSourceChange: true,
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuildChanges).toHaveBeenCalledWith("test-project", 123, "token123", 50, true);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            { id: "abc123", message: "Fixed bug in login" },
            { id: "def456", message: "Added new feature" },
          ],
          null,
          2
        )
      );
    });

    it("should use default top value when not provided", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_changes");
      if (!call) throw new Error("build_get_changes tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildChanges: jest.fn().mockResolvedValue([]),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
      };

      await handler(params);

      expect(mockBuildApi.getBuildChanges).toHaveBeenCalledWith("test-project", 123, undefined, undefined, undefined);
    });

    it("should handle API errors for get_changes", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_changes");
      if (!call) throw new Error("build_get_changes tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildChanges: jest.fn().mockRejectedValue(new Error("Changes not available")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
      };

      await expect(handler(params)).rejects.toThrow("Changes not available");
    });
  });

  describe("run_build tool", () => {
    it("should trigger build with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_run_build");
      if (!call) throw new Error("build_run_build tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinition: jest.fn().mockResolvedValue({
          repository: {
            defaultBranch: "refs/heads/main",
          },
        }),
        getBuildReport: jest.fn().mockResolvedValue({
          id: 456,
          status: "queued",
        }),
      };

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({
          id: 456,
        }),
      };

      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        definitionId: 123,
        sourceBranch: "refs/heads/feature/new-feature",
        parameters: { key1: "value1", key2: "value2" },
      };

      const result = await handler(params);

      expect(mockBuildApi.getDefinition).toHaveBeenCalledWith("test-project", 123);
      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        {
          resources: {
            repositories: {
              self: {
                refName: "refs/heads/feature/new-feature",
              },
            },
          },
          templateParameters: { key1: "value1", key2: "value2" },
        },
        "test-project",
        123
      );
      expect(mockBuildApi.getBuildReport).toHaveBeenCalledWith("test-project", 456);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 456,
            status: "queued",
          },
          null,
          2
        )
      );
    });

    it("should use default branch when sourceBranch not provided", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_run_build");
      if (!call) throw new Error("build_run_build tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinition: jest.fn().mockResolvedValue({
          repository: {
            defaultBranch: "refs/heads/develop",
          },
        }),
        getBuildReport: jest.fn().mockResolvedValue({ id: 456 }),
      };

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({ id: 456 }),
      };

      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        definitionId: 123,
      };

      await handler(params);

      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        {
          resources: {
            repositories: {
              self: {
                refName: "refs/heads/develop",
              },
            },
          },
          templateParameters: undefined,
        },
        "test-project",
        123
      );
    });

    it("should use fallback branch when no repository default branch", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_run_build");
      if (!call) throw new Error("build_run_build tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinition: jest.fn().mockResolvedValue({
          repository: null,
        }),
        getBuildReport: jest.fn().mockResolvedValue({ id: 456 }),
      };

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({ id: 456 }),
      };

      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        definitionId: 123,
      };

      await handler(params);

      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        {
          resources: {
            repositories: {
              self: {
                refName: "refs/heads/main",
              },
            },
          },
          templateParameters: undefined,
        },
        "test-project",
        123
      );
    });

    it("should handle missing build ID from pipeline run", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_run_build");
      if (!call) throw new Error("build_run_build tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinition: jest.fn().mockResolvedValue({
          repository: { defaultBranch: "refs/heads/main" },
        }),
      };

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({
          id: undefined, // Missing build ID
        }),
      };

      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);
      mockConnection.getPipelinesApi = jest.fn().mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        definitionId: 123,
      };

      await expect(handler(params)).rejects.toThrow("Failed to get build ID from pipeline run");
    });

    it("should handle API errors for run_build", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_run_build");
      if (!call) throw new Error("build_run_build tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getDefinition: jest.fn().mockRejectedValue(new Error("Definition not found")),
      };

      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        definitionId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Definition not found");
    });
  });

  describe("get_status tool", () => {
    it("should call getBuildReport with correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_status");
      if (!call) throw new Error("build_get_status tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildReport: jest.fn().mockResolvedValue({
          id: 123,
          status: "completed",
          result: "succeeded",
        }),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 123,
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuildReport).toHaveBeenCalledWith("test-project", 123);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 123,
            status: "completed",
            result: "succeeded",
          },
          null,
          2
        )
      );
    });

    it("should handle API errors for get_status", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "build_get_status");
      if (!call) throw new Error("build_get_status tool not registered");
      const [, , , handler] = call;

      const mockBuildApi = {
        getBuildReport: jest.fn().mockRejectedValue(new Error("Build not found")),
      };
      mockConnection.getBuildApi.mockResolvedValue(mockBuildApi);

      const params = {
        project: "test-project",
        buildId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Build not found");
    });
  });
});
