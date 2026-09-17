// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureProjectAnalysisTools } from "../../../src/tools/project-analysis";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface ProjectAnalysisApiMock {
  getProjectLanguageAnalytics: jest.Mock;
  getProjectActivityMetrics: jest.Mock;
  getGitRepositoriesActivityMetrics: jest.Mock;
  getRepositoryActivityMetrics: jest.Mock;
}

describe("configureProjectAnalysisTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getProjectAnalysisApi: jest.Mock };
  let mockProjectAnalysisApi: ProjectAnalysisApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockProjectAnalysisApi = {
      getProjectLanguageAnalytics: jest.fn(),
      getProjectActivityMetrics: jest.fn(),
      getGitRepositoriesActivityMetrics: jest.fn(),
      getRepositoryActivityMetrics: jest.fn(),
    };
    mockConnection = {
      getProjectAnalysisApi: jest.fn().mockResolvedValue(mockProjectAnalysisApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureProjectAnalysisTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers project analysis tools on the server", () => {
      configureProjectAnalysisTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("get_language_analytics passes the project", async () => {
    const handler = getHandler("projectanalysis_get_language_analytics");
    mockProjectAnalysisApi.getProjectLanguageAnalytics.mockResolvedValue({ resultPhase: "Full" });

    const result = await handler({ project: "Proj" });

    expect(mockProjectAnalysisApi.getProjectLanguageAnalytics).toHaveBeenCalledWith("Proj");
    expect(result.content[0].text).toContain("resultPhase");
  });

  it("get_project_activity converts date and maps aggregation (daily => 1)", async () => {
    const handler = getHandler("projectanalysis_get_project_activity");
    mockProjectAnalysisApi.getProjectActivityMetrics.mockResolvedValue({ commitsPushedCount: 5 });

    const result = await handler({ project: "Proj", fromDate: "2024-01-01T00:00:00Z", aggregation: "daily" });

    expect(mockProjectAnalysisApi.getProjectActivityMetrics).toHaveBeenCalledWith("Proj", new Date("2024-01-01T00:00:00Z"), 1);
    expect(result.content[0].text).toContain("commitsPushedCount");
  });

  it("list_repository_activity passes paging and maps aggregation (hourly => 0)", async () => {
    const handler = getHandler("projectanalysis_list_repository_activity");
    mockProjectAnalysisApi.getGitRepositoriesActivityMetrics.mockResolvedValue([{ repositoryId: "r1" }]);

    const result = await handler({ project: "Proj", fromDate: "2024-01-01T00:00:00Z", aggregation: "hourly", skip: 0, top: 50 });

    expect(mockProjectAnalysisApi.getGitRepositoriesActivityMetrics).toHaveBeenCalledWith("Proj", new Date("2024-01-01T00:00:00Z"), 0, 0, 50);
    expect(result.content[0].text).toContain("r1");
  });

  it("list_repository_activity reports when none found", async () => {
    const handler = getHandler("projectanalysis_list_repository_activity");
    mockProjectAnalysisApi.getGitRepositoriesActivityMetrics.mockResolvedValue([]);

    const result = await handler({ project: "Proj", fromDate: "2024-01-01T00:00:00Z", aggregation: "daily", skip: 0, top: 100 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No repository activity metrics found");
  });

  it("get_repository_activity passes the repository id", async () => {
    const handler = getHandler("projectanalysis_get_repository_activity");
    mockProjectAnalysisApi.getRepositoryActivityMetrics.mockResolvedValue({ repositoryId: "r1" });

    const result = await handler({ project: "Proj", repositoryId: "r1", fromDate: "2024-01-01T00:00:00Z", aggregation: "daily" });

    expect(mockProjectAnalysisApi.getRepositoryActivityMetrics).toHaveBeenCalledWith("Proj", "r1", new Date("2024-01-01T00:00:00Z"), 1);
    expect(result.content[0].text).toContain("r1");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("projectanalysis_get_language_analytics");
    mockProjectAnalysisApi.getProjectLanguageAnalytics.mockRejectedValue(new Error("boom"));

    const result = await handler({ project: "Proj" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching language analytics: boom");
  });
});
