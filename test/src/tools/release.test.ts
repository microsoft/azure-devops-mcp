// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureReleaseTools } from "../../../src/tools/release";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface ReleaseApiMock {
  getReleaseDefinitions: jest.Mock;
  getReleaseDefinition: jest.Mock;
  getReleases: jest.Mock;
  getRelease: jest.Mock;
  createRelease: jest.Mock;
  getReleaseEnvironment: jest.Mock;
  updateReleaseEnvironment: jest.Mock;
  getApprovals: jest.Mock;
  updateReleaseApproval: jest.Mock;
}

describe("configureReleaseTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getReleaseApi: jest.Mock };
  let mockReleaseApi: ReleaseApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockReleaseApi = {
      getReleaseDefinitions: jest.fn(),
      getReleaseDefinition: jest.fn(),
      getReleases: jest.fn(),
      getRelease: jest.fn(),
      createRelease: jest.fn(),
      getReleaseEnvironment: jest.fn(),
      updateReleaseEnvironment: jest.fn(),
      getApprovals: jest.fn(),
      updateReleaseApproval: jest.fn(),
    };
    mockConnection = {
      getReleaseApi: jest.fn().mockResolvedValue(mockReleaseApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureReleaseTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers release tools on the server", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_definitions passes search text and top", async () => {
    const handler = getHandler("release_list_definitions");
    mockReleaseApi.getReleaseDefinitions.mockResolvedValue([{ id: 1, name: "CD" }]);

    const result = await handler({ project: "Proj", searchText: "CD", top: 10 });

    expect(mockReleaseApi.getReleaseDefinitions).toHaveBeenCalledWith("Proj", "CD", undefined, undefined, undefined, 10);
    expect(result.content[0].text).toContain("CD");
  });

  it("list_definitions reports when none found", async () => {
    const handler = getHandler("release_list_definitions");
    mockReleaseApi.getReleaseDefinitions.mockResolvedValue([]);

    const result = await handler({ project: "Proj" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No release definitions found");
  });

  it("get_definition passes the definition id", async () => {
    const handler = getHandler("release_get_definition");
    mockReleaseApi.getReleaseDefinition.mockResolvedValue({ id: 3 });

    const result = await handler({ project: "Proj", definitionId: 3 });

    expect(mockReleaseApi.getReleaseDefinition).toHaveBeenCalledWith("Proj", 3);
    expect(result.content[0].text).toContain('"id": 3');
  });

  it("list_releases maps the status filter (active => 2)", async () => {
    const handler = getHandler("release_list_releases");
    mockReleaseApi.getReleases.mockResolvedValue([{ id: 10 }]);

    const result = await handler({ project: "Proj", definitionId: 3, status: "active", top: 5 });

    expect(mockReleaseApi.getReleases).toHaveBeenCalledWith("Proj", 3, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, 5);
    expect(result.content[0].text).toContain('"id": 10');
  });

  it("get_release passes the release id", async () => {
    const handler = getHandler("release_get_release");
    mockReleaseApi.getRelease.mockResolvedValue({ id: 10 });

    const result = await handler({ project: "Proj", releaseId: 10 });

    expect(mockReleaseApi.getRelease).toHaveBeenCalledWith("Proj", 10);
    expect(result.content[0].text).toContain('"id": 10');
  });

  it("create_release builds the start metadata", async () => {
    const handler = getHandler("release_create_release");
    mockReleaseApi.createRelease.mockResolvedValue({ id: 11 });

    const result = await handler({ project: "Proj", definitionId: 3, description: "manual", isDraft: false });

    expect(mockReleaseApi.createRelease).toHaveBeenCalledWith({ definitionId: 3, description: "manual", isDraft: false, artifacts: undefined }, "Proj");
    expect(result.content[0].text).toContain('"id": 11');
  });

  it("get_environment passes release and environment ids", async () => {
    const handler = getHandler("release_get_environment");
    mockReleaseApi.getReleaseEnvironment.mockResolvedValue({ id: 100 });

    const result = await handler({ project: "Proj", releaseId: 10, environmentId: 100 });

    expect(mockReleaseApi.getReleaseEnvironment).toHaveBeenCalledWith("Proj", 10, 100);
    expect(result.content[0].text).toContain('"id": 100');
  });

  it("update_environment passes the update metadata", async () => {
    const handler = getHandler("release_update_environment");
    mockReleaseApi.updateReleaseEnvironment.mockResolvedValue({ id: 100, status: "inProgress" });

    const updateData = { status: "inProgress", comment: "deploy" };
    const result = await handler({ project: "Proj", releaseId: 10, environmentId: 100, updateData });

    expect(mockReleaseApi.updateReleaseEnvironment).toHaveBeenCalledWith(updateData, "Proj", 10, 100);
    expect(result.content[0].text).toContain("inProgress");
  });

  it("list_approvals maps the status filter (pending => 1)", async () => {
    const handler = getHandler("release_list_approvals");
    mockReleaseApi.getApprovals.mockResolvedValue([{ id: 50 }]);

    const result = await handler({ project: "Proj", status: "pending", assignedToFilter: "user@x", top: 20 });

    expect(mockReleaseApi.getApprovals).toHaveBeenCalledWith("Proj", "user@x", 1, undefined, undefined, 20);
    expect(result.content[0].text).toContain('"id": 50');
  });

  it("update_approval maps the approved status (=> 2)", async () => {
    const handler = getHandler("release_update_approval");
    mockReleaseApi.updateReleaseApproval.mockResolvedValue({ id: 50, status: 2 });

    const result = await handler({ project: "Proj", approvalId: 50, status: "approved", comments: "lgtm" });

    expect(mockReleaseApi.updateReleaseApproval).toHaveBeenCalledWith({ status: 2, comments: "lgtm" }, "Proj", 50);
    expect(result.content[0].text).toContain('"id": 50');
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("release_get_release");
    mockReleaseApi.getRelease.mockRejectedValue(new Error("boom"));

    const result = await handler({ project: "Proj", releaseId: 1 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching release: boom");
  });
});
