// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureEnterpriseLiveMigrationTools } from "../../../src/tools/enterprise-live-migration";
import { apiVersion } from "../../../src/utils.js";

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

function getToolHandler(server: McpServer, toolName: string) {
  const call = (server.tool as jest.Mock).mock.calls.find(([name]: [string]) => name === toolName);
  if (!call) throw new Error(`${toolName} tool not registered`);
  return call[3]; // handler is the 4th argument
}

function mockFetchResponse(ok: boolean, body: unknown, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(text),
  } as unknown as Response;
}

describe("configureEnterpriseLiveMigrationTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: { serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue("mock-token") as TokenProviderMock;
    userAgentProvider = () => "Jest";
    mockConnection = { serverUrl: "https://dev.azure.com/test-org" };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection) as ConnectionProviderMock;
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers all 15 ELM tools on the server", () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalledTimes(15);
    });

    it("registers tools with correct names", () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const registeredNames = (server.tool as jest.Mock).mock.calls.map(([name]: [string]) => name);
      expect(registeredNames).toEqual([
        "enterprise-live-migration_list",
        "enterprise-live-migration_status",
        "enterprise-live-migration_create",
        "enterprise-live-migration_pause",
        "enterprise-live-migration_resume",
        "enterprise-live-migration_cutover_set",
        "enterprise-live-migration_cutover_cancel",
        "enterprise-live-migration_abandon",
        "enterprise-live-migration_get_cutover_review",
        "enterprise-live-migration_approve_cutover",
        "enterprise-live-migration_device_flow_config",
        "enterprise-live-migration_pipelines_list",
        "enterprise-live-migration_pipelines_submit",
        "enterprise-live-migration_pipelines_update",
        "enterprise-live-migration_pipelines_delete",
      ]);
    });
  });

  describe("enterprise-live-migration_list", () => {
    it("should call the correct URL with no params", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_list");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, [{ repositoryId: "repo-1", status: "Active" }]));

      await handler({});

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/_apis/elm/migrations?api-version=${apiVersion}`, expect.objectContaining({ method: "GET" }));
    });

    it("should include query params when provided", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_list");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, []));

      await handler({ includeAllMigrations: true, project: "my-project" });

      const calledUrl = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("includeAllMigrations=true");
      expect(calledUrl).toContain("project=my-project");
    });

    it("should return error on HTTP failure", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_list");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(false, "Not Found", 404));

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing migrations");
    });
  });

  describe("enterprise-live-migration_status", () => {
    it("should call the correct URL with repositoryId", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_status");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123", status: "Active" }));

      await handler({ repositoryId: "abc-123" });

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123?api-version=${apiVersion}`, expect.objectContaining({ method: "GET" }));
    });
  });

  describe("enterprise-live-migration_create", () => {
    it("should POST with required and optional fields", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_create");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123", status: "Active" }));

      await handler({
        repositoryId: "abc-123",
        targetRepository: "https://example.ghe.com/org/repo",
        targetOwnerUserId: "ghuser",
        validateOnly: true,
        agentPool: "my-pool",
      });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123?api-version=${apiVersion}`);
      expect(options?.method).toBe("POST");
      const body = JSON.parse(options?.body as string);
      expect(body.targetRepository).toBe("https://example.ghe.com/org/repo");
      expect(body.targetOwnerUserId).toBe("ghuser");
      expect(body.validateOnly).toBe(true);
      expect(body.agentPoolName).toBe("my-pool");
    });

    it("should convert skipValidation flags to bitmask", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_create");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123" }));

      await handler({
        repositoryId: "abc-123",
        targetRepository: "https://example.ghe.com/org/repo",
        skipValidation: ["ActivePullRequestCount", "MaxFileSize"],
      });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.skipValidation).toBe(1 | 8); // ActivePullRequestCount=1, MaxFileSize=8
    });

    it("should pass configOptions when provided", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_create");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123" }));

      await handler({
        repositoryId: "abc-123",
        targetRepository: "https://example.ghe.com/org/repo",
        configOptions: { enableAutoDiscoverPipelines: true, skipSourceRepoLockdown: false },
      });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.configOptions).toEqual({ enableAutoDiscoverPipelines: true, skipSourceRepoLockdown: false });
    });

    it("should pass gitHubUserToken when provided", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_create");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123" }));

      await handler({
        repositoryId: "abc-123",
        targetRepository: "https://example.ghe.com/org/repo",
        gitHubUserToken: "ghu_abc123",
      });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.gitHubUserToken).toBe("ghu_abc123");
      expect(body.targetOwnerUserId).toBeUndefined();
    });
  });

  describe("enterprise-live-migration_pause", () => {
    it("should PUT with statusRequested=Paused", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pause");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { status: "Paused" }));

      await handler({ repositoryId: "abc-123" });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123?api-version=${apiVersion}`);
      expect(options?.method).toBe("PUT");
      expect(JSON.parse(options?.body as string)).toEqual({ statusRequested: "Paused" });
    });
  });

  describe("enterprise-live-migration_resume", () => {
    it("should PUT with statusRequested=Active", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_resume");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { status: "Active" }));

      await handler({ repositoryId: "abc-123" });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.statusRequested).toBe("Active");
    });

    it("should include validateOnly when provided", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_resume");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { status: "Active" }));

      await handler({ repositoryId: "abc-123", validateOnly: false });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.validateOnly).toBe(false);
    });
  });

  describe("enterprise-live-migration_cutover_set", () => {
    it("should PUT with scheduledCutoverDate", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_cutover_set");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { scheduledCutoverDate: "2026-06-01T00:00:00Z" }));

      await handler({ repositoryId: "abc-123", scheduledCutoverDate: "2026-06-01T00:00:00Z" });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.scheduledCutoverDate).toBe("2026-06-01T00:00:00Z");
    });
  });

  describe("enterprise-live-migration_cutover_cancel", () => {
    it("should PUT with DateTimeOffset.MinValue sentinel", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_cutover_cancel");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { scheduledCutoverDate: null }));

      await handler({ repositoryId: "abc-123" });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.scheduledCutoverDate).toBe("0001-01-01T00:00:00+00:00");
    });
  });

  describe("enterprise-live-migration_abandon", () => {
    it("should DELETE the migration", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_abandon");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, ""));

      const result = await handler({ repositoryId: "abc-123" });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123?api-version=${apiVersion}`);
      expect(options?.method).toBe("DELETE");
      expect(result.content[0].text).toBe("Migration abandoned successfully.");
    });

    it("should include removeReadOnly query param when true", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_abandon");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, ""));

      await handler({ repositoryId: "abc-123", removeReadOnly: true });

      const calledUrl = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("removeReadOnly=true");
    });

    it("should return error on failure", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_abandon");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(false, "Migration in Cutover stage", 400));

      const result = await handler({ repositoryId: "abc-123" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error abandoning migration");
    });
  });

  describe("enterprise-live-migration_get_cutover_review", () => {
    it("should GET the cutover review endpoint", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_get_cutover_review");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { failedCount: 2, blockedCount: 0, totalUnprocessedCount: 2 }));

      await handler({ repositoryId: "abc-123" });

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123/cutoverReview?api-version=${apiVersion}`, expect.objectContaining({ method: "GET" }));
    });
  });

  describe("enterprise-live-migration_approve_cutover", () => {
    it("should PUT with cutoverFailureAcceptedCount", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_approve_cutover");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { stage: "ReadyForCutover" }));

      await handler({ repositoryId: "abc-123", cutoverFailureAcceptedCount: 3 });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.cutoverFailureAcceptedCount).toBe(3);
    });
  });

  describe("enterprise-live-migration_device_flow_config", () => {
    it("should GET the device flow config endpoint with encoded targetRepository", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_device_flow_config");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { clientId: "abc", enterpriseUrl: "https://example.ghe.com" }));

      await handler({ targetRepository: "https://example.ghe.com/org/repo" });

      const calledUrl = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("/_apis/elm/migrations/deviceFlowConfig");
      expect(calledUrl).toContain(encodeURIComponent("https://example.ghe.com/org/repo"));
    });
  });

  describe("enterprise-live-migration_pipelines_list", () => {
    it("should GET the pipelines endpoint", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_list");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { pipelines: [] }));

      await handler({ repositoryId: "abc-123" });

      expect(global.fetch).toHaveBeenCalledWith(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123/pipelines?api-version=${apiVersion}`, expect.objectContaining({ method: "GET" }));
    });
  });

  describe("enterprise-live-migration_pipelines_submit", () => {
    it("should POST with pipelineIds and serviceConnectionId", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_submit");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, [{ definitionId: 1, status: "Pending" }]));

      await handler({
        repositoryId: "abc-123",
        pipelineIds: [1, 2, 3],
        serviceConnectionId: "sc-guid",
      });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123/pipelines?api-version=${apiVersion}`);
      expect(options?.method).toBe("POST");
      const body = JSON.parse(options?.body as string);
      expect(body.pipelineIds).toEqual([1, 2, 3]);
      expect(body.serviceConnectionId).toBe("sc-guid");
    });

    it("should include repositoryMappings when provided", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_submit");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, []));

      await handler({
        repositoryId: "abc-123",
        pipelineIds: [1],
        serviceConnectionId: "sc-guid",
        repositoryMappings: [{ sourceRepositoryId: "repo-A", targetRepository: "org/repo-B" }],
      });

      const body = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string);
      expect(body.repositoryMappings).toEqual([{ sourceRepositoryId: "repo-A", targetRepository: "org/repo-B" }]);
    });
  });

  describe("enterprise-live-migration_pipelines_update", () => {
    it("should PUT with update fields", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_update");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, []));

      await handler({
        repositoryId: "abc-123",
        addPipelineIds: [4, 5],
        removePipelineIds: [1],
        retryFailedPipelineIds: [2],
        acknowledgePipelineIds: [3],
      });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123/pipelines?api-version=${apiVersion}`);
      expect(options?.method).toBe("PUT");
      const body = JSON.parse(options?.body as string);
      expect(body.addPipelineIds).toEqual([4, 5]);
      expect(body.removePipelineIds).toEqual([1]);
      expect(body.retryFailedPipelineIds).toEqual([2]);
      expect(body.acknowledgePipelineIds).toEqual([3]);
    });
  });

  describe("enterprise-live-migration_pipelines_delete", () => {
    it("should DELETE with migrationId query param", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_delete");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, ""));

      const result = await handler({ repositoryId: "abc-123", migrationId: 42 });

      const [url, options] = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe(`https://dev.azure.com/test-org/_apis/elm/migrations/abc-123/pipelines?api-version=${apiVersion}&migrationId=42`);
      expect(options?.method).toBe("DELETE");
      expect(result.content[0].text).toBe("Pipeline configurations deleted successfully.");
    });

    it("should return error on failure", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_pipelines_delete");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(false, "Migration is active", 409));

      const result = await handler({ repositoryId: "abc-123", migrationId: 42 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error deleting pipelines");
    });
  });

  describe("auth headers", () => {
    it("should include Bearer token and User-Agent in all requests", async () => {
      configureEnterpriseLiveMigrationTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const handler = getToolHandler(server, "enterprise-live-migration_status");

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockFetchResponse(true, { repositoryId: "abc-123" }));

      await handler({ repositoryId: "abc-123" });

      const headers = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer mock-token");
      expect(headers["User-Agent"]).toBe("Jest");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });
});
