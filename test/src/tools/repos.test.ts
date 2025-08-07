// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { PullRequestStatus, GitVersionType, GitPullRequestQueryType, CommentThreadStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repos";
import { getCurrentUserDetails } from "../../../src/tools/auth";

// Mock the auth module
jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
}));

const mockGetCurrentUserDetails = getCurrentUserDetails as jest.MockedFunction<typeof getCurrentUserDetails>;

describe("repos tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<AccessToken>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let userAgentProvider: () => string;
  let mockGitApi: {
    updatePullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createPullRequestReviewers: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    deletePullRequestReviewer: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRepositories: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequests: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestsByProject: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getThreads: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getComments: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequest: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createComment: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    createThread: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    updateThread: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getCommits: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    getPullRequestQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  beforeEach(() => {
    server = {
      tool: jest.fn(),
    } as unknown as McpServer;

    tokenProvider = jest.fn();
    mockGitApi = {
      updatePullRequest: jest.fn(),
      createPullRequest: jest.fn(),
      createPullRequestReviewers: jest.fn(),
      deletePullRequestReviewer: jest.fn(),
      getRepositories: jest.fn(),
      getPullRequests: jest.fn(),
      getPullRequestsByProject: jest.fn(),
      getThreads: jest.fn(),
      getComments: jest.fn(),
      getRefs: jest.fn(),
      getPullRequest: jest.fn(),
      createComment: jest.fn(),
      createThread: jest.fn(),
      updateThread: jest.fn(),
      getCommits: jest.fn(),
      getPullRequestQuery: jest.fn(),
    };

    connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });

    userAgentProvider = () => "Jest";

    mockGetCurrentUserDetails.mockResolvedValue({
      authenticatedUser: { id: "user123", uniqueName: "testuser@example.com", displayName: "Test User" },
    } as any);
  });

  describe("repo_update_pull_request", () => {
    it("should update pull request with all provided fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = { pullRequestId: 123, status: PullRequestStatus.Active };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        status: "Active" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          status: PullRequestStatus.Active,
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request status to Abandoned", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = { pullRequestId: 123, status: PullRequestStatus.Abandoned };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        status: "Abandoned" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        {
          status: PullRequestStatus.Abandoned,
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should update pull request with status and other fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        title: "Updated Title",
        status: PullRequestStatus.Active,
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
          status: PullRequestStatus.Active,
        },
        "repo123",
        123
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockUpdatedPR, null, 2));
    });

    it("should return error when no fields provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

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

  describe("repo_create_pull_request", () => {
    it("should create pull request with basic fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , handler] = call;

      const mockCreatedPR = {
        pullRequestId: 456,
        title: "New Feature",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
      };
      mockGitApi.createPullRequest.mockResolvedValue(mockCreatedPR);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        title: "New Feature",
      };

      const result = await handler(params);

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        {
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          title: "New Feature",
          description: undefined,
          isDraft: undefined,
          workItemRefs: [],
          forkSource: undefined,
        },
        "repo123"
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockCreatedPR, null, 2));
    });

    it("should create pull request with all optional fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , handler] = call;

      const mockCreatedPR = { pullRequestId: 456 };
      mockGitApi.createPullRequest.mockResolvedValue(mockCreatedPR);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        title: "New Feature",
        description: "This is a new feature",
        isDraft: true,
        workItems: "1234 5678",
        forkSourceRepositoryId: "fork-repo-123",
      };

      const result = await handler(params);

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        {
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          title: "New Feature",
          description: "This is a new feature",
          isDraft: true,
          workItemRefs: [{ id: "1234" }, { id: "5678" }],
          forkSource: {
            repository: {
              id: "fork-repo-123",
            },
          },
        },
        "repo123"
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockCreatedPR, null, 2));
    });
  });

  describe("repo_update_pull_request_reviewers", () => {
    it("should add reviewers to pull request", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request_reviewers);
      if (!call) throw new Error("repo_update_pull_request_reviewers tool not registered");
      const [, , , handler] = call;

      const mockReviewers = [{ id: "reviewer1" }, { id: "reviewer2" }];
      mockGitApi.createPullRequestReviewers.mockResolvedValue(mockReviewers);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        reviewerIds: ["reviewer1", "reviewer2"],
        action: "add" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.createPullRequestReviewers).toHaveBeenCalledWith([{ id: "reviewer1" }, { id: "reviewer2" }], "repo123", 456);

      expect(result.content[0].text).toBe(JSON.stringify(mockReviewers, null, 2));
    });

    it("should remove reviewers from pull request", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request_reviewers);
      if (!call) throw new Error("repo_update_pull_request_reviewers tool not registered");
      const [, , , handler] = call;

      mockGitApi.deletePullRequestReviewer.mockResolvedValue({});

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        reviewerIds: ["reviewer1", "reviewer2"],
        action: "remove" as const,
      };

      const result = await handler(params);

      expect(mockGitApi.deletePullRequestReviewer).toHaveBeenCalledTimes(2);
      expect(mockGitApi.deletePullRequestReviewer).toHaveBeenCalledWith("repo123", 456, "reviewer1");
      expect(mockGitApi.deletePullRequestReviewer).toHaveBeenCalledWith("repo123", 456, "reviewer2");

      expect(result.content[0].text).toBe("Reviewers with IDs reviewer1, reviewer2 removed from pull request 456.");
    });
  });

  describe("repo_list_repos_by_project", () => {
    it("should list repositories by project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        {
          id: "repo1",
          name: "Repository 1",
          isDisabled: false,
          isFork: false,
          isInMaintenance: false,
          webUrl: "https://dev.azure.com/org/project/_git/repo1",
          size: 1024,
        },
        {
          id: "repo2",
          name: "Repository 2",
          isDisabled: false,
          isFork: true,
          isInMaintenance: false,
          webUrl: "https://dev.azure.com/org/project/_git/repo2",
          size: 2048,
        },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getRepositories).toHaveBeenCalledWith("test-project", false, false, false);

      const expectedTrimmedRepos = mockRepos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        isDisabled: repo.isDisabled,
        isFork: repo.isFork,
        isInMaintenance: repo.isInMaintenance,
        webUrl: repo.webUrl,
        size: repo.size,
      }));

      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedRepos, null, 2));
    });

    it("should filter repositories by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "frontend-app", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 },
        { id: "repo2", name: "backend-api", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 2048 },
        { id: "repo3", name: "frontend-web", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url3", size: 3072 },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        repoNameFilter: "frontend",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(2);
      expect(parsedResult.map((r: any) => r.name).sort()).toEqual(["frontend-app", "frontend-web"]);
    });
  });

  describe("repo_list_pull_requests_by_repo", () => {
    it("should list pull requests by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo);
      if (!call) throw new Error("repo_list_pull_requests_by_repo tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          status: PullRequestStatus.Active,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
        },
      ];
      mockGitApi.getPullRequests.mockResolvedValue(mockPRs);

      const params = {
        repositoryId: "repo123",
        top: 100,
        skip: 0,
        created_by_me: false,
        i_am_reviewer: false,
        status: "Active",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123" }, undefined, undefined, 0, 100);

      expect(result.content[0].text).toBe(JSON.stringify(mockPRs, null, 2));
    });

    it("should filter pull requests created by me", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo);
      if (!call) throw new Error("repo_list_pull_requests_by_repo tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "user123" }, undefined, undefined, 0, 100);
    });
  });

  describe("repo_list_pull_requests_by_project", () => {
    it("should list pull requests by project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_project);
      if (!call) throw new Error("repo_list_pull_requests_by_project tool not registered");
      const [, , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_list_pull_request_threads", () => {
    it("should list pull request threads", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , handler] = call;

      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T01:00:00Z",
          status: CommentThreadStatus.Active,
          comments: [
            {
              id: 1,
              author: { displayName: "John Doe", uniqueName: "john@example.com" },
              content: "This looks good",
              publishedDate: "2023-01-01T00:00:00Z",
              isDeleted: false,
              lastUpdatedDate: "2023-01-01T00:30:00Z",
              lastContentUpdatedDate: "2023-01-01T00:15:00Z",
            },
          ],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getThreads).toHaveBeenCalledWith("repo123", 456, undefined, undefined, undefined);

      const expectedResult = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T01:00:00Z",
          status: CommentThreadStatus.Active,
          comments: [
            {
              id: 1,
              author: { displayName: "John Doe", uniqueName: "john@example.com" },
              content: "This looks good",
              publishedDate: "2023-01-01T00:00:00Z",
              lastUpdatedDate: "2023-01-01T00:30:00Z",
              lastContentUpdatedDate: "2023-01-01T00:15:00Z",
            },
          ],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should return full response when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , handler] = call;

      const mockThreads = [{ id: 1, fullData: "complete" }];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        fullResponse: true,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockThreads, null, 2));
    });
  });

  describe("repo_list_pull_request_thread_comments", () => {
    it("should list pull request thread comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_thread_comments);
      if (!call) throw new Error("repo_list_pull_request_thread_comments tool not registered");
      const [, , , handler] = call;

      const mockComments = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
          isDeleted: false,
        },
        {
          id: 2,
          author: { displayName: "Jane Doe", uniqueName: "jane@example.com" },
          content: "Deleted comment",
          publishedDate: "2023-01-01T01:00:00Z",
          isDeleted: true,
        },
      ];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGitApi.getComments).toHaveBeenCalledWith("repo123", 456, 789, undefined);

      const expectedResult = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_list_branches_by_repo", () => {
    it("should list branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_branches_by_repo);
      if (!call) throw new Error("repo_list_branches_by_repo tool not registered");
      const [, , , handler] = call;

      const mockBranches = [
        { name: "refs/heads/main" },
        { name: "refs/heads/feature-1" },
        { name: "refs/heads/feature-2" },
        { name: "refs/tags/v1.0" }, // Should be filtered out
      ];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        top: 100,
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined);

      const expectedResult = ["main", "feature-2", "feature-1"]; // Sorted reverse alphabetically
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_list_my_branches_by_repo", () => {
    it("should list my branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_my_branches_by_repo);
      if (!call) throw new Error("repo_list_my_branches_by_repo tool not registered");
      const [, , , handler] = call;

      const mockBranches = [{ name: "refs/heads/main" }, { name: "refs/heads/my-feature" }];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        top: 100,
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, undefined, undefined, undefined, true);

      const expectedResult = ["my-feature", "main"];
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_get_repo_by_name_or_id", () => {
    it("should get repository by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "test-repo" },
        { id: "repo2", name: "other-repo" },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        repositoryNameOrId: "test-repo",
      };

      const result = await handler(params);

      expect(mockGitApi.getRepositories).toHaveBeenCalledWith("test-project");
      expect(result.content[0].text).toBe(JSON.stringify(mockRepos[0], null, 2));
    });

    it("should get repository by ID", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: "test-repo" },
        { id: "repo2", name: "other-repo" },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        repositoryNameOrId: "repo2",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockRepos[1], null, 2));
    });

    it("should throw error when repository not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , handler] = call;

      mockGitApi.getRepositories.mockResolvedValue([]);

      const params = {
        project: "test-project",
        repositoryNameOrId: "nonexistent-repo",
      };

      await expect(handler(params)).rejects.toThrow("Repository nonexistent-repo not found in project test-project");
    });
  });

  describe("repo_get_branch_by_name", () => {
    it("should get branch by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , handler] = call;

      const mockBranches = [
        { name: "refs/heads/main", objectId: "abc123" },
        { name: "refs/heads/feature", objectId: "def456" },
      ];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        branchName: "main",
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123");
      expect(result.content[0].text).toBe(JSON.stringify(mockBranches[0], null, 2));
    });

    it("should return error message when branch not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , handler] = call;

      mockGitApi.getRefs.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        branchName: "nonexistent",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Branch nonexistent not found in repository repo123");
    });
  });

  describe("repo_get_pull_request_by_id", () => {
    it("should get pull request by ID", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_pull_request_by_id);
      if (!call) throw new Error("repo_get_pull_request_by_id tool not registered");
      const [, , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        title: "Test PR",
        status: 1,
      };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        includeWorkItemRefs: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, false);
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should include work item refs when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_pull_request_by_id);
      if (!call) throw new Error("repo_get_pull_request_by_id tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequest.mockResolvedValue({});

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
        includeWorkItemRefs: true,
      };

      await handler(params);

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo123", 123, undefined, undefined, undefined, undefined, undefined, true);
    });
  });

  describe("repo_reply_to_comment", () => {
    it("should reply to comment successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , handler] = call;

      const mockComment = { id: 789, content: "Reply content" };
      mockGitApi.createComment.mockResolvedValue(mockComment);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        content: "Reply content",
      };

      const result = await handler(params);

      expect(mockGitApi.createComment).toHaveBeenCalledWith({ content: "Reply content" }, "repo123", 456, 789, undefined);
      expect(result.content[0].text).toBe("Comment successfully added to thread 789.");
    });

    it("should return full response when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , handler] = call;

      const mockComment = { id: 789, content: "Reply content" };
      mockGitApi.createComment.mockResolvedValue(mockComment);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        content: "Reply content",
        fullResponse: true,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockComment, null, 2));
    });

    it("should return error when comment creation fails", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , handler] = call;

      mockGitApi.createComment.mockResolvedValue(null);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        content: "Reply content",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Failed to add comment to thread 789");
    });
  });

  describe("repo_create_pull_request_thread", () => {
    it("should create pull request thread with basic content", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThread = { id: 123, status: 1 };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "New thread content",
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "New thread content" }],
          threadContext: { filePath: undefined },
          status: undefined, // Default status would be handled by CommentThreadStatus enum lookup
        },
        "repo123",
        456,
        undefined
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should create pull request thread with file context and position", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const mockThread = { id: 123 };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Thread with position",
        filePath: "src/test.ts",
        rightFileStartLine: 10,
        rightFileStartOffset: 5,
        rightFileEndLine: 12,
        rightFileEndOffset: 15,
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "Thread with position" }],
          threadContext: {
            filePath: "src/test.ts",
            rightFileStart: { line: 10, offset: 5 },
            rightFileEnd: { line: 12, offset: 15 },
          },
          status: undefined,
        },
        "repo123",
        456,
        undefined
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should throw error for invalid line numbers", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Thread content",
        rightFileStartLine: 0, // Invalid line number
      };

      await expect(handler(params)).rejects.toThrow("rightFileStartLine must be greater than or equal to 1.");
    });
  });

  describe("repo_resolve_comment", () => {
    it("should resolve comment thread successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , handler] = call;

      const mockThread = { id: 123, status: CommentThreadStatus.Fixed };
      mockGitApi.updateThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
      };

      const result = await handler(params);

      expect(mockGitApi.updateThread).toHaveBeenCalledWith({ status: CommentThreadStatus.Fixed }, "repo123", 456, 789);
      expect(result.content[0].text).toBe("Thread 789 was successfully resolved.");
    });

    it("should return full response when requested", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , handler] = call;

      const mockThread = { id: 123, status: CommentThreadStatus.Fixed };
      mockGitApi.updateThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        fullResponse: true,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should return error when thread resolution fails", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , handler] = call;

      mockGitApi.updateThread.mockResolvedValue(null);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Failed to resolve thread 789");
    });
  });

  describe("repo_search_commits", () => {
    it("should search commits successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      const mockCommits = [
        { commitId: "abc123", comment: "Initial commit" },
        { commitId: "def456", comment: "Add feature" },
      ];
      mockGitApi.getCommits.mockResolvedValue(mockCommits);

      const params = {
        project: "test-project",
        repository: "test-repo",
        version: "main",
        versionType: "Branch",
        skip: 0,
        top: 10,
      };

      const result = await handler(params);

      expect(mockGitApi.getCommits).toHaveBeenCalledWith(
        "test-repo",
        {
          fromCommitId: undefined,
          toCommitId: undefined,
          includeLinks: undefined,
          includeWorkItems: undefined,
          itemVersion: {
            version: "main",
            versionType: GitVersionType.Branch,
          },
        },
        "test-project",
        0,
        10
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockCommits, null, 2));
    });

    it("should handle commit search errors", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , handler] = call;

      mockGitApi.getCommits.mockRejectedValue(new Error("API Error"));

      const params = {
        project: "test-project",
        repository: "test-repo",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching commits: API Error");
    });
  });

  describe("repo_list_pull_requests_by_commits", () => {
    it("should list pull requests by commits successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , handler] = call;

      const mockQueryResult = {
        results: [
          {
            pullRequestId: 123,
            commit: "abc123",
          },
        ],
      };
      mockGitApi.getPullRequestQuery.mockResolvedValue(mockQueryResult);

      const params = {
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestQuery).toHaveBeenCalledWith(
        {
          queries: [
            {
              items: ["abc123", "def456"],
              type: GitPullRequestQueryType.LastMergeCommit,
            },
          ],
        },
        "test-repo",
        "test-project"
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockQueryResult, null, 2));
    });

    it("should handle pull request query errors", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("Query Error"));

      const params = {
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123"],
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error querying pull requests by commits: Query Error");
    });
  });
});
