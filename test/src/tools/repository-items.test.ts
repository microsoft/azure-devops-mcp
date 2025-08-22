// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureRepositoryItemsTool } from "../../../src/tools/repository-items";
import { VersionControlRecursionType } from "azure-devops-node-api/interfaces/GitInterfaces.js";

describe("repository-items tool", () => {
  let server: McpServer;
  let tokenProvider: jest.Mock;
  let connectionProvider: jest.Mock;
  let mockGitApi: {
    getItem: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  let mockConnection: {
    getGitApi: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  beforeEach(() => {
    server = {
      tool: jest.fn(),
    } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockGitApi = { getItem: jest.fn() };
    mockConnection = { getGitApi: jest.fn().mockResolvedValue(mockGitApi) };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  function getHandler() {
    configureRepositoryItemsTool(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "get_repository_items");
    if (!call) throw new Error("get_repository_items tool not registered");
    return call[3];
  }

  describe("get_repository_items", () => {
    it("registers the tool with correct schema", () => {
      configureRepositoryItemsTool(server, tokenProvider, connectionProvider);
      expect(server.tool).toHaveBeenCalledWith(
        "get_repository_items",
        expect.any(String),
        expect.objectContaining({ project: expect.anything(), repositoryId: expect.anything(), path: expect.anything() }),
        expect.any(Function)
      );
    });

    it("returns file content when getItem succeeds", async () => {
      const handler = getHandler();
      const fakeContent = "file content here";
      mockGitApi.getItem.mockResolvedValue({ content: fakeContent });
      const input = { project: "proj", repositoryId: "repo", path: "/README.md" };
      const result = await handler(input);
      expect(mockGitApi.getItem).toHaveBeenCalledWith("repo", "/README.md", "proj", undefined, VersionControlRecursionType.None, true, false, false, undefined, true, true, true);
      expect(result.content[0].text).toContain(fakeContent);
    });

    it("passes versionDescriptor when versionDescriptor_version is provided", async () => {
      const handler = getHandler();
      mockGitApi.getItem.mockResolvedValue({ content: "abc" });
      const input = { project: "proj", repositoryId: "repo", path: "/README.md", versionDescriptor_version: "commitsha" };
      await handler(input);
      expect(mockGitApi.getItem).toHaveBeenCalledWith(
        "repo",
        "/README.md",
        "proj",
        undefined,
        VersionControlRecursionType.None,
        true,
        false,
        false,
        { version: "commitsha", versionType: 2, versionOptions: 0 },
        true,
        true,
        true
      );
    });

    it("returns error message when getItem throws", async () => {
      const handler = getHandler();
      mockGitApi.getItem.mockRejectedValue(new Error("fail!"));
      const input = { project: "proj", repositoryId: "repo", path: "/README.md" };
      const result = await handler(input);
      expect(result.content[0].text).toContain("Failed to get repository item");
      expect(result.content[0].text).toContain("fail!");
    });
  });
});
