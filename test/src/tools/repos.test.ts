// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repos";

// Mock the auth module
jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
}));

describe("repos tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<AccessToken>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockGitApi: {
    updatePullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  beforeEach(() => {
    server = {
      tool: jest.fn(),
    } as unknown as McpServer;

    tokenProvider = jest.fn();
    mockGitApi = {
      updatePullRequest: jest.fn(),
    };

    connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });
  });

  describe("repo_update_pull_request", () => {
    it("should update pull request with all provided fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        title: "Updated Title",
        description: "Updated Description",
        isDraft: true,
      };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        title: "Updated Title",
        description: "Updated Description",
        isDraft: true,
        targetRefName: "refs/heads/main",
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          title: "Updated Title",
          description: "Updated Description",
          isDraft: true,
          targetRefName: "refs/heads/main",
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request with only title", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = { pullRequestId: 123, title: "New Title" };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        title: "New Title",
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          title: "New Title",
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request status to Active", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = { pullRequestId: 123, status: 1 }; // Active status
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        status: "Active" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          status: 1, // PullRequestStatus.Active
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request status to Abandoned", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = { pullRequestId: 123, status: 2 }; // Abandoned status
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        status: "Abandoned" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          status: 2, // PullRequestStatus.Abandoned
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request with status and other fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        title: "Updated Title",
        status: 1,
      };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        title: "Updated Title",
        status: "Active" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          title: "Updated Title",
          status: 1, // PullRequestStatus.Active
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should return error when no fields provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("At least one field (title, description, isDraft, targetRefName, or status) must be provided for update.");
    });
  });
});
