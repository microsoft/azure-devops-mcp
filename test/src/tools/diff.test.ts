// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { configureDiffTools } from "../../../src/tools/diff";

describe("repo_get_diff tool", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<AccessToken>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockGitApi: { getCommitDiffs: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockGitApi = { getCommitDiffs: jest.fn() };
    connectionProvider = jest.fn().mockResolvedValue({ getGitApi: jest.fn().mockResolvedValue(mockGitApi) });
    configureDiffTools(server, tokenProvider, connectionProvider);
  });

  it("registers the tool with correct schema", () => {
    const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "repo_get_diff");
    expect(call).toBeDefined();
    const [name, desc, schema] = call;
    expect(name).toBe("repo_get_diff");
    expect(desc).toMatch(/diff/i);
    expect(schema).toBeDefined();
    expect(schema.project).toBeDefined();
    expect(schema.repositoryId).toBeDefined();
    expect(schema.diffCommonCommit).toBeDefined();
  });

  it("calls getCommitDiffs with correct params", async () => {
    const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "repo_get_diff");
    expect(call).toBeDefined();
    const [, , , handler] = call;
    const params = {
      project: "proj",
      repositoryId: "repo",
      diffCommonCommit: true,
      top: 10,
      skip: 2,
      baseVersion: "abc",
      baseVersionType: "Commit",
      baseVersionOptions: "None",
      targetVersion: "def",
      targetVersionType: "Commit",
      targetVersionOptions: "None",
    };
    const fakeResult = { changes: [1, 2, 3] };
    mockGitApi.getCommitDiffs.mockResolvedValue(fakeResult);
    const result = await handler(params);
    expect(mockGitApi.getCommitDiffs).toHaveBeenCalledWith(
      "repo",
      "proj",
      true,
      10,
      2,
      expect.objectContaining({ version: "abc", versionType: 2, versionOptions: 0 }),
      expect.objectContaining({ version: "def", versionType: 2, versionOptions: 0 })
    );
    expect(result.content[0].text).toBe(JSON.stringify(fakeResult, null, 2));
  });
});
