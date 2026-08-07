// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { IterationReason, VersionControlChangeType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repositories";

jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
  getUserIdFromEmail: jest.fn(),
}));
jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

const REPOSITORY_ID = "12345678-1234-1234-1234-123456789012";
const COMMON_COMMIT = "1".repeat(40);
const SOURCE_COMMIT = "2".repeat(40);
const TARGET_COMMIT = "3".repeat(40);

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;

describe("repo_pull_request get_changes", () => {
  let server: McpServer;
  let handler: ToolHandler;
  let mockGitApi: {
    getPullRequestIterations: jest.Mock;
    getPullRequestIteration: jest.Mock;
    getPullRequestIterationChanges: jest.Mock;
  };

  const iteration = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    reason: IterationReason.Push,
    commonRefCommit: { commitId: COMMON_COMMIT },
    sourceRefCommit: { commitId: SOURCE_COMMIT },
    targetRefCommit: { commitId: TARGET_COMMIT },
    hasMoreCommits: false,
    ...overrides,
  });

  const prime = (selectedIteration = iteration()) => {
    mockGitApi.getPullRequestIterations.mockResolvedValue([selectedIteration]);
    mockGitApi.getPullRequestIteration.mockResolvedValue(selectedIteration);
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({
      changeEntries: [{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/src/file.ts" } }],
      nextSkip: 1,
      nextTop: 100,
    });
  };

  const invoke = (params: Record<string, unknown> = {}) =>
    handler({
      action: "get_changes",
      repositoryId: REPOSITORY_ID,
      pullRequestId: 42,
      project: "project",
      top: 100,
      skip: 0,
      ...params,
    });

  const parsed = (result: ToolResult) => JSON.parse(result.content[0].text);

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    mockGitApi = {
      getPullRequestIterations: jest.fn(),
      getPullRequestIteration: jest.fn(),
      getPullRequestIterationChanges: jest.fn(),
    };
    const connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });
    configureRepoTools(server, jest.fn(), connectionProvider as unknown as () => Promise<WebApi>, () => "Jest");
    const readCall = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
    if (!readCall) throw new Error("repo_pull_request tool not registered");
    handler = readCall[3] as ToolHandler;
    prime();
  });

  it("returns the remote page shape with exact iteration commit identity", async () => {
    const result = await invoke();

    expect(result.isError).toBeUndefined();
    expect(mockGitApi.getPullRequestIterationChanges).toHaveBeenCalledWith(REPOSITORY_ID, 42, 7, "project", 100, 0);
    expect(parsed(result)).toEqual({
      iterationId: 7,
      iterationReason: { value: IterationReason.Push, names: ["Push"], unrecognizedBits: 0 },
      commonRefCommit: { commitId: COMMON_COMMIT },
      sourceRefCommit: { commitId: SOURCE_COMMIT },
      targetRefCommit: { commitId: TARGET_COMMIT },
      oldTargetRefName: null,
      newTargetRefName: null,
      commitsTruncated: false,
      hasMoreChanges: true,
      nextSkip: 1,
      nextTop: 100,
      changes: [{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/src/file.ts" } }],
    });
  });

  it("keeps identity identical across requested pages", async () => {
    mockGitApi.getPullRequestIterationChanges
      .mockResolvedValueOnce({
        changeEntries: [{ changeTrackingId: 1 }],
        nextSkip: 1,
        nextTop: 100,
      })
      .mockResolvedValueOnce({
        changeEntries: [{ changeTrackingId: 2 }],
        nextSkip: 0,
        nextTop: 0,
      });

    const firstPage = parsed(await invoke());
    const secondPage = parsed(await invoke({ iterationId: firstPage.iterationId, skip: firstPage.nextSkip, top: firstPage.nextTop }));

    expect(secondPage.sourceRefCommit).toEqual(firstPage.sourceRefCommit);
    expect(secondPage.targetRefCommit).toEqual(firstPage.targetRefCommit);
    expect(secondPage.commonRefCommit).toEqual(firstPage.commonRefCommit);
    expect(secondPage.hasMoreChanges).toBe(false);
    expect(mockGitApi.getPullRequestIterationChanges).toHaveBeenLastCalledWith(REPOSITORY_ID, 42, 7, "project", 100, 1);
  });

  it("selects the highest iteration ID regardless of response order", async () => {
    const older = iteration();
    const newer = iteration({ id: 8 });
    prime(newer);
    mockGitApi.getPullRequestIterations.mockResolvedValue([newer, older]);

    const body = parsed(await invoke());

    expect(body.iterationId).toBe(8);
    expect(mockGitApi.getPullRequestIteration).toHaveBeenCalledWith(REPOSITORY_ID, 42, 8, "project");
  });

  it("returns retarget names and commit truncation from the selected iteration", async () => {
    prime(
      iteration({
        reason: IterationReason.Retarget,
        oldTargetRefName: "refs/heads/main",
        newTargetRefName: "refs/heads/release",
        hasMoreCommits: true,
      })
    );

    expect(parsed(await invoke({ iterationId: 7 }))).toMatchObject({
      iterationReason: { value: IterationReason.Retarget, names: ["Retarget"], unrecognizedBits: 0 },
      oldTargetRefName: "refs/heads/main",
      newTargetRefName: "refs/heads/release",
      commitsTruncated: true,
    });
  });

  it.each([
    [IterationReason.Push, ["Push"], 0],
    [IterationReason.ForcePush, ["ForcePush"], 0],
    [IterationReason.Create, ["Create"], 0],
    [IterationReason.Rebase, ["Rebase"], 0],
    [IterationReason.Unknown, ["Unknown"], 0],
    [IterationReason.Retarget, ["Retarget"], 0],
    [IterationReason.ResolveConflicts, ["ResolveConflicts"], 0],
    [IterationReason.ForcePush | IterationReason.Rebase, ["ForcePush", "Rebase"], 0],
    [IterationReason.Retarget | IterationReason.ResolveConflicts, ["Retarget", "ResolveConflicts"], 0],
    [IterationReason.ResolveConflicts | IterationReason.Unknown | IterationReason.Create | IterationReason.ForcePush, ["ForcePush", "Create", "Unknown", "ResolveConflicts"], 0],
    [64, [], 64],
    [IterationReason.Unknown | 64, ["Unknown"], 64],
  ])("returns iteration reason %s as ordered lossless flags", async (reason, names, unrecognizedBits) => {
    prime(iteration({ reason }));

    expect(parsed(await invoke()).iterationReason).toEqual({ value: reason, names, unrecognizedBits });
  });

  it.each([undefined, null])("returns a stable nullable shape for absent iteration reason %s", async (reason) => {
    prime(iteration({ reason }));

    expect(parsed(await invoke()).iterationReason).toEqual({ value: null, names: [], unrecognizedBits: 0 });
  });

  it.each([-1, 1.5])("fails closed on malformed iteration reason %s", async (reason) => {
    prime(iteration({ reason }));

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INVALID_ITERATION_BINDING");
    expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
  });

  it.each([
    ["latest iteration", iteration(), [iteration(), iteration({ id: 8 })]],
    ["force-pushed iteration", iteration(), iteration({ reason: IterationReason.ForcePush, sourceRefCommit: { commitId: "4".repeat(40) } })],
    ["rebased iteration", iteration(), iteration({ reason: IterationReason.Rebase, sourceRefCommit: { commitId: "5".repeat(40) } })],
    [
      "retargeted iteration",
      iteration({ reason: IterationReason.Retarget, oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/release" }),
      iteration({ reason: IterationReason.Retarget, oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/other" }),
    ],
  ])("fails closed when the %s moves during the request", async (_name, selected, finalState) => {
    prime(selected);
    if (Array.isArray(finalState)) {
      mockGitApi.getPullRequestIterations.mockReset().mockResolvedValueOnce([selected]).mockResolvedValueOnce(finalState);
    } else {
      mockGitApi.getPullRequestIteration.mockReset().mockResolvedValueOnce(selected).mockResolvedValueOnce(finalState);
    }

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("ITERATION_MOVED");
  });

  it.each([
    ["commonRefCommit", { commonRefCommit: undefined }],
    ["sourceRefCommit", { sourceRefCommit: { commitId: "not-a-commit" } }],
    ["targetRefCommit", { targetRefCommit: undefined }],
    ["retarget names", { oldTargetRefName: "refs/heads/main", newTargetRefName: undefined }],
  ])("fails closed on malformed %s", async (_name, overrides) => {
    prime(iteration(overrides));

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INVALID_ITERATION_BINDING");
    expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
  });

  it("requires project when repositoryId is a name", async () => {
    const result = await invoke({ repositoryId: "repository", project: undefined });

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("PROJECT_REQUIRED");
  });

  it.each([{ top: 0 }, { top: 1001 }, { skip: -1 }, { top: 1.5 }])("enforces get_changes paging caps without constraining list schema", async (params) => {
    const result = await invoke(params);

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INVALID_ARGUMENT");
    expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
  });

  it("fails closed on incomplete pagination", async () => {
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({
      changeEntries: [{ changeTrackingId: 1 }],
      nextSkip: 2,
      nextTop: 100,
    });

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INCOMPLETE_PAGINATION");
  });

  it.each([
    [{ changeEntries: {}, nextSkip: 0, nextTop: 0 }, 100],
    [{ changeEntries: [{ changeTrackingId: 1 }, { changeTrackingId: 2 }], nextSkip: 0, nextTop: 0 }, 1],
    [{ changeEntries: [{ changeTrackingId: 1 }], nextSkip: 1, nextTop: 1001 }, 100],
  ])("fails closed on malformed server paging metadata", async (page, top) => {
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue(page);

    const result = await invoke({ top });

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INCOMPLETE_PAGINATION");
  });

  it("fails when an explicit iteration does not exist", async () => {
    const result = await invoke({ iterationId: 6 });

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("ITERATION_NOT_FOUND");
    expect(mockGitApi.getPullRequestIteration).not.toHaveBeenCalled();
  });

  it("fails closed on iteration-change API errors", async () => {
    mockGitApi.getPullRequestIterationChanges.mockRejectedValue(new Error("changes unavailable"));

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("changes unavailable");
  });

  it("keeps get_changes in the read-only dispatcher with bounded paging", () => {
    const readCall = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
    const writeCall = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_write);
    const readSchema = readCall[2];
    const writeSchema = writeCall[2];

    expect(readCall[1]).toContain("iteration-bound change pages");
    expect(readSchema.action.safeParse("get_changes").success).toBe(true);
    expect(readSchema.top.safeParse(1001).success).toBe(true);
    expect(readSchema.skip.safeParse(-1).success).toBe(true);
    expect(readSchema.includeLineDiffs).toBeUndefined();
    expect(writeSchema.action.safeParse("get_changes").success).toBe(false);
    expect(Object.values(REPO_TOOLS)).not.toContain("repo_pull_request_changes");
  });
});
