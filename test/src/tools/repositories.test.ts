// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repositories";
import { PullRequestStatus, GitVersionType, GitPullRequestQueryType, CommentThreadStatus } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getCurrentUserDetails, getUserIdFromEmail } from "../../../src/tools/auth";

// Mock the auth module
jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
  getUserIdFromEmail: jest.fn(),
}));

const mockGetCurrentUserDetails = getCurrentUserDetails as jest.MockedFunction<typeof getCurrentUserDetails>;
const mockGetUserIdFromEmail = getUserIdFromEmail as jest.MockedFunction<typeof getUserIdFromEmail>;

describe("repos tools", () => {
  let server: McpServer;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
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
    updateRefs: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  let isReadOnlyMode: boolean;

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
      updateRefs: jest.fn(),
    };

    connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });

    userAgentProvider = () => "Jest";

    mockGetCurrentUserDetails.mockResolvedValue({
      authenticatedUser: { id: "user123", uniqueName: "testuser@example.com", displayName: "Test User" },
    } as any);

    isReadOnlyMode = false;
  });

  describe("tool registration", () => {
    it("registers repo tools on the server", () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });

    describe("read-only mode", () => {
      it("removes write tools when in read-only mode", () => {
        const mockTool = { remove: jest.fn(), annotations: { readOnlyHint: false } };
        (server.tool as jest.Mock).mockReturnValue(mockTool);
        isReadOnlyMode = true;

        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

        expect(mockTool.remove).toHaveBeenCalled();
      });

      it("keeps read-only tools when in read-only mode", () => {
        const mockTool = { remove: jest.fn(), annotations: { readOnlyHint: true } };
        (server.tool as jest.Mock).mockReturnValue(mockTool);
        isReadOnlyMode = true;

        configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

        expect(mockTool.remove).not.toHaveBeenCalled();
      });
    });
  });

  describe("repo_update_pull_request", () => {
    it("should update pull request with all provided fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Updated Title",
        description: "Updated Description",
        isDraft: true,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
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

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Updated Title",
        description: "Updated Description",
        isDraft: true,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should update pull request with only title", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Title",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
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

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Title",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should update pull request status to Active", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
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

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should update pull request status to Abandoned", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: PullRequestStatus.Abandoned,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
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

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: PullRequestStatus.Abandoned,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should update pull request with status and other fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Updated Title",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
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

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Updated Title",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should return error when no fields provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);

      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 123,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("At least one field (title, description, isDraft, targetRefName, status, or autoComplete options) must be provided for update.");
    });

    it("should update pull request with autocomplete enabled", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);
      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        title: "Updated PR",
        autoCompleteSetBy: { id: "user-id" },
        completionOptions: {
          mergeStrategy: 2, // Squash
          deleteSourceBranch: true,
          transitionWorkItems: true,
          bypassPolicy: false,
        },
      };

      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);
      mockGetCurrentUserDetails.mockResolvedValue({
        authenticatedUser: { id: "current-user-id" },
        authorizedUser: { id: "current-user-id" },
      });

      const params = {
        repositoryId: "test-repo-id",
        pullRequestId: 123,
        autoComplete: true,
        mergeStrategy: "Squash",
        deleteSourceBranch: true,
        transitionWorkItems: true,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCompleteSetBy: { id: "current-user-id" },
          completionOptions: expect.objectContaining({
            mergeStrategy: 2, // GitPullRequestMergeStrategy.Squash
            deleteSourceBranch: true,
            transitionWorkItems: true,
            bypassPolicy: false,
          }),
        }),
        "test-repo-id",
        123
      );
      expect(result.isError).toBeFalsy();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.pullRequestId).toBe(123);
    });

    it("should disable autocomplete when autoComplete is false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);
      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        title: "Updated PR",
        autoCompleteSetBy: null,
        completionOptions: null,
      };

      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "test-repo-id",
        pullRequestId: 123,
        autoComplete: false,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCompleteSetBy: null,
          completionOptions: null,
        }),
        "test-repo-id",
        123
      );
      expect(result.isError).toBeFalsy();
    });

    it("should not bypass policies when bypassReason is not provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);
      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "test-repo-id",
        pullRequestId: 123,
        autoComplete: true,
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCompleteSetBy: { id: "user123" },
          completionOptions: expect.objectContaining({
            bypassPolicy: false,
          }),
        }),
        "test-repo-id",
        123
      );
      expect(result.isError).toBeFalsy();
    });

    it("should automatically bypass policies when bypassReason is provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request);
      if (!call) throw new Error("repo_update_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockUpdatedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      mockGitApi.updatePullRequest.mockResolvedValue(mockUpdatedPR);

      const params = {
        repositoryId: "test-repo-id",
        pullRequestId: 123,
        autoComplete: true,
        bypassReason: "Emergency fix needed",
      };

      const result = await handler(params);

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCompleteSetBy: { id: "user123" },
          completionOptions: expect.objectContaining({
            bypassPolicy: true,
            bypassReason: "Emergency fix needed",
          }),
        }),
        "test-repo-id",
        123
      );
      expect(result.isError).toBeFalsy();
    });
  });

  describe("repo_create_pull_request", () => {
    it("should create pull request with basic fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockCreatedPR = {
        pullRequestId: 456,
        codeReviewId: 456,
        repository: { name: "test-repo" },
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Feature",
        isDraft: false,
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

      const expectedTrimmedPR = {
        pullRequestId: 456,
        codeReviewId: 456,
        repository: "test-repo",
        status: 1,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Feature",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should create pull request with all optional fields", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockCreatedPR = {
        pullRequestId: 456,
        codeReviewId: 456,
        repository: { name: "test-repo" },
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Feature",
        description: "This is a new feature",
        isDraft: true,
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
      };
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

      const expectedTrimmedPR = {
        pullRequestId: 456,
        codeReviewId: 456,
        repository: "test-repo",
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "New Feature",
        description: "This is a new feature",
        isDraft: true,
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });
  });

  describe("repo_create_branch", () => {
    it("should create branch with default source branch (main)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/main",
          objectId: "abc123def456",
        },
      ];
      const mockUpdateResult = [
        {
          success: true,
          updateStatus: 0,
        },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);
      mockGitApi.updateRefs.mockResolvedValue(mockUpdateResult);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, "heads/", false, false, undefined, false, undefined, "main");
      expect(mockGitApi.updateRefs).toHaveBeenCalledWith(
        [
          {
            name: "refs/heads/feature-branch",
            newObjectId: "abc123def456",
            oldObjectId: "0000000000000000000000000000000000000000",
          },
        ],
        "repo123"
      );

      expect(result.content[0].text).toBe("Branch 'feature-branch' created successfully from 'main' (abc123def456)");
    });

    it("should create branch with custom source branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/develop",
          objectId: "def456ghi789",
        },
      ];
      const mockUpdateResult = [
        {
          success: true,
          updateStatus: 0,
        },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);
      mockGitApi.updateRefs.mockResolvedValue(mockUpdateResult);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "develop",
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, "heads/", false, false, undefined, false, undefined, "develop");
      expect(mockGitApi.updateRefs).toHaveBeenCalledWith(
        [
          {
            name: "refs/heads/feature-branch",
            newObjectId: "def456ghi789",
            oldObjectId: "0000000000000000000000000000000000000000",
          },
        ],
        "repo123"
      );

      expect(result.content[0].text).toBe("Branch 'feature-branch' created successfully from 'develop' (def456ghi789)");
    });

    it("should create branch with specific commit ID", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockUpdateResult = [
        {
          success: true,
          updateStatus: 0,
        },
      ];

      mockGitApi.updateRefs.mockResolvedValue(mockUpdateResult);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "main",
        sourceCommitId: "xyz789abc123",
      };

      const result = await handler(params);

      // Should not call getRefs when sourceCommitId is provided
      expect(mockGitApi.getRefs).not.toHaveBeenCalled();
      expect(mockGitApi.updateRefs).toHaveBeenCalledWith(
        [
          {
            name: "refs/heads/feature-branch",
            newObjectId: "xyz789abc123",
            oldObjectId: "0000000000000000000000000000000000000000",
          },
        ],
        "repo123"
      );

      expect(result.content[0].text).toBe("Branch 'feature-branch' created successfully from 'main' (xyz789abc123)");
    });

    it("should handle source branch not found error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getRefs.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "nonexistent",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Source branch 'nonexistent' not found in repository repo123");
    });

    it("should handle getRefs API error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockError = new Error("API Error");
      mockGitApi.getRefs.mockRejectedValue(mockError);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error retrieving source branch 'main': API Error");
    });

    it("should handle updateRefs failure", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/main",
          objectId: "abc123def456",
        },
      ];
      const mockUpdateResult = [
        {
          success: false,
          customMessage: "Branch already exists",
        },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);
      mockGitApi.updateRefs.mockResolvedValue(mockUpdateResult);

      const params = {
        repositoryId: "repo123",
        branchName: "existing-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating branch 'existing-branch': Branch already exists");
    });

    it("should handle updateRefs failure without custom message", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/main",
          objectId: "abc123def456",
        },
      ];
      const mockUpdateResult = [
        {
          success: false,
        },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);
      mockGitApi.updateRefs.mockResolvedValue(mockUpdateResult);

      const params = {
        repositoryId: "repo123",
        branchName: "failing-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating branch 'failing-branch': Unknown error occurred during branch creation");
    });

    it("should handle updateRefs API error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/main",
          objectId: "abc123def456",
        },
      ];
      const mockError = new Error("Update API Error");

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);
      mockGitApi.updateRefs.mockRejectedValue(mockError);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating branch 'feature-branch': Update API Error");
    });

    it("should handle source branch with missing objectId", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_branch);
      if (!call) throw new Error("repo_create_branch tool not registered");
      const [, , , , handler] = call;

      const mockSourceBranch = [
        {
          name: "refs/heads/main",
          // objectId is missing
        },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockSourceBranch);

      const params = {
        repositoryId: "repo123",
        branchName: "feature-branch",
        sourceBranchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Source branch 'main' not found in repository repo123");
    });
  });

  describe("repo_update_pull_request_reviewers", () => {
    it("should add reviewers to pull request", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request_reviewers);
      if (!call) throw new Error("repo_update_pull_request_reviewers tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.update_pull_request_reviewers);
      if (!call) throw new Error("repo_update_pull_request_reviewers tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , , handler] = call;

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
      expect(parsedResult.map((r: { name: string }) => r.name).sort()).toEqual(["frontend-app", "frontend-web"]);
    });
  });

  describe("repo_list_pull_requests_by_repo_or_project - repository tests", () => {
    it("should list pull requests by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          status: PullRequestStatus.Active,
          createdBy: { displayName: "John Doe", uniqueName: "john@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

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

    it("should filter pull requests where I am a reviewer", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "user123" }, undefined, undefined, 0, 100);
    });

    it("should filter pull requests created by me and where I am a reviewer", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "user123", reviewerId: "user123" },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests created by specific user successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-user-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        created_by_user: "john@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("john@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", creatorId: "specific-user-123" }, undefined, undefined, 0, 100);
    });

    it("should filter pull requests by source branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by target branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          targetRefName: "refs/heads/main",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by both source and target branches", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should combine branch filters with user filters", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        {
          status: PullRequestStatus.Active,
          repositoryId: "repo123",
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          creatorId: "user123",
          reviewerId: "user123",
        },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by specific reviewer successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("reviewer-user-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "reviewer-user-123" }, undefined, undefined, 0, 100);
    });

    it("should prioritize user_is_reviewer over i_am_reviewer flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-reviewer-123");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        user_is_reviewer: "specific-reviewer@example.com",
        i_am_reviewer: true, // This should be ignored
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific-reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called since user_is_reviewer takes precedence
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123", reviewerId: "specific-reviewer-123" },
        undefined,
        undefined,
        0,
        100
      );
    });

    it("should handle error when user_is_reviewer user not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock user lookup failure
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        repositoryId: "repo123",
        user_is_reviewer: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("nonexistent@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error finding reviewer with email nonexistent@example.com: User not found");
      expect(mockGitApi.getPullRequests).not.toHaveBeenCalled();
    });
  });

  describe("repo_list_pull_requests_by_repo_or_project - project tests", () => {
    it("should list pull requests by project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

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
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
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
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by current user when created_by_me is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "My Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/my-feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 123,
          codeReviewId: 456,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-01T00:00:00Z",
          title: "My Feature PR",
          isDraft: false,
          sourceRefName: "refs/heads/my-feature-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by current user as reviewer when i_am_reviewer is true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 456,
          codeReviewId: 789,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Other User", uniqueName: "other@example.com" },
          creationDate: "2023-01-02T00:00:00Z",
          title: "Review Me PR",
          isDraft: false,
          sourceRefName: "refs/heads/review-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 456,
          codeReviewId: 789,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Other User", uniqueName: "other@example.com" },
          creationDate: "2023-01-02T00:00:00Z",
          title: "Review Me PR",
          isDraft: false,
          sourceRefName: "refs/heads/review-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter by both creator and reviewer when both created_by_me and i_am_reviewer are true", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const mockPRs = [
        {
          pullRequestId: 789,
          codeReviewId: 101112,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-03T00:00:00Z",
          title: "Both Creator and Reviewer PR",
          isDraft: false,
          sourceRefName: "refs/heads/both-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        created_by_me: true,
        i_am_reviewer: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalledWith(tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "user123", reviewerId: "user123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 789,
          codeReviewId: 101112,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Test User", uniqueName: "testuser@example.com" },
          creationDate: "2023-01-03T00:00:00Z",
          title: "Both Creator and Reviewer PR",
          isDraft: false,
          sourceRefName: "refs/heads/both-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should prioritize created_by_user over created_by_me flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock getUserIdFromEmail to return a specific user ID
      mockGetUserIdFromEmail.mockResolvedValue("specific-user-123");

      const mockPRs = [
        {
          pullRequestId: 999,
          codeReviewId: 888,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Specific User", uniqueName: "specific@example.com" },
          creationDate: "2023-01-04T00:00:00Z",
          title: "Specific User PR",
          isDraft: false,
          sourceRefName: "refs/heads/specific-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        created_by_user: "specific@example.com",
        created_by_me: true, // This should be ignored since created_by_user takes precedence
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called when created_by_user is provided
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, creatorId: "specific-user-123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 999,
          codeReviewId: 888,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Specific User", uniqueName: "specific@example.com" },
          creationDate: "2023-01-04T00:00:00Z",
          title: "Specific User PR",
          isDraft: false,
          sourceRefName: "refs/heads/specific-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter pull requests by source branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by target branch", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          targetRefName: "refs/heads/main",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by both source and target branches", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
        },
        undefined,
        0,
        100
      );
    });

    it("should combine branch filters with user filters", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        sourceRefName: "refs/heads/feature-branch",
        targetRefName: "refs/heads/main",
        created_by_me: true,
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetCurrentUserDetails).toHaveBeenCalled();
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          sourceRefName: "refs/heads/feature-branch",
          targetRefName: "refs/heads/main",
          creatorId: "user123",
        },
        undefined,
        0,
        100
      );
    });

    it("should filter pull requests by specific reviewer successfully", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("reviewer-user-123");
      const mockPRs = [
        {
          pullRequestId: 555,
          codeReviewId: 666,
          repository: { name: "test-repo" },
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Another User", uniqueName: "another@example.com" },
          creationDate: "2023-01-05T00:00:00Z",
          title: "PR Reviewed by Specific User",
          isDraft: false,
          sourceRefName: "refs/heads/reviewed-branch",
          targetRefName: "refs/heads/main",
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const params = {
        project: "test-project",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "reviewer-user-123" }, undefined, 0, 100);

      const expectedResult = [
        {
          pullRequestId: 555,
          codeReviewId: 666,
          repository: "test-repo",
          status: PullRequestStatus.Active,
          createdBy: { displayName: "Another User", uniqueName: "another@example.com" },
          creationDate: "2023-01-05T00:00:00Z",
          title: "PR Reviewed by Specific User",
          isDraft: false,
          sourceRefName: "refs/heads/reviewed-branch",
          targetRefName: "refs/heads/main",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should prioritize user_is_reviewer over i_am_reviewer flag", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock successful user lookup
      mockGetUserIdFromEmail.mockResolvedValue("specific-reviewer-123");
      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        user_is_reviewer: "specific-reviewer@example.com",
        i_am_reviewer: true, // This should be ignored
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("specific-reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled(); // Should not be called since user_is_reviewer takes precedence
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith("test-project", { status: PullRequestStatus.Active, reviewerId: "specific-reviewer-123" }, undefined, 0, 100);
    });

    it("should handle error when user_is_reviewer user not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock user lookup failure
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        project: "test-project",
        user_is_reviewer: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("nonexistent@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error finding reviewer with email nonexistent@example.com: User not found");
      expect(mockGitApi.getPullRequestsByProject).not.toHaveBeenCalled();
    });

    it("should support both created_by_user and user_is_reviewer filters simultaneously", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock both user lookups
      mockGetUserIdFromEmail
        .mockResolvedValueOnce("creator-user-123") // First call for created_by_user
        .mockResolvedValueOnce("reviewer-user-123"); // Second call for user_is_reviewer

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        created_by_user: "creator@example.com",
        user_is_reviewer: "reviewer@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("creator@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGetUserIdFromEmail).toHaveBeenCalledWith("reviewer@example.com", tokenProvider, connectionProvider, userAgentProvider);
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        {
          status: PullRequestStatus.Active,
          creatorId: "creator-user-123",
          reviewerId: "reviewer-user-123",
        },
        undefined,
        0,
        100
      );
    });
  });

  describe("repo_list_pull_request_threads", () => {
    it("should list pull request threads", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_thread_comments);
      if (!call) throw new Error("repo_list_pull_request_thread_comments tool not registered");
      const [, , , , handler] = call;

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

    it("should list pull request thread comments with full response", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_thread_comments);
      if (!call) throw new Error("repo_list_pull_request_thread_comments tool not registered");
      const [, , , , handler] = call;

      const mockComments = [
        {
          id: 1,
          author: { displayName: "John Doe", uniqueName: "john@example.com" },
          content: "This looks good",
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:30:00Z",
          lastContentUpdatedDate: "2023-01-01T00:15:00Z",
          isDeleted: false,
          // Additional properties that would be in full response
          commentType: 1,
          usersLiked: [],
          parentCommentId: 0,
        },
        {
          id: 2,
          author: { displayName: "Jane Doe", uniqueName: "jane@example.com" },
          content: "Deleted comment",
          publishedDate: "2023-01-01T01:00:00Z",
          isDeleted: true,
          commentType: 1,
          usersLiked: [],
          parentCommentId: 0,
        },
      ];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 100,
        skip: 0,
        fullResponse: true,
      };

      const result = await handler(params);

      expect(mockGitApi.getComments).toHaveBeenCalledWith("repo123", 456, 789, undefined);

      // When fullResponse is true, it should return the full comment objects without trimming
      expect(result.content[0].text).toBe(JSON.stringify(mockComments, null, 2));
    });
  });

  describe("repo_list_branches_by_repo", () => {
    it("should list branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_branches_by_repo);
      if (!call) throw new Error("repo_list_branches_by_repo tool not registered");
      const [, , , , handler] = call;

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

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, "heads/", undefined, undefined, undefined, undefined, undefined, undefined);

      const expectedResult = ["main", "feature-2", "feature-1"]; // Sorted reverse alphabetically
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_list_my_branches_by_repo", () => {
    it("should list my branches by repository", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_my_branches_by_repo);
      if (!call) throw new Error("repo_list_my_branches_by_repo tool not registered");
      const [, , , , handler] = call;

      const mockBranches = [{ name: "refs/heads/main" }, { name: "refs/heads/my-feature" }];
      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        top: 100,
      };

      const result = await handler(params);

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, "heads/", undefined, undefined, true, undefined, undefined, undefined);

      const expectedResult = ["my-feature", "main"];
      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });
  });

  describe("repo_get_repo_by_name_or_id", () => {
    it("should get repository by name", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_repo_by_name_or_id);
      if (!call) throw new Error("repo_get_repo_by_name_or_id tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , , handler] = call;

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

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo123", undefined, "heads/", false, false, undefined, false, undefined, "main");
      expect(result.content[0].text).toBe(JSON.stringify(mockBranches[0], null, 2));
    });

    it("should return error message when branch not found", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_pull_request_by_id);
      if (!call) throw new Error("repo_get_pull_request_by_id tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_pull_request_by_id);
      if (!call) throw new Error("repo_get_pull_request_by_id tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

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
            filePath: "/src/test.ts",
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

    it("should normalize file path by adding leading slash if missing", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 123 };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Thread with normalized path",
        filePath: "src/file-without-slash.ts", // Path without leading slash
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "Thread with normalized path" }],
          threadContext: {
            filePath: "/src/file-without-slash.ts", // Should have leading slash added
          },
          status: undefined,
        },
        "repo123",
        456,
        undefined
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should preserve file path if it already starts with slash", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 123 };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Thread with existing slash",
        filePath: "/src/file-with-slash.ts", // Path already has leading slash
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "Thread with existing slash" }],
          threadContext: {
            filePath: "/src/file-with-slash.ts", // Should remain unchanged
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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , , handler] = call;

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
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , , handler] = call;

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

  describe("pullRequestStatusStringToInt function coverage", () => {
    it("should handle Completed status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGetCurrentUserDetails.mockResolvedValue({
        authenticatedUser: { id: "user123" },
      });

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        status: "Completed",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Completed, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle All status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        status: "All",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.All, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle NotSet status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        status: "NotSet",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.NotSet, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should handle Abandoned status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        status: "Abandoned",
        top: 100,
        skip: 0,
      };

      await handler(params);

      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith("repo123", { status: PullRequestStatus.Abandoned, repositoryId: "repo123" }, undefined, undefined, 0, 100);
    });

    it("should throw error for unknown status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        status: "InvalidStatus",
        top: 100,
        skip: 0,
      };

      await expect(handler(params)).rejects.toThrow("Unknown pull request status: InvalidStatus");
    });
  });

  describe("error handling coverage", () => {
    it("should handle getUserIdFromEmail error in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock getUserIdFromEmail to throw an error
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle getUserIdFromEmail error in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      // Mock getUserIdFromEmail to throw an error
      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle commit search error in search_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getCommits.mockRejectedValue(new Error("API Error"));

      const params = {
        project: "test-project",
        repository: "test-repo",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching commits: API Error");
    });

    it("should handle thread creation error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      mockGitApi.createThread.mockRejectedValue(new Error("Thread creation failed"));

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
      };

      await expect(handler(params)).rejects.toThrow("Thread creation failed");
    });

    it("should handle thread resolution error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.resolve_comment);
      if (!call) throw new Error("repo_resolve_comment tool not registered");
      const [, , , , handler] = call;

      mockGitApi.updateThread.mockRejectedValue(new Error("Thread resolution failed"));

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
      };

      await expect(handler(params)).rejects.toThrow("Thread resolution failed");
    });

    it("should handle comment reply error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.reply_to_comment);
      if (!call) throw new Error("repo_reply_to_comment tool not registered");
      const [, , , , handler] = call;

      mockGitApi.createComment.mockRejectedValue(new Error("Comment creation failed"));

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        content: "Test reply",
      };

      await expect(handler(params)).rejects.toThrow("Comment creation failed");
    });
  });

  describe("edge cases and validation", () => {
    it("should handle invalid line numbers in create_pull_request_thread", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 0, // Invalid line number (should be >= 1)
      };

      await expect(handler(params)).rejects.toThrow("rightFileStartLine must be greater than or equal to 1.");
    });

    it("should handle create_pull_request with undefined forkSourceRepositoryId", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: { name: "test-repo" },
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      mockGitApi.createPullRequest.mockResolvedValue(mockPR);
      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "Test PR",
        description: undefined,
        isDraft: undefined,
        // forkSourceRepositoryId is undefined - should test the branch where it's undefined
      };

      const result = await handler(params);

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        {
          sourceRefName: "refs/heads/feature",
          targetRefName: "refs/heads/main",
          title: "Test PR",
          description: undefined,
          isDraft: undefined, // This is what actually gets passed when isDraft is not provided
          workItemRefs: [],
          forkSource: undefined, // This should be undefined when forkSourceRepositoryId is not provided
        },
        "repo123"
      );

      const expectedTrimmedPR = {
        pullRequestId: 123,
        codeReviewId: 123,
        repository: "test-repo",
        status: PullRequestStatus.Active,
        createdBy: {
          displayName: "Test User",
          uniqueName: "testuser@example.com",
        },
        creationDate: "2023-01-01T00:00:00Z",
        title: "Test PR",
        description: "",
        isDraft: false,
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
      };
      expect(result.content[0].text).toBe(JSON.stringify(expectedTrimmedPR, null, 2));
    });

    it("should handle trimComments with undefined comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , , handler] = call;

      // Mock threads with undefined comments to test the trimComments function
      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: undefined, // undefined comments
        },
        {
          id: 2,
          publishedDate: "2023-01-02T00:00:00Z",
          lastUpdatedDate: "2023-01-02T00:00:00Z",
          status: 1,
          comments: null, // null comments
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(2);
      expect(resultData[0].comments).toBeUndefined();
      expect(resultData[1].comments).toBeUndefined();
    });

    it("should handle trimComments with deleted comments", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , , handler] = call;

      // Mock threads with deleted comments to test the trimComments function
      const mockThreads = [
        {
          id: 1,
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: [
            {
              id: 1,
              content: "This is a normal comment",
              isDeleted: false,
              author: { displayName: "User 1", uniqueName: "user1@example.com" },
            },
            {
              id: 2,
              content: "This comment was deleted",
              isDeleted: true, // This should be filtered out
              author: { displayName: "User 2", uniqueName: "user2@example.com" },
            },
          ],
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(1);
      expect(resultData[0].comments).toHaveLength(1); // Only non-deleted comment should remain
      expect(resultData[0].comments[0].id).toBe(1);
    });

    it("should handle list_repos_by_project without repoNameFilter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , , handler] = call;

      const mockRepos = [
        { id: "1", name: "repo1", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "http://example.com/repo1", size: 100 },
        { id: "2", name: "repo2", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "http://example.com/repo2", size: 200 },
      ];

      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        top: 100,
        skip: 0,
        // repoNameFilter is undefined - should test the branch where it's not provided
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(2); // All repos should be returned when no filter is applied
      expect(resultData[0].name).toBe("repo1");
      expect(resultData[1].name).toBe("repo2");
    });

    it("should handle branches.find returning undefined (branch name mismatch)", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , , handler] = call;

      // Mock branches that don't match the requested branch name
      const mockBranches = [
        { name: "refs/heads/other-branch", objectId: "abc123" },
        { name: "refs/heads/another-branch", objectId: "def456" },
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        branchName: "nonexistent-branch", // This branch doesn't exist in the mock data
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Branch nonexistent-branch not found in repository repo123");
    });

    it("should handle branch.name with exact branchName match", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.get_branch_by_name);
      if (!call) throw new Error("repo_get_branch_by_name tool not registered");
      const [, , , , handler] = call;

      // Mock branches where one matches exactly with the branchName (second condition in the find)
      const mockBranches = [
        { name: "refs/heads/other-branch", objectId: "abc123" },
        { name: "main", objectId: "def456" }, // This matches the branchName directly
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
        branchName: "main",
      };

      const result = await handler(params);

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text).name).toBe("main");
    });

    it("should handle list_pull_requests_by_repo with created_by_user and i_am_reviewer both false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequests.mockResolvedValue([]);

      const params = {
        repositoryId: "repo123",
        status: "Active", // Provide explicit status to avoid undefined
        created_by_me: false,
        i_am_reviewer: false,
        top: 100, // Explicit defaults
        skip: 0, // Explicit defaults
        // created_by_user is undefined - should test the case where we don't call getCurrentUserDetails
      };

      await handler(params);

      // getCurrentUserDetails should not be called when both flags are false and created_by_user is undefined
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled();
      expect(mockGitApi.getPullRequests).toHaveBeenCalledWith(
        "repo123",
        { status: PullRequestStatus.Active, repositoryId: "repo123" },
        undefined,
        undefined,
        0, // skip
        100 // top
      );
    });

    it("should handle list_pull_requests_by_project with created_by_user and i_am_reviewer both false", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      const params = {
        project: "test-project",
        status: "Active", // Provide explicit status to avoid undefined
        created_by_me: false,
        i_am_reviewer: false,
        top: 100, // Explicit defaults
        skip: 0, // Explicit defaults
        // created_by_user is undefined - should test the case where we don't call getCurrentUserDetails
      };

      await handler(params);

      // getCurrentUserDetails should not be called when both flags are false and created_by_user is undefined
      expect(mockGetCurrentUserDetails).not.toHaveBeenCalled();
      expect(mockGitApi.getPullRequestsByProject).toHaveBeenCalledWith(
        "test-project",
        { status: PullRequestStatus.Active },
        undefined,
        0, // skip
        100 // top
      );
    });

    it("should handle comments?.flatMap with null/undefined branch in branchesFilterOutIrrelevantProperties", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_branches_by_repo);
      if (!call) throw new Error("repo_list_branches_by_repo tool not registered");
      const [, , , , handler] = call;

      // Mock branches with some having null/undefined names to test the flatMap filter
      const mockBranches = [
        { name: "refs/heads/main", objectId: "abc123" },
        { name: null, objectId: "def456" }, // null name should be filtered out
        { name: undefined, objectId: "ghi789" }, // undefined name should be filtered out
        { name: "refs/heads/feature", objectId: "jkl012" },
        { name: "refs/tags/v1.0", objectId: "mno345" }, // not a heads/ ref, should be filtered out
      ];

      mockGitApi.getRefs.mockResolvedValue(mockBranches);

      const params = {
        repositoryId: "repo123",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      // Should only include valid heads/ refs with names
      expect(resultData).toEqual(["main", "feature"]);
    });

    it("should handle rightFileStartOffset without validation error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 123, status: 1, comments: [] };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        status: "Active", // Provide explicit status
        rightFileStartLine: 5,
        rightFileStartOffset: 10, // Valid offset
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "Test comment" }],
          threadContext: {
            filePath: "/test/file.js",
            rightFileStart: { line: 5, offset: 10 },
          },
          status: CommentThreadStatus.Active,
        },
        "repo123",
        456,
        undefined
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should handle rightFileEndOffset without validation error", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 123, status: 1, comments: [] };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        status: "Active", // Provide explicit status
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        rightFileEndOffset: 15, // Valid end offset
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        {
          comments: [{ content: "Test comment" }],
          threadContext: {
            filePath: "/test/file.js",
            rightFileStart: { line: 5 },
            rightFileEnd: { line: 10, offset: 15 },
          },
          status: CommentThreadStatus.Active,
        },
        "repo123",
        456,
        undefined
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should handle search_commits with version parameter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

      const mockCommits = [{ commitId: "abc123", comment: "Test commit" }];
      mockGitApi.getCommits.mockResolvedValue(mockCommits);

      const params = {
        project: "test-project",
        repository: "test-repo",
        version: "main", // This should trigger the version branch
        versionType: "Branch",
        skip: 0, // Provide explicit values
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
      };

      const result = await handler(params);

      expect(mockGitApi.getCommits).toHaveBeenCalledWith(
        "test-repo",
        {
          fromCommitId: undefined,
          toCommitId: undefined,
          includeLinks: false,
          includeWorkItems: false,
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

    it("should handle search_commits without version parameter", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

      const mockCommits = [{ commitId: "abc123", comment: "Test commit" }];
      mockGitApi.getCommits.mockResolvedValue(mockCommits);

      const params = {
        project: "test-project",
        repository: "test-repo",
        skip: 0, // Provide explicit values
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
        // version is undefined - should test the branch where itemVersion is not set
      };

      const result = await handler(params);

      expect(mockGitApi.getCommits).toHaveBeenCalledWith(
        "test-repo",
        {
          fromCommitId: undefined,
          toCommitId: undefined,
          includeLinks: false,
          includeWorkItems: false,
          // itemVersion should not be set when version is undefined
        },
        "test-project",
        0,
        10
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockCommits, null, 2));
    });

    it("should handle rightFileEndLine without rightFileStartLine", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileEndLine: 10, // End line specified without start line
      };

      await expect(handler(params)).rejects.toThrow("rightFileEndLine must only be specified if rightFileStartLine is also specified.");
    });

    it("should handle invalid rightFileEndLine value", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileEndLine: 0, // Invalid end line
      };

      await expect(handler(params)).rejects.toThrow("rightFileEndLine must be greater than or equal to 1.");
    });

    it("should handle invalid rightFileStartOffset value", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileStartOffset: 0, // Invalid offset
      };

      await expect(handler(params)).rejects.toThrow("rightFileStartOffset must be greater than or equal to 1.");
    });

    it("should handle invalid rightFileEndOffset value", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        rightFileEndOffset: 0, // Invalid offset
      };

      await expect(handler(params)).rejects.toThrow("rightFileEndOffset must be greater than or equal to 1.");
    });

    it("should test pullRequestStatusStringToInt with unknown status", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        status: "UnknownStatus" as "Active", // Invalid status that should trigger the default case
        created_by_me: false,
        i_am_reviewer: false,
      };

      await expect(handler(params)).rejects.toThrow("Unknown pull request status: UnknownStatus");
    });

    it("should handle threads?.sort with undefined id values", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_threads);
      if (!call) throw new Error("repo_list_pull_request_threads tool not registered");
      const [, , , , handler] = call;

      // Mock threads with undefined/null id values to test the sort function
      const mockThreads = [
        {
          id: undefined, // undefined id
          publishedDate: "2023-01-03T00:00:00Z",
          lastUpdatedDate: "2023-01-03T00:00:00Z",
          status: 1,
          comments: [],
        },
        {
          id: 2,
          publishedDate: "2023-01-02T00:00:00Z",
          lastUpdatedDate: "2023-01-02T00:00:00Z",
          status: 1,
          comments: [],
        },
        {
          id: null, // null id
          publishedDate: "2023-01-01T00:00:00Z",
          lastUpdatedDate: "2023-01-01T00:00:00Z",
          status: 1,
          comments: [],
        },
      ];

      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(3); // All threads should be returned even with undefined/null ids
    });

    it("should handle comments?.sort with undefined id values", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_request_thread_comments);
      if (!call) throw new Error("repo_list_pull_request_thread_comments tool not registered");
      const [, , , , handler] = call;

      // Mock comments with undefined/null id values to test the sort function
      const mockComments = [
        {
          id: undefined, // undefined id
          content: "Comment with undefined id",
          isDeleted: false,
          author: { displayName: "User 1", uniqueName: "user1@example.com" },
        },
        {
          id: 2,
          content: "Comment with id 2",
          isDeleted: false,
          author: { displayName: "User 2", uniqueName: "user2@example.com" },
        },
        {
          id: null, // null id
          content: "Comment with null id",
          isDeleted: false,
          author: { displayName: "User 3", uniqueName: "user3@example.com" },
        },
      ];

      mockGitApi.getComments.mockResolvedValue(mockComments);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        threadId: 789,
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toHaveLength(3); // All comments should be returned even with undefined/null ids
    });

    it("should handle workItemRefs when workItems is undefined", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.createPullRequest.mockResolvedValue(mockPR);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "Test PR",
        // workItems is undefined - should test the ternary operator
      };

      await handler(params);

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          workItemRefs: [], // Should be empty array when workItems is undefined
        }),
        "repo123"
      );
    });

    it("should handle workItemRefs when workItems is provided", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request);
      if (!call) throw new Error("repo_create_pull_request tool not registered");
      const [, , , , handler] = call;

      const mockPR = { pullRequestId: 123, title: "Test PR" };
      mockGitApi.createPullRequest.mockResolvedValue(mockPR);

      const params = {
        repositoryId: "repo123",
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "Test PR",
        workItems: "123 456", // workItems provided - should be split and mapped
      };

      await handler(params);

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          workItemRefs: [{ id: "123" }, { id: "456" }], // Should be split and mapped
        }),
        "repo123"
      );
    });

    it("should handle empty repoNameFilter in list_repos_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , , handler] = call;

      const mockRepos = [{ id: "repo1", name: "Repository 1", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 }];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        repoNameFilter: "", // Empty string - should use all repositories
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      // Should return all repositories since empty string is falsy
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].name).toBe("Repository 1");
    });

    it("should handle getUserIdFromEmail error with created_by_user in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle getUserIdFromEmail error with created_by_user in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue(new Error("User not found"));

      const params = {
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: User not found");
    });

    it("should handle rightFileEndOffset set without rightFileEndLine in create_pull_request_thread", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 1, status: CommentThreadStatus.Active };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileStartOffset: 10,
        rightFileEndOffset: 20, // End offset without end line - should still work
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should handle error in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("API error"));

      const params = {
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error querying pull requests by commits: API error");
    });

    it("should handle different queryType values in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , , handler] = call;

      const mockQueryResult = { results: [] };
      mockGitApi.getPullRequestQuery.mockResolvedValue(mockQueryResult);

      const params = {
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123"],
        queryType: "Commit",
      };

      const result = await handler(params);

      expect(mockGitApi.getPullRequestQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queries: [
            expect.objectContaining({
              items: ["abc123"],
              type: expect.any(Number), // Should be the enum value for Commit
            }),
          ],
        }),
        "test-repo",
        "test-project"
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockQueryResult, null, 2));
    });

    it("should handle repositories with null/undefined names in sorting", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_repos_by_project);
      if (!call) throw new Error("repo_list_repos_by_project tool not registered");
      const [, , , , handler] = call;

      const mockRepos = [
        { id: "repo1", name: undefined, isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 1024 },
        { id: "repo2", name: "Repository B", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 2048 },
        { id: "repo3", name: null, isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url3", size: 3072 },
      ];
      mockGitApi.getRepositories.mockResolvedValue(mockRepos);

      const params = {
        project: "test-project",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      // Should handle sorting even with null/undefined names
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveLength(3);
    });

    it("should handle non-Error exceptions in list_pull_requests_by_repo", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        repositoryId: "repo123",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: String error");
    });

    it("should handle non-Error exceptions in list_pull_requests_by_project", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_repo_or_project);
      if (!call) throw new Error("repo_list_pull_requests_by_repo_or_project tool not registered");
      const [, , , , handler] = call;

      mockGetUserIdFromEmail.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        project: "test-project",
        created_by_user: "nonexistent@example.com",
        status: "Active",
        top: 100,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error finding user with email nonexistent@example.com: String error");
    });

    it("should handle non-Error exceptions in list_pull_requests_by_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.list_pull_requests_by_commits);
      if (!call) throw new Error("repo_list_pull_requests_by_commits tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getPullRequestQuery.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        project: "test-project",
        repository: "test-repo",
        commits: ["abc123", "def456"],
        queryType: "LastMergeCommit",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error querying pull requests by commits: String error");
    });

    it("should handle invalid rightFileEndOffset with rightFileEndLine in create_pull_request_thread", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        rightFileEndOffset: 0, // Invalid end offset when end line is specified
      };

      await expect(handler(params)).rejects.toThrow("rightFileEndOffset must be greater than or equal to 1.");
    });

    it("should handle non-Error exceptions in search_commits", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.search_commits);
      if (!call) throw new Error("repo_search_commits tool not registered");
      const [, , , , handler] = call;

      mockGitApi.getCommits.mockRejectedValue("String error"); // Non-Error exception

      const params = {
        project: "test-project",
        repository: "test-repo",
        top: 10,
        skip: 0,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching commits: String error");
    });

    it("should handle valid rightFileEndOffset with rightFileEndLine in create_pull_request_thread", async () => {
      configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider, isReadOnlyMode);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.create_pull_request_thread);
      if (!call) throw new Error("repo_create_pull_request_thread tool not registered");
      const [, , , , handler] = call;

      const mockThread = { id: 1, status: CommentThreadStatus.Active };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const params = {
        repositoryId: "repo123",
        pullRequestId: 456,
        content: "Test comment",
        filePath: "/test/file.js",
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        rightFileEndOffset: 20, // Valid end offset with end line
      };

      const result = await handler(params);

      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        expect.objectContaining({
          threadContext: expect.objectContaining({
            rightFileEnd: expect.objectContaining({
              line: 10,
              offset: 20,
            }),
          }),
        }),
        "repo123",
        456,
        undefined
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });
  });
});
