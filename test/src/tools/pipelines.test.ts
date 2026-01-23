// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { configurePipelineTools } from "../../../src/tools/pipelines";
import { apiVersion } from "../../../src/utils.js";
import { mockUpdateBuildStageResponse, mockMultipleArtifacts, mockArtifact } from "../../mocks/pipelines";
import { Readable } from "stream";
import { resolve } from "path";
import { mkdirSync, createWriteStream } from "fs";

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

jest.mock("fs");

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configurePipelineTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: { getBuildApi: jest.Mock; getPipelinesApi: jest.Mock; serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("update_build_stage tool", () => {
    it("should update build stage with correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_update_build_stage");
      if (!call) throw new Error("pipelines_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      (tokenProvider as jest.Mock).mockResolvedValue("mock-token");

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
        status: "Retry",
        forceRetryAllJobs: true,
      };

      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
          "User-Agent": "Jest",
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_update_build_stage");
      if (!call) throw new Error("pipelines_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      (tokenProvider as jest.Mock).mockResolvedValue("mock-token");

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
        status: "Retry",
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Failed to update build stage: 404 Build stage not found");

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/999/stages/NonExistentStage?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
          "User-Agent": "Jest",
        },
        body: JSON.stringify({
          forceRetryAllJobs: false,
          state: StageUpdateType.Retry.valueOf(),
        }),
      });
    });

    it("should handle network errors correctly", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_update_build_stage");
      if (!call) throw new Error("pipelines_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock the token provider
      (tokenProvider as jest.Mock).mockResolvedValue("mock-token");

      // Mock network error
      const networkError = new Error("Network connection failed");
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(networkError);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: "Retry",
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Network connection failed");

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/test-project/_apis/build/builds/123/stages/Build?api-version=${apiVersion}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token",
          "User-Agent": "Jest",
        },
        body: JSON.stringify({
          forceRetryAllJobs: false,
          state: StageUpdateType.Retry.valueOf(),
        }),
      });
    });

    it("should handle token provider errors correctly", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_update_build_stage");
      if (!call) throw new Error("pipelines_update_build_stage tool not registered");
      const [, , , handler] = call;

      // Mock token provider error
      const tokenError = new Error("Failed to get access token");
      (tokenProvider as jest.Mock).mockRejectedValue(tokenError);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Build",
        status: "Retry",
        forceRetryAllJobs: false,
      };

      await expect(handler(params)).rejects.toThrow("Failed to get access token");

      // Should not call fetch if token provider fails
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle different StageUpdateType values correctly", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_update_build_stage");
      if (!call) throw new Error("pipelines_update_build_stage tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("mock-token");

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockUpdateBuildStageResponse)),
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as unknown as Response);

      const params = {
        project: "test-project",
        buildId: 123,
        stageName: "Deploy",
        status: "Cancel",
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_definitions");
      if (!call) throw new Error("pipelines_get_build_definitions tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_definitions");
      if (!call) throw new Error("pipelines_get_build_definitions tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_definition_revisions");
      if (!call) throw new Error("pipelines_get_build_definition_revisions tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_definition_revisions");
      if (!call) throw new Error("pipelines_get_build_definition_revisions tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_builds");
      if (!call) throw new Error("pipelines_get_builds tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_builds");
      if (!call) throw new Error("pipelines_get_builds tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_log");
      if (!call) throw new Error("pipelines_get_build_log tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_log");
      if (!call) throw new Error("pipelines_get_build_log tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_log_by_id");
      if (!call) throw new Error("pipelines_get_build_log_by_id tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_log_by_id");
      if (!call) throw new Error("pipelines_get_build_log_by_id tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_changes");
      if (!call) throw new Error("pipelines_get_build_changes tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_changes");
      if (!call) throw new Error("pipelines_get_build_changes tool not registered");
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
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_build_changes");
      if (!call) throw new Error("pipelines_get_build_changes tool not registered");
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

  describe("pipelines_get_run tool", () => {
    it("should call getRun with correct parameters", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_run");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        getRun: jest.fn().mockResolvedValue({ id: 1, name: "run-1" }),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
        runId: 456,
      };

      const result = await handler(params);

      expect(mockPipelinesApi.getRun).toHaveBeenCalledWith("test-project", 123, 456);
      expect(result.content[0].text).toBe(JSON.stringify({ id: 1, name: "run-1" }, null, 2));
    });

    it("should handle API errors for pipelines_get_run", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_get_run");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        getRun: jest.fn().mockRejectedValue(new Error("Run not found")),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
        runId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Run not found");
    });
  });

  describe("pipelines_create_pipeline tool", () => {
    it("should create a YAML pipeline for AzureReposGit and return created pipeline", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_create_pipeline");
      if (!call) throw new Error("pipelines_create_pipeline tool not registered");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        createPipeline: jest.fn().mockResolvedValue({ id: 100, name: "Pipeline Definition Name" }),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "ProjectName",
        name: "Pipeline Definition Name",
        yamlPath: "pipeline-definition.yml",
        repositoryType: "AzureReposGit" as const,
        repositoryName: "RepositoryName",
        repositoryId: "46DEE968-EAE5-41AA-97B1-E8B71DC287C2",
      };

      const result = await handler(params);

      expect(mockPipelinesApi.createPipeline).toHaveBeenCalledWith(
        {
          name: "Pipeline Definition Name",
          folder: "\\",
          configuration: {
            type: "Yaml",
            path: "pipeline-definition.yml",
            repository: {
              type: "AzureReposGit",
              name: "RepositoryName",
              id: "46DEE968-EAE5-41AA-97B1-E8B71DC287C2",
            },
            variables: undefined,
          },
        },
        "ProjectName"
      );

      expect(result.content[0].text).toBe(JSON.stringify({ id: 100, name: "Pipeline Definition Name" }, null, 2));
    });

    it("should create a YAML pipeline for GitHub and return created pipeline", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_create_pipeline");
      if (!call) throw new Error("pipelines_create_pipeline tool not registered");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        createPipeline: jest.fn().mockResolvedValue({ id: 200, name: "GH Pipeline" }),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "ProjectName",
        name: "GH Pipeline",
        folder: "\\",
        yamlPath: "pipeline-definition.yml",
        repositoryType: "GitHub" as const,
        repositoryName: "RepositoryName",
        repositoryConnectionId: "conn-id-123",
      };

      const result = await handler(params);

      expect(mockPipelinesApi.createPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            repository: expect.objectContaining({
              type: "GitHub",
              fullname: "RepositoryName",
              connection: {
                id: "conn-id-123",
              },
            }),
          }),
        }),
        "ProjectName"
      );

      expect(result.content[0].text).toBe(JSON.stringify({ id: 200, name: "GH Pipeline" }, null, 2));
    });

    it("should require repositoryConnectionId for GitHub repositories", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_create_pipeline");
      if (!call) throw new Error("pipelines_create_pipeline tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "ProjectName",
        name: "Pipeline Definition Name",
        folder: "\\",
        yamlPath: "pipeline-definition.yml",
        repositoryType: "GitHub" as const,
        repositoryName: "RepositoryName",
      };

      await expect(handler(params)).rejects.toThrow("Parameter 'repositoryConnectionId' is required for GitHub repositories.");
    });

    it("should propagate API errors from createPipeline", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_create_pipeline");
      if (!call) throw new Error("pipelines_create_pipeline tool not registered");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        createPipeline: jest.fn().mockRejectedValue(new Error("API failure")),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "ProjectName",
        name: "Pipeline Definition Name",
        folder: "\\",
        yamlPath: "pipeline-definition.yml",
        repositoryType: "AzureReposGit" as const,
        repositoryName: "RepositoryName",
        repositoryId: "46DEE968-EAE5-41AA-97B1-E8B71DC287C2",
      };

      await expect(handler(params)).rejects.toThrow("API failure");
    });
  });

  describe("pipelines_list_runs tool", () => {
    it("should call listRuns with correct parameters", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_list_runs");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        listRuns: jest.fn().mockResolvedValue([{ id: 1, name: "run-1" }]),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
      };

      const result = await handler(params);

      expect(mockPipelinesApi.listRuns).toHaveBeenCalledWith("test-project", 123);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "run-1" }], null, 2));
    });

    it("should handle API errors for pipelines_list_runs", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_list_runs");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        listRuns: jest.fn().mockRejectedValue(new Error("Pipeline not found")),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 999,
      };

      await expect(handler(params)).rejects.toThrow("Pipeline not found");
    });
  });

  describe("pipelines_run_pipeline tool", () => {
    it("should trigger pipeline with correct parameters", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_run_pipeline");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({ id: 456 }),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
        resources: {
          repositories: {
            self: {
              refName: "refs/heads/feature/new-feature",
            },
          },
        },
        templateParameters: { key1: "value1", key2: "value2" },
      };

      const result = await handler(params);

      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        {
          previewRun: undefined,
          resources: {
            repositories: {
              self: {
                refName: "refs/heads/feature/new-feature",
              },
            },
          },
          stagesToSkip: undefined,
          templateParameters: { key1: "value1", key2: "value2" },
          variables: undefined,
          yamlOverride: undefined,
        },
        "test-project",
        123,
        undefined
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: 456 }, null, 2));
    });

    it("should handle preview run", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_run_pipeline");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({ id: 456, finalYaml: "final yaml" }),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
        previewRun: true,
      };

      await handler(params);

      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          previewRun: true,
        }),
        "test-project",
        123,
        undefined
      );
    });

    it("should throw error for previewRun and yamlOverride", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_run_pipeline");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        pipelineId: 123,
        previewRun: false,
        yamlOverride: "some yaml",
      };

      await expect(handler(params)).rejects.toThrow("Parameter 'yamlOverride' can only be specified together with parameter 'previewRun'.");
    });

    it("should handle missing build ID from pipeline run", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_run_pipeline");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockResolvedValue({}),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
      };

      await expect(handler(params)).rejects.toThrow("Failed to get build ID from pipeline run");
    });

    it("should handle API errors for pipelines_run_pipeline", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_run_pipeline");
      if (!call) fail("Tool not found");
      const [, , , handler] = call;

      const mockPipelinesApi = {
        runPipeline: jest.fn().mockRejectedValue(new Error("API Error")),
      };
      mockConnection.getPipelinesApi.mockResolvedValue(mockPipelinesApi);

      const params = {
        project: "test-project",
        pipelineId: 123,
      };

      await expect(handler(params)).rejects.toThrow("API Error");
    });
  });

  describe("pipelines_list_artifacts", () => {
    it("should list artifacts for a given build", async () => {
      const mockGetArtifacts = jest.fn().mockResolvedValue(mockMultipleArtifacts);
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_list_artifacts");
      if (!call) throw new Error("pipelines_list_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 12345 };
      const result = await handler(params);

      expect(mockGetArtifacts).toHaveBeenCalledWith("test-project", 12345);
      expect(result.content[0].text).toContain("drop");
      expect(result.content[0].text).toContain("logs");
      expect(result.content[0].text).toContain("Container");
    });

    it("should handle empty artifact list", async () => {
      const mockGetArtifacts = jest.fn().mockResolvedValue([]);
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_list_artifacts");
      if (!call) throw new Error("pipelines_list_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 99999 };

      const result = await handler(params);

      expect(mockGetArtifacts).toHaveBeenCalledWith("test-project", 99999);
      expect(result.content[0].text).toBe("[]");
    });

    it("should handle errors when listing artifacts", async () => {
      const mockGetArtifacts = jest.fn().mockRejectedValue(new Error("Build not found"));
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_list_artifacts");
      if (!call) throw new Error("pipelines_list_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 12345 };
      await expect(handler(params)).rejects.toThrow("Build not found");
    });
  });

  describe("pipelines_download_artifact", () => {
    let mockWriteStream: any;
    let mockFileStream: Readable;

    beforeEach(() => {
      mockWriteStream = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      };
      (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
      (mkdirSync as jest.Mock).mockReturnValue(undefined);

      // Create a mock readable stream
      mockFileStream = new Readable({
        read() {
          this.push(Buffer.from("fake zip content"));
          this.push(null);
        },
      });
    });

    it("should download and save an artifact", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);
      const mockGetArtifactContentZip = jest.fn().mockResolvedValue(mockFileStream);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_download_artifact");
      if (!call) throw new Error("pipelines_download_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      const result = await handler(params);

      expect(mockGetArtifact).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mockGetArtifactContentZip).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mkdirSync).toHaveBeenCalledWith(resolve("D:\\temp\\artifacts"), { recursive: true });
      expect(createWriteStream).toHaveBeenCalledWith(expect.stringContaining("drop.zip"));
      expect(result.content[0].text).toContain("Artifact drop downloaded");
    });

    it("should handle artifact not found", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(null);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
      } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_download_artifact");
      if (!call) throw new Error("pipelines_download_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      const result = await handler(params);

      expect(result.content[0].text).toContain("Artifact drop not found");
    });

    it("should handle download errors correctly", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);
      const mockGetArtifactContentZip = jest.fn().mockRejectedValue(new Error("Network error"));

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_download_artifact");
      if (!call) throw new Error("pipelines_download_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      await expect(handler(params)).rejects.toThrow("Network error");
    });

    it("should return artifact as base64 binary when destinationPath is not provided", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);

      // Create a mock readable stream with test content
      const testContent = Buffer.from("fake zip content for binary test");
      const mockFileStream = new Readable({
        read() {
          this.push(testContent);
          this.push(null);
        },
      });

      const mockGetArtifactContentZip = jest.fn().mockResolvedValue(mockFileStream);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "pipelines_download_artifact");
      if (!call) throw new Error("pipelines_download_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        // No destinationPath provided - should return binary
      };

      const result = await handler(params);

      expect(mockGetArtifact).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mockGetArtifactContentZip).toHaveBeenCalledWith("test-project", 12345, "drop");

      // Verify the result contains base64 encoded binary content
      expect(result.content[0].type).toBe("resource");
      expect(result.content[0].resource.mimeType).toBe("application/zip");
      expect(result.content[0].resource.uri).toContain("data:application/zip;base64,");

      // Verify the base64 content matches the original
      const expectedBase64 = testContent.toString("base64");
      expect(result.content[0].resource.text).toBe(expectedBase64);
      expect(result.content[0].resource.uri).toContain(expectedBase64);
    });
  });
});
