// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Tags, commit statuses, repository lifecycle and pull request labels.
// These live apart from repositories.test.ts, which is already ~9k lines of
// pull-request cases built around its own mock shape.

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { GitStatusState } from "azure-devops-node-api/interfaces/GitInterfaces.js";

jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
  getUserIdFromEmail: jest.fn(),
}));

import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repositories";

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

const DELETED = "0".repeat(40);

describe("repo git tools", () => {
  let server: McpServer;
  let gitApi: Record<string, jest.Mock>;
  let connectionProvider: () => Promise<WebApi>;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    gitApi = {
      getRefs: jest.fn(),
      updateRefs: jest.fn(),
      getAnnotatedTag: jest.fn(),
      createAnnotatedTag: jest.fn(),
      getStatuses: jest.fn(),
      createCommitStatus: jest.fn(),
      createRepository: jest.fn(),
      deleteRepository: jest.fn(),
      getPullRequestLabels: jest.fn(),
      createPullRequestLabel: jest.fn(),
      deletePullRequestLabels: jest.fn(),
    };
    connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(gitApi),
    } as unknown as WebApi) as () => Promise<WebApi>;
  });

  function handlerFor(toolName: string): Handler {
    configureRepoTools(server, jest.fn() as () => Promise<string>, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as Handler;
  }

  const parsed = (result: { content: { text: string }[] }) => JSON.parse(result.content[0].text);

  it("registers every git tool", () => {
    configureRepoTools(server, jest.fn() as () => Promise<string>, connectionProvider, () => "Jest");
    const names = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        REPO_TOOLS.list_tags,
        REPO_TOOLS.get_tag,
        REPO_TOOLS.create_tag,
        REPO_TOOLS.delete_tag,
        REPO_TOOLS.list_commit_statuses,
        REPO_TOOLS.create_commit_status,
        REPO_TOOLS.create_repository,
        REPO_TOOLS.delete_repository,
        REPO_TOOLS.list_pull_request_labels,
        REPO_TOOLS.add_pull_request_label,
        REPO_TOOLS.remove_pull_request_label,
      ])
    );
  });

  describe("repo_list_tags", () => {
    it("asks for the tags filter and strips the refs/tags/ prefix", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v1.0.0", objectId: "tag-sha", peeledObjectId: "commit-sha" }]);

      const result = await handlerFor(REPO_TOOLS.list_tags)({ repositoryId: "repo", project: "Contoso", peelTags: true });

      expect(gitApi.getRefs).toHaveBeenCalledWith("repo", "Contoso", "tags/", false, false, undefined, false, true, undefined);
      expect(parsed(result)).toEqual([{ name: "v1.0.0", objectId: "tag-sha", peeledObjectId: "commit-sha" }]);
    });

    it("passes a name filter through", async () => {
      gitApi.getRefs.mockResolvedValue([]);

      await handlerFor(REPO_TOOLS.list_tags)({ repositoryId: "repo", project: "Contoso", nameFilter: "v1.", peelTags: false });

      expect(gitApi.getRefs).toHaveBeenCalledWith("repo", "Contoso", "tags/", false, false, undefined, false, false, "v1.");
    });

    it("surfaces an API failure as an error result", async () => {
      gitApi.getRefs.mockRejectedValue(new Error("TF401019"));

      const result = await handlerFor(REPO_TOOLS.list_tags)({ repositoryId: "repo", project: "Contoso", peelTags: false });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("TF401019");
    });
  });

  describe("repo_get_tag", () => {
    it("reports an annotated tag with its message", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v2.0.0", objectId: "tag-sha", peeledObjectId: "commit-sha" }]);
      gitApi.getAnnotatedTag.mockResolvedValue({ message: "release", taggedBy: { name: "Ada" } });

      const result = await handlerFor(REPO_TOOLS.get_tag)({ repositoryId: "repo", project: "Contoso", tagName: "v2.0.0" });

      expect(gitApi.getAnnotatedTag).toHaveBeenCalledWith("Contoso", "repo", "tag-sha");
      expect(parsed(result)).toMatchObject({ name: "v2.0.0", commitId: "commit-sha", annotated: true, message: "release" });
    });

    // A lightweight tag points straight at the commit, so there is no tag
    // object and the annotated lookup fails — that is not an error.
    it("reports a lightweight tag as not annotated", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/nightly", objectId: "commit-sha" }]);
      gitApi.getAnnotatedTag.mockRejectedValue(new Error("not found"));

      const result = await handlerFor(REPO_TOOLS.get_tag)({ repositoryId: "repo", project: "Contoso", tagName: "nightly" });

      expect(result.isError).toBeUndefined();
      expect(parsed(result)).toMatchObject({ name: "nightly", commitId: "commit-sha", annotated: false });
    });

    it("errors when no tag of that exact name exists", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/v2.0.0-rc1", objectId: "x" }]);

      const result = await handlerFor(REPO_TOOLS.get_tag)({ repositoryId: "repo", project: "Contoso", tagName: "v2.0.0" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("repo_create_tag", () => {
    it("creates the annotated tag on the given commit", async () => {
      gitApi.createAnnotatedTag.mockResolvedValue({ name: "v1.4.0", objectId: "new-tag" });

      const result = await handlerFor(REPO_TOOLS.create_tag)({ repositoryId: "repo", project: "Contoso", tagName: "v1.4.0", commitId: "abc123", message: "ship it" });

      expect(gitApi.createAnnotatedTag).toHaveBeenCalledWith({ name: "v1.4.0", message: "ship it", taggedObject: { objectId: "abc123" } }, "Contoso", "repo");
      expect(parsed(result)).toMatchObject({ name: "v1.4.0" });
    });

    it("surfaces a rejected tag name", async () => {
      gitApi.createAnnotatedTag.mockRejectedValue(new Error("tag already exists"));

      const result = await handlerFor(REPO_TOOLS.create_tag)({ repositoryId: "repo", project: "Contoso", tagName: "v1.4.0", commitId: "abc", message: "m" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("tag already exists");
    });
  });

  describe("repo_delete_tag", () => {
    it("updates the ref to the all-zero object id", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/old", objectId: "sha-1" }]);
      gitApi.updateRefs.mockResolvedValue([{ success: true }]);

      const result = await handlerFor(REPO_TOOLS.delete_tag)({ repositoryId: "repo", project: "Contoso", tagName: "old" });

      expect(gitApi.updateRefs).toHaveBeenCalledWith([{ name: "refs/tags/old", oldObjectId: "sha-1", newObjectId: DELETED }], "repo", "Contoso");
      expect(parsed(result)).toEqual({ deleted: "old", previousObjectId: "sha-1" });
    });

    // updateRefs reports per-ref failures in its result instead of throwing.
    it("reports a rejected ref update as an error", async () => {
      gitApi.getRefs.mockResolvedValue([{ name: "refs/tags/old", objectId: "sha-1" }]);
      gitApi.updateRefs.mockResolvedValue([{ success: false, updateStatus: 3 }]);

      const result = await handlerFor(REPO_TOOLS.delete_tag)({ repositoryId: "repo", project: "Contoso", tagName: "old" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to delete tag");
    });

    it("errors when the tag does not exist", async () => {
      gitApi.getRefs.mockResolvedValue([]);

      const result = await handlerFor(REPO_TOOLS.delete_tag)({ repositoryId: "repo", project: "Contoso", tagName: "ghost" });

      expect(result.isError).toBe(true);
      expect(gitApi.updateRefs).not.toHaveBeenCalled();
    });
  });

  describe("repo_list_commit_statuses", () => {
    it("passes the paging and latest-only options through", async () => {
      gitApi.getStatuses.mockResolvedValue([{ id: 1, state: GitStatusState.Succeeded }]);

      const result = await handlerFor(REPO_TOOLS.list_commit_statuses)({ repositoryId: "repo", project: "Contoso", commitId: "abc", top: 10, skip: 5, latestOnly: false });

      expect(gitApi.getStatuses).toHaveBeenCalledWith("abc", "repo", "Contoso", 10, 5, false);
      expect(parsed(result)).toHaveLength(1);
    });
  });

  describe("repo_create_commit_status", () => {
    it("converts the state name into the SDK enum and builds the context", async () => {
      gitApi.createCommitStatus.mockResolvedValue({ id: 7 });

      await handlerFor(REPO_TOOLS.create_commit_status)({
        repositoryId: "repo",
        project: "Contoso",
        commitId: "abc",
        state: "Succeeded",
        name: "license-scan",
        genre: "continuous-integration",
        description: "clean",
        targetUrl: "https://ci.example/1",
      });

      expect(gitApi.createCommitStatus).toHaveBeenCalledWith(
        {
          state: GitStatusState.Succeeded,
          description: "clean",
          targetUrl: "https://ci.example/1",
          context: { name: "license-scan", genre: "continuous-integration" },
        },
        "abc",
        "repo",
        "Contoso"
      );
    });

    it("surfaces a rejected status", async () => {
      gitApi.createCommitStatus.mockRejectedValue(new Error("commit not found"));

      const result = await handlerFor(REPO_TOOLS.create_commit_status)({ repositoryId: "repo", project: "Contoso", commitId: "bad", state: "Failed", name: "check" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("commit not found");
    });
  });

  describe("repo_create_repository", () => {
    it("creates a standalone repository", async () => {
      gitApi.createRepository.mockResolvedValue({ id: "r1", name: "new-repo" });

      const result = await handlerFor(REPO_TOOLS.create_repository)({ project: "Contoso", name: "new-repo" });

      expect(gitApi.createRepository).toHaveBeenCalledWith({ name: "new-repo" }, "Contoso", undefined);
      expect(parsed(result)).toMatchObject({ name: "new-repo" });
    });

    it("forks from a parent repository and seed ref when asked", async () => {
      gitApi.createRepository.mockResolvedValue({ id: "r2" });

      await handlerFor(REPO_TOOLS.create_repository)({ project: "Contoso", name: "fork", parentRepositoryId: "parent-id", sourceRef: "refs/heads/main" });

      expect(gitApi.createRepository).toHaveBeenCalledWith({ name: "fork", parentRepository: { id: "parent-id", project: { name: "Contoso" } } }, "Contoso", "refs/heads/main");
    });
  });

  describe("repo_delete_repository", () => {
    it("deletes by id and says where the repository went", async () => {
      gitApi.deleteRepository.mockResolvedValue(undefined);

      const result = await handlerFor(REPO_TOOLS.delete_repository)({ repositoryId: "guid-1", project: "Contoso" });

      expect(gitApi.deleteRepository).toHaveBeenCalledWith("guid-1", "Contoso");
      expect(parsed(result)).toMatchObject({ deleted: "guid-1" });
      expect(result.content[0].text).toContain("recycle bin");
    });

    it("surfaces a refused deletion", async () => {
      gitApi.deleteRepository.mockRejectedValue(new Error("TF401019: insufficient permissions"));

      const result = await handlerFor(REPO_TOOLS.delete_repository)({ repositoryId: "guid-1", project: "Contoso" });

      expect(result.isError).toBe(true);
    });
  });

  describe("pull request labels", () => {
    it("lists the labels of a pull request", async () => {
      gitApi.getPullRequestLabels.mockResolvedValue([{ id: "l1", name: "needs-docs", active: true }]);

      const result = await handlerFor(REPO_TOOLS.list_pull_request_labels)({ repositoryId: "repo", pullRequestId: 42, project: "Contoso" });

      expect(gitApi.getPullRequestLabels).toHaveBeenCalledWith("repo", 42, "Contoso");
      expect(parsed(result)).toEqual([{ id: "l1", name: "needs-docs", active: true }]);
    });

    it("adds one label without touching the others", async () => {
      gitApi.createPullRequestLabel.mockResolvedValue({ id: "l2", name: "hotfix" });

      await handlerFor(REPO_TOOLS.add_pull_request_label)({ repositoryId: "repo", pullRequestId: 42, project: "Contoso", label: "hotfix" });

      expect(gitApi.createPullRequestLabel).toHaveBeenCalledWith({ name: "hotfix" }, "repo", 42, "Contoso");
    });

    it("removes one label by name", async () => {
      gitApi.deletePullRequestLabels.mockResolvedValue(undefined);

      const result = await handlerFor(REPO_TOOLS.remove_pull_request_label)({ repositoryId: "repo", pullRequestId: 42, project: "Contoso", label: "hotfix" });

      expect(gitApi.deletePullRequestLabels).toHaveBeenCalledWith("repo", 42, "hotfix", "Contoso");
      expect(parsed(result)).toEqual({ removed: "hotfix", pullRequestId: 42 });
    });

    it("surfaces a failure when removing a label", async () => {
      gitApi.deletePullRequestLabels.mockRejectedValue(new Error("label not found"));

      const result = await handlerFor(REPO_TOOLS.remove_pull_request_label)({ repositoryId: "repo", pullRequestId: 42, project: "Contoso", label: "ghost" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("label not found");
    });
  });
});
