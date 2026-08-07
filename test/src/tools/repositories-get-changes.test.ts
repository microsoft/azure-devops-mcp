// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { IterationReason, LineDiffBlockChangeType, VersionControlChangeType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { configureRepoTools, REPO_TOOLS } from "../../../src/tools/repositories";

jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
  getUserIdFromEmail: jest.fn(),
}));
jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

const REPOSITORY_ID = "12345678-1234-1234-1234-123456789012";
const BASE_COMMIT = "1".repeat(40);
const SOURCE_COMMIT = "2".repeat(40);
const TARGET_COMMIT = "3".repeat(40);

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}
type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;
interface ApiMock {
  getPullRequest: jest.Mock;
  getPullRequestIterations: jest.Mock;
  getPullRequestIteration: jest.Mock;
  getPullRequestIterationChanges: jest.Mock;
  getFileDiffs: jest.Mock;
}

describe("repo_pull_request get_changes", () => {
  let server: McpServer;
  let mockGitApi: ApiMock;
  let handler: ToolHandler;
  let readSchema: Record<string, { safeParse: (value: unknown) => { success: boolean } }>;
  let readDescription: string;

  const iteration = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    reason: IterationReason.Push,
    commonRefCommit: { commitId: BASE_COMMIT },
    sourceRefCommit: { commitId: SOURCE_COMMIT },
    targetRefCommit: { commitId: TARGET_COMMIT },
    hasMoreCommits: false,
    ...overrides,
  });

  const prime = (changeEntries: Record<string, unknown>[] = [], selectedIteration = iteration()) => {
    mockGitApi.getPullRequest.mockResolvedValue({
      pullRequestId: 42,
      repository: { id: REPOSITORY_ID, name: "repository" },
      sourceRefName: "refs/heads/feature",
      targetRefName: "refs/heads/main",
      supportsIterations: true,
    });
    mockGitApi.getPullRequestIterations.mockResolvedValue([selectedIteration]);
    mockGitApi.getPullRequestIteration.mockResolvedValue(selectedIteration);
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({ changeEntries, nextSkip: 0, nextTop: 0 });
    mockGitApi.getFileDiffs.mockResolvedValue([]);
  };

  const invoke = (params: Record<string, unknown> = {}) =>
    handler({
      action: "get_changes",
      repositoryId: REPOSITORY_ID,
      pullRequestId: 42,
      project: "project",
      changePageSize: 100,
      changeLimit: 500,
      includeLineDiffs: false,
      ...params,
    });

  const parsed = (result: ToolResult) => JSON.parse(result.content[0].text);

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    mockGitApi = {
      getPullRequest: jest.fn(),
      getPullRequestIterations: jest.fn(),
      getPullRequestIteration: jest.fn(),
      getPullRequestIterationChanges: jest.fn(),
      getFileDiffs: jest.fn(),
    };
    const connectionProvider = jest.fn().mockResolvedValue({
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    });
    configureRepoTools(server, jest.fn(), connectionProvider as unknown as () => Promise<WebApi>, () => "Jest");
    const readCall = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request);
    if (!readCall) throw new Error("repo_pull_request tool not registered");
    readDescription = readCall[1] as string;
    readSchema = readCall[2] as typeof readSchema;
    handler = readCall[3] as ToolHandler;
    prime();
  });

  it("returns edit, add, delete, and rename spans while excluding target-tip-only changes", async () => {
    const entries = [
      { changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/edit.ts" } },
      { changeTrackingId: 2, changeType: VersionControlChangeType.Add, item: { path: "/added.ts" } },
      { changeTrackingId: 3, changeType: VersionControlChangeType.Delete, item: {}, originalPath: "/deleted.ts" },
      { changeTrackingId: 4, changeType: VersionControlChangeType.Rename, item: { path: "/new.ts" }, originalPath: "/old.ts" },
    ];
    prime(entries);
    mockGitApi.getFileDiffs.mockResolvedValue([
      {
        path: "edit.ts",
        originalPath: "edit.ts",
        lineDiffBlocks: [{ changeType: LineDiffBlockChangeType.Edit, originalLineNumberStart: 4, originalLinesCount: 1, modifiedLineNumberStart: 4, modifiedLinesCount: 2 }],
      },
      {
        path: "added.ts",
        lineDiffBlocks: [{ changeType: LineDiffBlockChangeType.Add, originalLineNumberStart: 0, originalLinesCount: 0, modifiedLineNumberStart: 1, modifiedLinesCount: 3 }],
      },
      {
        path: "deleted.ts",
        originalPath: "deleted.ts",
        lineDiffBlocks: [{ changeType: LineDiffBlockChangeType.Delete, originalLineNumberStart: 8, originalLinesCount: 2, modifiedLineNumberStart: 0, modifiedLinesCount: 0 }],
      },
      { path: "new.ts", originalPath: "old.ts", lineDiffBlocks: [] },
    ]);

    const result = await invoke({ includeLineDiffs: true, paths: ["/edit.ts", "added.ts", "deleted.ts", "old.ts"] });

    expect(result.isError).toBeUndefined();
    expect(mockGitApi.getFileDiffs).toHaveBeenCalledWith(
      {
        baseVersionCommit: BASE_COMMIT,
        targetVersionCommit: SOURCE_COMMIT,
        fileDiffParams: [{ path: "edit.ts", originalPath: "edit.ts" }, { path: "added.ts" }, { path: "deleted.ts", originalPath: "deleted.ts" }, { path: "new.ts", originalPath: "old.ts" }],
      },
      "project",
      REPOSITORY_ID
    );
    const body = parsed(result);
    expect(body.provenance.iteration.targetRefCommit).toEqual({ commitId: TARGET_COMMIT, role: "targetTipAtIteration" });
    expect(body.fileDiffs[0].provenance.orientation).toEqual({ original: "commonRefCommit", modified: "sourceRefCommit" });
    expect(body.fileDiffs[0].lineDiffBlocks[0].originalSpan).toEqual({ startLine: 4, endLine: 4, lineCount: 1 });
    expect(body.fileDiffs[0].lineDiffBlocks[0].modifiedSpan).toEqual({ startLine: 4, endLine: 5, lineCount: 2 });
    expect(body.fileDiffs[2].lineDiffBlocks[0].modifiedSpan).toBeNull();
    expect(JSON.stringify(mockGitApi.getFileDiffs.mock.calls)).not.toContain(TARGET_COMMIT);
  });

  it("preserves context and delete-only orientation", async () => {
    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/file.ts" } }]);
    mockGitApi.getFileDiffs.mockResolvedValue([
      {
        path: "file.ts",
        originalPath: "file.ts",
        lineDiffBlocks: [
          { changeType: LineDiffBlockChangeType.None, originalLineNumberStart: 1, originalLinesCount: 3, modifiedLineNumberStart: 1, modifiedLinesCount: 3 },
          { changeType: LineDiffBlockChangeType.Delete, originalLineNumberStart: 4, originalLinesCount: 2, modifiedLineNumberStart: 0, modifiedLinesCount: 0 },
        ],
      },
    ]);

    const body = parsed(await invoke({ includeLineDiffs: true, paths: ["file.ts"] }));
    expect(body.fileDiffs[0].lineDiffBlocks[0].changeTypeName).toBe("None");
    expect(body.fileDiffs[0].lineDiffBlocks[1].originalSpan).toEqual({ startLine: 4, endLine: 5, lineCount: 2 });
    expect(body.fileDiffs[0].lineDiffBlocks[1].modifiedSpan).toBeNull();
  });

  it("does not call FileDiffs in metadata-only mode", async () => {
    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/file.ts" } }]);

    const result = await invoke();

    expect(mockGitApi.getFileDiffs).not.toHaveBeenCalled();
    expect(parsed(result)).not.toHaveProperty("fileDiffs");
    expect(parsed(result).provenance.pagination).toMatchObject({ complete: true, truncated: false, changeCount: 1 });
    expect(mockGitApi.getPullRequestIterations).toHaveBeenCalledTimes(2);
    expect(mockGitApi.getPullRequestIteration).toHaveBeenCalledTimes(2);
  });

  it("paginates change entries with server nextSkip and nextTop", async () => {
    const first = { changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/one.ts" } };
    const second = { changeTrackingId: 2, changeType: VersionControlChangeType.Add, item: { path: "/two.ts" } };
    prime();
    mockGitApi.getPullRequestIterationChanges
      .mockReset()
      .mockResolvedValueOnce({ changeEntries: [first], nextSkip: 1, nextTop: 25 })
      .mockResolvedValueOnce({ changeEntries: [second], nextSkip: 0, nextTop: 0 });

    const body = parsed(await invoke({ changePageSize: 10 }));

    expect(mockGitApi.getPullRequestIterationChanges).toHaveBeenNthCalledWith(1, REPOSITORY_ID, 42, 7, "project", 10, 0);
    expect(mockGitApi.getPullRequestIterationChanges).toHaveBeenNthCalledWith(2, REPOSITORY_ID, 42, 7, "project", 10, 1);
    expect(body.provenance.pagination).toMatchObject({ complete: true, truncated: false, pages: 2, changeCount: 2 });
  });

  it("fails closed when pagination skips unseen entries", async () => {
    prime();
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({
      changeEntries: [{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/one.ts" } }],
      nextSkip: 2,
      nextTop: 10,
    });

    expect(parsed(await invoke()).error.code).toBe("INCOMPLETE_PAGINATION");
  });

  it("selects the highest iteration ID regardless of response order", async () => {
    const older = iteration();
    const newer = iteration({ id: 8 });
    prime([], newer);
    mockGitApi.getPullRequestIterations.mockResolvedValue([newer, older]);

    const body = parsed(await invoke());

    expect(body.provenance.iteration.id).toBe(8);
    expect(mockGitApi.getPullRequestIteration).toHaveBeenCalledWith(REPOSITORY_ID, 42, 8, "project");
  });

  it.each([
    ["latest iteration", iteration(), [iteration(), iteration({ id: 8 })]],
    ["force-pushed binding", iteration(), [iteration(), iteration({ reason: IterationReason.ForcePush, sourceRefCommit: { commitId: "4".repeat(40) } })]],
    ["rebased binding", iteration(), [iteration(), iteration({ reason: IterationReason.Rebase, sourceRefCommit: { commitId: "5".repeat(40) } })]],
    [
      "retargeted binding",
      iteration({ reason: IterationReason.Retarget, oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/release" }),
      [
        iteration({ reason: IterationReason.Retarget, oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/release" }),
        iteration({ reason: IterationReason.Retarget, oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/other" }),
      ],
    ],
  ])("fails closed when the %s moves", async (_name, selected, finalState) => {
    prime([], selected);
    if (Array.isArray(finalState) && finalState.length === 2 && (finalState[0] as { id: number }).id !== (finalState[1] as { id: number }).id) {
      mockGitApi.getPullRequestIterations.mockReset().mockResolvedValueOnce([selected]).mockResolvedValueOnce(finalState);
    } else {
      mockGitApi.getPullRequestIteration.mockReset().mockResolvedValueOnce(finalState[0]).mockResolvedValueOnce(finalState[1]);
    }

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("ITERATION_MOVED");
  });

  it("fails closed on a missing common ref", async () => {
    prime([], iteration({ commonRefCommit: undefined }));

    const result = await invoke();

    expect(result.isError).toBe(true);
    expect(parsed(result).error.code).toBe("INVALID_ITERATION_BINDING");
    expect(mockGitApi.getPullRequestIterationChanges).not.toHaveBeenCalled();
  });

  it("exposes iteration reason, retarget names, commit truncation, and closed refs", async () => {
    prime(
      [],
      iteration({
        reason: IterationReason.Retarget,
        oldTargetRefName: "refs/heads/main",
        newTargetRefName: "refs/heads/release",
        hasMoreCommits: true,
      })
    );

    const body = parsed(await invoke({ iterationId: 7 }));

    expect(body.provenance.iteration).toMatchObject({
      id: 7,
      reason: { value: IterationReason.Retarget, name: "Retarget" },
      commonRefCommit: { commitId: BASE_COMMIT, role: "fileDiffBase" },
      sourceRefCommit: { commitId: SOURCE_COMMIT, role: "fileDiffTarget" },
      targetRefCommit: { commitId: TARGET_COMMIT, role: "targetTipAtIteration" },
      retarget: { oldTargetRefName: "refs/heads/main", newTargetRefName: "refs/heads/release" },
    });
    expect(body.provenance.currentPullRequestRefs).toEqual({ sourceRefName: "refs/heads/feature", targetRefName: "refs/heads/main" });
    expect(body.provenance.truncation).toMatchObject({ iterationCommits: true, changeEntries: false, fileDiffs: null });
  });

  it("fails closed on malformed refs and repository ambiguity", async () => {
    mockGitApi.getPullRequest.mockResolvedValue({
      repository: { id: REPOSITORY_ID },
      sourceRefName: "feature",
      targetRefName: "refs/heads/main",
    });
    expect(parsed(await invoke()).error.code).toBe("INVALID_ITERATION_BINDING");

    prime();
    mockGitApi.getPullRequest.mockResolvedValue({
      repository: { id: REPOSITORY_ID },
      sourceRefName: "refs/heads/feature",
      targetRefName: "refs/heads/main",
      forkSource: { repository: { id: "another" } },
    });
    expect(parsed(await invoke()).error.code).toBe("AMBIGUOUS_REPOSITORY");
  });

  it("fails closed on duplicate and conflicting paths", async () => {
    const renameAndReAdd = [
      { changeTrackingId: 1, changeType: VersionControlChangeType.Rename, item: { path: "/new.ts" }, originalPath: "/old.ts" },
      { changeTrackingId: 2, changeType: VersionControlChangeType.Add, item: { path: "/old.ts" } },
    ];
    prime(renameAndReAdd);
    expect((await invoke()).isError).toBeUndefined();
    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["old.ts"] })).error.code).toBe("CONFLICTING_PATH");

    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/file.ts" } }]);
    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["/file.ts", "file.ts"] })).error.code).toBe("DUPLICATE_PATH");

    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Rename, item: { path: "/new.ts" }, originalPath: "/old.ts" }]);
    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["old.ts", "new.ts"] })).error.code).toBe("DUPLICATE_PATH");
  });

  it("fails closed when pagination is incomplete or exceeds its cap", async () => {
    prime();
    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({
      changeEntries: [{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/one.ts" } }],
      nextSkip: 1,
      nextTop: 10,
    });
    expect(parsed(await invoke({ changeLimit: 1 })).error).toMatchObject({
      code: "CHANGES_TRUNCATED",
      pagination: { complete: false, truncated: true },
    });

    mockGitApi.getPullRequestIterationChanges.mockResolvedValue({
      changeEntries: [
        { changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/one.ts" } },
        { changeTrackingId: 2, changeType: VersionControlChangeType.Edit, item: { path: "/two.ts" } },
      ],
      nextSkip: 0,
      nextTop: 0,
    });
    expect(parsed(await invoke({ changeLimit: 1 })).error.code).toBe("CHANGES_TRUNCATED");
  });

  it("fails closed on FileDiffs API errors", async () => {
    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/file.ts" } }]);
    mockGitApi.getFileDiffs.mockRejectedValue(new Error("FileDiffs unavailable"));

    const result = await invoke({ includeLineDiffs: true, paths: ["file.ts"] });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FileDiffs unavailable");
  });

  it("batches FileDiffs at ten paths per request", async () => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      changeTrackingId: index + 1,
      changeType: VersionControlChangeType.Rename,
      item: { path: `/new-${index}.ts` },
      originalPath: `/old-${index}.ts`,
    }));
    prime(entries);
    mockGitApi.getFileDiffs.mockImplementation(async (criteria: { fileDiffParams: { path: string; originalPath: string }[] }) =>
      criteria.fileDiffParams.map(({ path, originalPath }) => ({ path, originalPath, lineDiffBlocks: [] }))
    );

    await invoke({ includeLineDiffs: true, paths: entries.map((entry) => entry.originalPath) });

    expect(mockGitApi.getFileDiffs).toHaveBeenCalledTimes(2);
    expect(mockGitApi.getFileDiffs.mock.calls[0][0].fileDiffParams).toHaveLength(10);
    expect(mockGitApi.getFileDiffs.mock.calls[1][0].fileDiffParams).toHaveLength(1);
  });

  it("fails closed on binary and oversized FileDiffs responses", async () => {
    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/binary.dat", contentMetadata: { isBinary: true } } }]);
    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["binary.dat"] })).error.code).toBe("UNSUPPORTED_FILE");

    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/large.ts" } }]);
    mockGitApi.getFileDiffs.mockResolvedValue([
      {
        path: "large.ts",
        originalPath: "large.ts",
        oversizedServerPayload: "x".repeat(2 * 1024 * 1024),
        lineDiffBlocks: [{ changeType: LineDiffBlockChangeType.Edit, originalLineNumberStart: 1, originalLinesCount: 1, modifiedLineNumberStart: 1, modifiedLinesCount: 1 }],
      },
    ]);
    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["large.ts"] })).error.code).toBe("FILE_DIFF_TOO_LARGE");
  });

  it("validates wrong-orientation blocks", async () => {
    prime([{ changeTrackingId: 1, changeType: VersionControlChangeType.Edit, item: { path: "/file.ts" } }]);
    mockGitApi.getFileDiffs.mockResolvedValue([
      {
        path: "file.ts",
        lineDiffBlocks: [{ changeType: LineDiffBlockChangeType.Delete, originalLineNumberStart: 0, originalLinesCount: 0, modifiedLineNumberStart: 1, modifiedLinesCount: 1 }],
      },
    ]);

    expect(parsed(await invoke({ includeLineDiffs: true, paths: ["file.ts"] })).error.code).toBe("MALFORMED_FILE_DIFF");
  });

  it("keeps get_changes in the read-only dispatcher schema and inventory", () => {
    expect(readDescription).toContain("authoritative, iteration-bound change spans");
    expect(readSchema.action.safeParse("get_changes").success).toBe(true);
    expect(readSchema.paths.safeParse(Array.from({ length: 21 }, (_, index) => `file-${index}.ts`)).success).toBe(false);
    expect(Object.values(REPO_TOOLS)).not.toContain("repo_pull_request_changes");
    expect((server.tool as jest.Mock).mock.calls.map(([name]) => name)).toContain(REPO_TOOLS.repo_pull_request);
    const writeCall = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === REPO_TOOLS.repo_pull_request_write);
    expect((writeCall[2] as typeof readSchema).action.safeParse("get_changes").success).toBe(false);
  });
});
