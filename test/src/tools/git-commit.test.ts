// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureGitCommitTools } from "../../../src/tools/git-commit";

describe("git_get_commit tool", () => {
  let server: McpServer;
  let tokenProvider: jest.Mock;
  let connectionProvider: jest.Mock;
  let mockGitApi: {
    getCommit: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  let mockConnection: {
    getGitApi: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  beforeEach(() => {
    server = {
      tool: jest.fn(),
    } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockGitApi = { getCommit: jest.fn() };
    mockConnection = { getGitApi: jest.fn().mockResolvedValue(mockGitApi) };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  function getHandler() {
    configureGitCommitTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "git_get_commit");
    if (!call) throw new Error("git_get_commit tool not registered");
    return call[3];
  }

  describe("git_get_commit", () => {
    it("registers the tool with correct schema", () => {
      configureGitCommitTools(server, tokenProvider, connectionProvider);
      expect(server.tool).toHaveBeenCalledWith(
        "git_get_commit",
        expect.any(String),
        expect.objectContaining({ project: expect.anything(), repositoryId: expect.anything(), commitId: expect.anything() }),
        expect.any(Function)
      );
    });

    it("returns commit info when getCommit succeeds", async () => {
      const handler = getHandler();
      const fakeCommit = { commitId: "abc123", comment: "test commit" };
      mockGitApi.getCommit.mockResolvedValue(fakeCommit);
      const input = { project: "proj", repositoryId: "repo", commitId: "abc123" };
      const result = await handler(input);
      expect(mockGitApi.getCommit).toHaveBeenCalledWith("abc123", "repo", "proj", undefined);
      expect(result.content[0].text).toContain("abc123");
      expect(result.content[0].text).toContain("test commit");
    });

    it("passes changeCount when provided", async () => {
      const handler = getHandler();
      mockGitApi.getCommit.mockResolvedValue({ commitId: "abc123" });
      const input = { project: "proj", repositoryId: "repo", commitId: "abc123", changeCount: 5 };
      await handler(input);
      expect(mockGitApi.getCommit).toHaveBeenCalledWith("abc123", "repo", "proj", 5);
    });
  });
});
