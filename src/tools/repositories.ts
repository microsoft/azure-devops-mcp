// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  GitRef,
  GitForkRef,
  PullRequestStatus,
  GitVersionType,
  GitVersionDescriptor,
  GitPullRequestQuery,
  GitPullRequestQueryInput,
  GitPullRequestQueryType,
  CommentThreadContext,
  CommentThreadStatus,
  GitPullRequestCompletionOptions,
  GitPullRequestMergeStrategy,
  GitPullRequest,
  GitPullRequestCommentThread,
  GitPullRequestChange,
  GitPullRequestIteration,
  FileDiff,
  IterationReason,
  LineDiffBlock,
  LineDiffBlockChangeType,
  Comment,
  VersionControlChangeType,
  VersionControlRecursionType,
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getCurrentUserDetails, getUserIdFromEmail } from "./auth.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces.js";
import { WebApiTagDefinition } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { extractAdoStreamError, getEnumKeys, streamToString, apiVersion } from "../utils.js";
import { orgName } from "../index.js";

const REPO_TOOLS = {
  repo_repository: "repo_repository",
  repo_pull_request: "repo_pull_request",
  repo_pull_request_thread: "repo_pull_request_thread",
  repo_branch: "repo_branch",
  repo_file: "repo_file",
  repo_search_commits: "repo_search_commits",
  repo_pull_request_write: "repo_pull_request_write",
  repo_pull_request_thread_write: "repo_pull_request_thread_write",
  repo_create_branch: "repo_create_branch",
};

const CHANGE_PAGE_SIZE_MAX = 200;
const CHANGE_COUNT_MAX = 1000;
const FILE_DIFF_BATCH_SIZE = 10;
const FILE_DIFF_PATH_MAX = 20;
const FILE_DIFF_BLOCK_MAX = 5000;
const FILE_DIFF_LINE_MAX = 200000;
const FILE_DIFF_RESPONSE_BYTE_MAX = 2 * 1024 * 1024;
const COMMIT_ID_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PullRequestChangesError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

function pullRequestChangesError(error: PullRequestChangesError) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code: error.code, message: error.message, ...error.details } }, null, 2) }],
    isError: true,
  };
}

function normalizeGitPath(path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  if (path.includes("\\") || path.includes("\0")) throw new PullRequestChangesError("INVALID_PATH", `Invalid Git path '${path}'.`);
  const normalized = path.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) throw new PullRequestChangesError("INVALID_PATH", `Invalid Git path '${path}'.`);
  return normalized;
}

function requireCommitId(commitId: string | undefined, label: string): string {
  if (!commitId || !COMMIT_ID_PATTERN.test(commitId)) {
    throw new PullRequestChangesError("INVALID_ITERATION_BINDING", `${label} is absent or malformed.`);
  }
  return commitId;
}

function requireBranchRef(refName: string | undefined, label: string): string {
  if (!refName || !refName.startsWith("refs/heads/") || refName.length === "refs/heads/".length) {
    throw new PullRequestChangesError("INVALID_ITERATION_BINDING", `${label} is absent or malformed.`);
  }
  return refName;
}

function iterationIdentity(iteration: GitPullRequestIteration) {
  return {
    id: iteration.id,
    reason: iteration.reason,
    commonRefCommit: iteration.commonRefCommit?.commitId,
    sourceRefCommit: iteration.sourceRefCommit?.commitId,
    targetRefCommit: iteration.targetRefCommit?.commitId,
    oldTargetRefName: iteration.oldTargetRefName,
    newTargetRefName: iteration.newTargetRefName,
    hasMoreCommits: iteration.hasMoreCommits ?? false,
    updatedDate: iteration.updatedDate,
  };
}

function validateIterationBinding(iteration: GitPullRequestIteration) {
  if (!Number.isInteger(iteration.id) || (iteration.id ?? 0) < 1) {
    throw new PullRequestChangesError("INVALID_ITERATION_BINDING", "The selected iteration ID is absent or malformed.");
  }
  const commonRefCommit = requireCommitId(iteration.commonRefCommit?.commitId, "commonRefCommit.commitId");
  const sourceRefCommit = requireCommitId(iteration.sourceRefCommit?.commitId, "sourceRefCommit.commitId");
  const targetRefCommit = requireCommitId(iteration.targetRefCommit?.commitId, "targetRefCommit.commitId");
  const hasOldTarget = iteration.oldTargetRefName !== undefined;
  const hasNewTarget = iteration.newTargetRefName !== undefined;
  if (hasOldTarget !== hasNewTarget) {
    throw new PullRequestChangesError("INVALID_ITERATION_BINDING", "Retarget metadata must contain both oldTargetRefName and newTargetRefName.");
  }
  if (hasOldTarget && hasNewTarget) {
    requireBranchRef(iteration.oldTargetRefName, "oldTargetRefName");
    requireBranchRef(iteration.newTargetRefName, "newTargetRefName");
  }
  return { commonRefCommit, sourceRefCommit, targetRefCommit };
}

function latestIteration(iterations: GitPullRequestIteration[]) {
  const iterationIds = new Set<number>();
  let latest: GitPullRequestIteration | undefined;
  let latestId = 0;
  for (const iteration of iterations) {
    const iterationId = iteration.id;
    if (typeof iterationId !== "number" || !Number.isInteger(iterationId) || iterationId < 1) {
      throw new PullRequestChangesError("INVALID_ITERATION_BINDING", "The pull request contains an absent or malformed iteration ID.");
    }
    if (iterationIds.has(iterationId)) throw new PullRequestChangesError("INVALID_ITERATION_BINDING", `The pull request contains duplicate iteration ID ${iterationId}.`);
    iterationIds.add(iterationId);
    if (!latest || iterationId > latestId) {
      latest = iteration;
      latestId = iterationId;
    }
  }
  if (!latest) throw new PullRequestChangesError("NO_ITERATIONS", "No valid iterations were found for this pull request.");
  return { ...latest, id: latestId };
}

async function getAllIterationChanges(
  gitApi: Awaited<ReturnType<WebApi["getGitApi"]>>,
  repositoryId: string,
  pullRequestId: number,
  iterationId: number,
  project: string | undefined,
  pageSize: number,
  changeLimit: number
) {
  const changeEntries: GitPullRequestChange[] = [];
  let nextSkip = 0;
  let nextTop = Math.min(pageSize, changeLimit);
  let pages = 0;

  while (true) {
    const page = await gitApi.getPullRequestIterationChanges(repositoryId, pullRequestId, iterationId, project, nextTop, nextSkip);
    const entries = page.changeEntries ?? [];
    pages += 1;
    if (changeEntries.length + entries.length > changeLimit) {
      throw new PullRequestChangesError("CHANGES_TRUNCATED", `The iteration contains more than the configured ${changeLimit} change-entry limit.`, {
        pagination: { complete: false, truncated: true, pages, changeCount: changeEntries.length, nextSkip, nextTop, changeLimit },
      });
    }
    changeEntries.push(...entries);

    const serverNextSkip = page.nextSkip ?? 0;
    const serverNextTop = page.nextTop ?? 0;
    if (serverNextSkip === 0 && serverNextTop === 0) {
      return { changeEntries, pagination: { complete: true, truncated: false, pages, changeCount: changeEntries.length, nextSkip: 0, nextTop: 0, changeLimit } };
    }
    if (changeEntries.length >= changeLimit) {
      throw new PullRequestChangesError("CHANGES_TRUNCATED", `The iteration contains more than the configured ${changeLimit} change-entry limit.`, {
        pagination: { complete: false, truncated: true, pages, changeCount: changeEntries.length, nextSkip: serverNextSkip, nextTop: serverNextTop, changeLimit },
      });
    }
    if (!Number.isInteger(serverNextSkip) || !Number.isInteger(serverNextTop) || serverNextSkip !== nextSkip + entries.length || serverNextTop < 1 || entries.length === 0) {
      throw new PullRequestChangesError("INCOMPLETE_PAGINATION", "Azure DevOps returned incomplete or malformed iteration-change pagination.", {
        pagination: { complete: false, truncated: true, pages, changeCount: changeEntries.length, nextSkip: serverNextSkip, nextTop: serverNextTop, changeLimit },
      });
    }
    nextSkip = serverNextSkip;
    nextTop = Math.min(serverNextTop, pageSize, changeLimit - changeEntries.length);
  }
}

function changeTypeNames(changeType: number): string[] {
  return Object.entries(VersionControlChangeType)
    .filter(([name, value]) => typeof value === "number" && value !== 0 && (changeType & value) === value && !/^\d+$/.test(name))
    .map(([name]) => name);
}

function lineSpan(start: number | undefined, count: number | undefined) {
  if (count === 0) {
    if (start !== undefined && start !== 0) throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "An empty side of a line diff block has a nonzero start line.");
    return null;
  }
  if (typeof start !== "number" || typeof count !== "number" || !Number.isInteger(start) || !Number.isInteger(count) || start < 1 || count < 1) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "Azure DevOps returned a malformed line diff block.");
  }
  return { startLine: start, endLine: start + count - 1, lineCount: count };
}

function validateLineDiffBlock(block: LineDiffBlock) {
  const changeType = block.changeType;
  const originalCount = block.originalLinesCount;
  const modifiedCount = block.modifiedLinesCount;
  if (changeType === undefined || ![LineDiffBlockChangeType.None, LineDiffBlockChangeType.Add, LineDiffBlockChangeType.Delete, LineDiffBlockChangeType.Edit].includes(changeType)) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "Azure DevOps returned an unknown line diff block change type.");
  }
  if (!Number.isInteger(originalCount) || !Number.isInteger(modifiedCount) || (originalCount ?? -1) < 0 || (modifiedCount ?? -1) < 0) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "Azure DevOps returned a malformed line diff block.");
  }
  if (changeType === LineDiffBlockChangeType.Add && (originalCount !== 0 || modifiedCount === 0)) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "An add block has invalid base/source orientation.");
  }
  if (changeType === LineDiffBlockChangeType.Delete && (originalCount === 0 || modifiedCount !== 0)) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "A delete block has invalid base/source orientation.");
  }
  if (changeType === LineDiffBlockChangeType.Edit && (originalCount === 0 || modifiedCount === 0)) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "An edit block has invalid base/source orientation.");
  }
  if (changeType === LineDiffBlockChangeType.None && originalCount !== modifiedCount) {
    throw new PullRequestChangesError("MALFORMED_FILE_DIFF", "A context block has inconsistent base/source line counts.");
  }
  return {
    ...block,
    changeTypeName: LineDiffBlockChangeType[changeType],
    originalSpan: lineSpan(block.originalLineNumberStart, originalCount),
    modifiedSpan: lineSpan(block.modifiedLineNumberStart, modifiedCount),
  };
}

function bindRequestedChanges(changeEntries: GitPullRequestChange[], requestedPaths: string[]) {
  const aliases = new Map<string, Set<GitPullRequestChange>>();
  const requestedEntries = new Set<GitPullRequestChange>();
  const normalizedRequested = requestedPaths.map((path) => {
    const normalizedPath = normalizeGitPath(path);
    if (!normalizedPath) throw new PullRequestChangesError("INVALID_PATH", `Invalid Git path '${path}'.`);
    return normalizedPath;
  });
  if (new Set(normalizedRequested).size !== normalizedRequested.length) {
    throw new PullRequestChangesError("DUPLICATE_PATH", "Requested paths contain duplicates after normalization.");
  }

  for (const entry of changeEntries) {
    const currentPath = normalizeGitPath(entry.item?.path);
    const originalPath = normalizeGitPath(entry.originalPath);
    if (!currentPath && !originalPath) throw new PullRequestChangesError("MALFORMED_CHANGE_ENTRY", "A change entry has no current or original path.");
    for (const alias of new Set([currentPath, originalPath].filter((path): path is string => path !== undefined))) {
      const matchingEntries = aliases.get(alias) ?? new Set<GitPullRequestChange>();
      matchingEntries.add(entry);
      aliases.set(alias, matchingEntries);
    }
  }

  return normalizedRequested.map((requestedPath) => {
    const matchingEntries = aliases.get(requestedPath);
    if (!matchingEntries) throw new PullRequestChangesError("PATH_NOT_IN_ITERATION", `Requested path '${requestedPath}' is not present in the selected iteration changes.`);
    if (matchingEntries.size !== 1) throw new PullRequestChangesError("CONFLICTING_PATH", `Multiple change entries resolve to requested path '${requestedPath}'.`);
    const [entry] = matchingEntries;
    if (requestedEntries.has(entry)) throw new PullRequestChangesError("DUPLICATE_PATH", `Multiple requested paths resolve to the same change entry at '${requestedPath}'.`);
    requestedEntries.add(entry);
    if (entry.item?.isFolder || entry.item?.contentMetadata?.isBinary) {
      throw new PullRequestChangesError("UNSUPPORTED_FILE", `Requested path '${requestedPath}' is a folder or binary file.`);
    }
    const path = normalizeGitPath(entry.item?.path) ?? normalizeGitPath(entry.originalPath);
    if (!path) throw new PullRequestChangesError("MALFORMED_CHANGE_ENTRY", "A requested change entry has no current or original path.");
    const originalPath = normalizeGitPath(entry.originalPath);
    return { requestedPath, entry, path, originalPath };
  });
}

function bindFileDiffs(requests: ReturnType<typeof bindRequestedChanges>, fileDiffs: FileDiff[]) {
  if (Buffer.byteLength(JSON.stringify(fileDiffs), "utf8") > FILE_DIFF_RESPONSE_BYTE_MAX) {
    throw new PullRequestChangesError("FILE_DIFF_TOO_LARGE", `FileDiffs response exceeds the ${FILE_DIFF_RESPONSE_BYTE_MAX}-byte safety limit.`);
  }
  let blockCount = 0;
  let lineCount = 0;
  const unmatched = [...fileDiffs];

  const results = requests.map(({ requestedPath, entry, path, originalPath }) => {
    const matchIndex = unmatched.findIndex((diff) => {
      const diffPath = normalizeGitPath(diff.path);
      const diffOriginalPath = normalizeGitPath(diff.originalPath);
      return diffPath === path || (originalPath !== undefined && diffOriginalPath === originalPath) || diffPath === requestedPath || diffOriginalPath === requestedPath;
    });
    if (matchIndex < 0) throw new PullRequestChangesError("MISSING_FILE_DIFF", `Azure DevOps did not return a FileDiff for '${requestedPath}'.`);
    const diff = unmatched.splice(matchIndex, 1)[0];
    const blocks = diff.lineDiffBlocks ?? [];
    const changeType = entry.changeType ?? VersionControlChangeType.None;
    const renameOnly = (changeType & VersionControlChangeType.Rename) !== 0 && (changeType & (VersionControlChangeType.Add | VersionControlChangeType.Edit | VersionControlChangeType.Delete)) === 0;
    if (blocks.length === 0 && !renameOnly) throw new PullRequestChangesError("UNSUPPORTED_FILE_DIFF", `Azure DevOps returned no line diff blocks for '${requestedPath}'.`);
    blockCount += blocks.length;
    lineCount += blocks.reduce((total, block) => total + (block.originalLinesCount ?? 0) + (block.modifiedLinesCount ?? 0), 0);
    if (blockCount > FILE_DIFF_BLOCK_MAX || lineCount > FILE_DIFF_LINE_MAX) {
      throw new PullRequestChangesError("FILE_DIFF_TOO_LARGE", "FileDiffs response exceeds the line or block safety limit.");
    }
    return {
      provenance: {
        source: "getFileDiffs",
        requestedPath,
        iterationChangeTrackingId: entry.changeTrackingId,
        orientation: { original: "commonRefCommit", modified: "sourceRefCommit" },
      },
      path: normalizeGitPath(diff.path) ?? path,
      originalPath: normalizeGitPath(diff.originalPath) ?? originalPath ?? null,
      lineDiffBlocks: blocks.map(validateLineDiffBlock),
    };
  });
  if (unmatched.length > 0) throw new PullRequestChangesError("UNEXPECTED_FILE_DIFF", "Azure DevOps returned FileDiff results that were not requested.");
  return results;
}

function branchesFilterOutIrrelevantProperties(branches: GitRef[], top: number) {
  return branches
    ?.flatMap((branch) => (branch.name ? [branch.name] : []))
    ?.filter((branch) => branch.startsWith("refs/heads/"))
    .map((branch) => branch.replace("refs/heads/", ""))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, top);
}

function trimPullRequestThread(thread: GitPullRequestCommentThread) {
  return {
    id: thread.id,
    publishedDate: thread.publishedDate,
    lastUpdatedDate: thread.lastUpdatedDate,
    status: thread.status,
    comments: trimComments(thread.comments),
    threadContext: thread.threadContext,
  };
}

function trimComments(comments: Comment[] | undefined | null) {
  return comments
    ?.filter((comment) => !comment.isDeleted)
    ?.map((comment) => ({
      id: comment.id,
      author: {
        displayName: comment.author?.displayName,
        uniqueName: comment.author?.uniqueName,
      },
      content: comment.content,
      publishedDate: comment.publishedDate,
      lastUpdatedDate: comment.lastUpdatedDate,
      lastContentUpdatedDate: comment.lastContentUpdatedDate,
    }));
}

function pullRequestStatusStringToInt(status: string): number {
  switch (status) {
    case "Abandoned":
      return PullRequestStatus.Abandoned.valueOf();
    case "Active":
      return PullRequestStatus.Active.valueOf();
    case "All":
      return PullRequestStatus.All.valueOf();
    case "Completed":
      return PullRequestStatus.Completed.valueOf();
    case "NotSet":
      return PullRequestStatus.NotSet.valueOf();
    default:
      throw new Error(`Unknown pull request status: ${status}`);
  }
}

function filterReposByName(repositories: GitRepository[], repoNameFilter: string): GitRepository[] {
  const lowerCaseFilter = repoNameFilter.toLowerCase();
  return repositories?.filter((repo) => repo.name?.toLowerCase().includes(lowerCaseFilter));
}

function trimPullRequest(pr: GitPullRequest | null | undefined, includeDescription = false) {
  if (!pr) {
    return null;
  }
  const statusName = typeof pr.status === "number" ? (PullRequestStatus[pr.status] ?? "Unknown") : "Unknown";
  return {
    pullRequestId: pr.pullRequestId,
    codeReviewId: pr.codeReviewId,
    repository: pr.repository?.name,
    status: pr.status,
    statusName,
    createdBy: {
      displayName: pr.createdBy?.displayName,
      uniqueName: pr.createdBy?.uniqueName,
    },
    creationDate: pr.creationDate,
    closedDate: pr.closedDate,
    title: pr.title,
    ...(includeDescription ? { description: pr.description ?? "" } : {}),
    isDraft: pr.isDraft,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    project: pr.repository?.project?.name,
  };
}

function buildVersionDescriptor(version?: string, versionType?: string): GitVersionDescriptor | undefined {
  if (!version) return undefined;
  const versionTypeMap: Record<string, GitVersionType> = {
    Branch: GitVersionType.Branch,
    Commit: GitVersionType.Commit,
    Tag: GitVersionType.Tag,
  };
  return {
    version,
    versionType: versionTypeMap[versionType || "Branch"] ?? GitVersionType.Branch,
  };
}

function configureRepoTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- repo_repository -------------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_repository,
    "Retrieve repository data for an organization or project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["get", "list"]).describe("The action to perform. Options: get (get a repository by name or ID), list (list repositories in a project)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Required for get and list."),
      repositoryNameOrId: z.string().optional().describe("Repository name or ID. Required for get."),
      top: z.coerce.number().default(100).describe("The maximum number of repositories to return. Used for list. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of repositories to skip. Used for list. Defaults to 0."),
      repoNameFilter: z.string().optional().describe("Optional filter to search for repositories by name. Used for list."),
    },
    async ({ action, project, repositoryNameOrId, top, skip, repoNameFilter }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!project) return { content: [{ type: "text", text: "project is required for get" }], isError: true };
          if (!repositoryNameOrId) return { content: [{ type: "text", text: "repositoryNameOrId is required for get" }], isError: true };

          const repositories = await gitApi.getRepositories(project);
          const repository = repositories?.find((repo) => repo.name === repositoryNameOrId || repo.id === repositoryNameOrId);

          if (!repository) {
            return { content: [{ type: "text", text: `Repository ${repositoryNameOrId} not found in project ${project}` }], isError: true };
          }
          return { content: [{ type: "text", text: JSON.stringify(repository, null, 2) }] };
        }

        if (action === "list") {
          if (!project) return { content: [{ type: "text", text: "project is required for list" }], isError: true };

          const repositories = await gitApi.getRepositories(project, false, false, false);
          const filteredRepositories = repoNameFilter ? filterReposByName(repositories, repoNameFilter) : repositories;
          const paginatedRepositories = filteredRepositories?.sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0).slice(skip, skip + top);

          const trimmedRepositories = paginatedRepositories?.map((repo) => ({
            id: repo.id,
            name: repo.name,
            isDisabled: repo.isDisabled,
            isFork: repo.isFork,
            isInMaintenance: repo.isInMaintenance,
            webUrl: repo.webUrl,
            size: repo.size,
          }));

          return { content: [{ type: "text", text: JSON.stringify(trimmedRepositories, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with repository operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request -----------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request,
    "Retrieve pull request data and authoritative, iteration-bound change spans. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "list", "list_by_commits", "get_changes"])
        .describe(
          "The action to perform. Options: get (get a pull request by ID), list (list pull requests in a repository or project), list_by_commits (find pull requests that contain specific commit IDs), get_changes (get bounded change entries and optional authoritative line diffs for one immutable pull request iteration)."
        ),
      repositoryId: z.string().optional().describe("The ID or name of the repository. Required for get. Optional for list. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The ID of the pull request. Required for get."),
      project: z.string().optional().describe("Project ID or project name. Required for list_by_commits. Optional for get and list."),
      includeWorkItemRefs: z.boolean().optional().default(false).describe("Whether to include work item references. Used for get."),
      includeLabels: z.boolean().optional().default(false).describe("Whether to include labels. Used for get."),
      includeChangedFiles: z.boolean().optional().default(false).describe("Whether to include the list of changed files. Used for get."),
      top: z.coerce.number().default(100).describe("The maximum number of pull requests to return. Used for list. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of pull requests to skip. Used for list. Defaults to 0."),
      created_by_me: z.boolean().default(false).describe("Filter pull requests created by the current user. Used for list."),
      created_by_user: z.string().optional().describe("Filter pull requests created by a specific user email. Used for list."),
      i_am_reviewer: z.boolean().default(false).describe("Filter pull requests where the current user is a reviewer. Used for list."),
      user_is_reviewer: z.string().optional().describe("Filter pull requests where a specific user is a reviewer (email). Used for list."),
      status: z
        .enum(getEnumKeys(PullRequestStatus) as [string, ...string[]])
        .default("Active")
        .describe("Filter pull requests by status. Used for list. Defaults to 'Active'."),
      sourceRefName: z.string().optional().describe("Filter by source branch. Used for list."),
      targetRefName: z.string().optional().describe("Filter by target branch. Used for list and create."),
      repository: z.string().optional().describe("Repository name or ID. Required for list_by_commits."),
      commits: z.array(z.string()).optional().describe("Array of commit IDs to query. Required for list_by_commits."),
      queryType: z
        .enum(Object.values(GitPullRequestQueryType).filter((v): v is string => typeof v === "string") as [string, ...string[]])
        .optional()
        .default(GitPullRequestQueryType[GitPullRequestQueryType.LastMergeCommit])
        .describe("Type of commit query. Used for list_by_commits."),
      iterationId: z.coerce.number().int().min(1).optional().describe("Exact pull request iteration to select. Used for get_changes; defaults to the latest iteration."),
      includeLineDiffs: z.boolean().optional().default(false).describe("Call FileDiffs for explicitly requested paths. Used for get_changes; defaults to false."),
      paths: z.array(z.string().min(1)).max(FILE_DIFF_PATH_MAX).optional().describe(`Paths to retrieve line diffs for. Required when includeLineDiffs is true; maximum ${FILE_DIFF_PATH_MAX}.`),
      changePageSize: z.coerce.number().int().min(1).max(CHANGE_PAGE_SIZE_MAX).optional().default(100).describe(`Iteration-change page size. Used for get_changes; maximum ${CHANGE_PAGE_SIZE_MAX}.`),
      changeLimit: z.coerce
        .number()
        .int()
        .min(1)
        .max(CHANGE_COUNT_MAX)
        .optional()
        .default(500)
        .describe(`Maximum complete iteration change count. Used for get_changes; maximum ${CHANGE_COUNT_MAX}; exceeding it fails closed.`),
    },
    async ({
      action,
      repositoryId,
      pullRequestId,
      project,
      includeWorkItemRefs,
      includeLabels,
      includeChangedFiles,
      top,
      skip,
      created_by_me,
      created_by_user,
      i_am_reviewer,
      user_is_reviewer,
      status,
      sourceRefName,
      targetRefName,
      repository,
      commits,
      queryType,
      iterationId,
      includeLineDiffs,
      paths,
      changePageSize = 100,
      changeLimit = 500,
    }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for get" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for get" }], isError: true };

          const pullRequest = await gitApi.getPullRequest(repositoryId, pullRequestId, project, undefined, undefined, undefined, undefined, includeWorkItemRefs);
          let enhancedResponse: Record<string, unknown> = { ...pullRequest };

          if (includeLabels) {
            try {
              const projectId = pullRequest.repository?.project?.id;
              const projectName = pullRequest.repository?.project?.name;
              const labels = await gitApi.getPullRequestLabels(repositoryId, pullRequestId, projectName, projectId);
              const labelNames = labels.map((label) => label.name).filter((name) => name !== undefined);
              enhancedResponse = { ...enhancedResponse, labelSummary: { labels: labelNames, labelCount: labelNames.length } };
            } catch (error) {
              console.warn(`Error fetching PR labels: ${error instanceof Error ? error.message : "Unknown error"}`);
              enhancedResponse = { ...enhancedResponse, labelSummary: {} };
            }
          }

          if (includeChangedFiles) {
            try {
              const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, project);
              if (iterations?.length) {
                const latestIteration = iterations[iterations.length - 1];
                if (latestIteration.id != null) {
                  const changes = await gitApi.getPullRequestIterationChanges(repositoryId, pullRequestId, latestIteration.id, project);
                  enhancedResponse = {
                    ...enhancedResponse,
                    changedFilesSummary: {
                      changeEntries: changes?.changeEntries ?? [],
                      fileCount: changes?.changeEntries?.length ?? 0,
                      nextSkip: changes?.nextSkip,
                      nextTop: changes?.nextTop,
                    },
                  };
                } else {
                  enhancedResponse = { ...enhancedResponse, changedFilesSummary: { changeEntries: [], fileCount: 0 } };
                }
              } else {
                enhancedResponse = { ...enhancedResponse, changedFilesSummary: { changeEntries: [], fileCount: 0 } };
              }
            } catch (error) {
              console.warn(`Error fetching PR changed files: ${error instanceof Error ? error.message : "Unknown error"}`);
              enhancedResponse = { ...enhancedResponse, changedFilesSummary: {} };
            }
          }

          return { content: [{ type: "text", text: JSON.stringify(enhancedResponse, null, 2) }] };
        }

        if (action === "list") {
          if (!repositoryId && !project) {
            return { content: [{ type: "text", text: "Either repositoryId or project must be provided." }], isError: true };
          }

          const searchCriteria: {
            status: number;
            repositoryId?: string;
            creatorId?: string;
            reviewerId?: string;
            sourceRefName?: string;
            targetRefName?: string;
          } = { status: pullRequestStatusStringToInt(status) };

          if (repositoryId) searchCriteria.repositoryId = repositoryId;
          if (sourceRefName) searchCriteria.sourceRefName = sourceRefName;
          if (targetRefName) searchCriteria.targetRefName = targetRefName;

          if (created_by_user) {
            try {
              const userId = await getUserIdFromEmail(created_by_user, tokenProvider, connectionProvider, userAgentProvider);
              searchCriteria.creatorId = userId;
            } catch (error) {
              return { content: [{ type: "text", text: `Error finding user with email ${created_by_user}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
          } else if (created_by_me) {
            const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.creatorId = data.authenticatedUser.id;
          }

          if (user_is_reviewer) {
            try {
              const reviewerUserId = await getUserIdFromEmail(user_is_reviewer, tokenProvider, connectionProvider, userAgentProvider);
              searchCriteria.reviewerId = reviewerUserId;
            } catch (error) {
              return { content: [{ type: "text", text: `Error finding reviewer with email ${user_is_reviewer}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
            }
          } else if (i_am_reviewer) {
            const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.reviewerId = data.authenticatedUser.id;
          }

          let pullRequests;
          /* istanbul ignore else */
          if (repositoryId) {
            pullRequests = await gitApi.getPullRequests(repositoryId, searchCriteria, project, undefined, skip, top);
          } else if (project) {
            pullRequests = await gitApi.getPullRequestsByProject(project, searchCriteria, undefined, skip, top);
          }

          const filteredPullRequests = pullRequests?.map((pr) => trimPullRequest(pr));
          return { content: [{ type: "text", text: JSON.stringify(filteredPullRequests, null, 2) }] };
        }

        if (action === "list_by_commits") {
          if (!project) return { content: [{ type: "text", text: "project is required for list_by_commits" }], isError: true };
          if (!repository) return { content: [{ type: "text", text: "repository is required for list_by_commits" }], isError: true };
          if (!commits || commits.length === 0) return { content: [{ type: "text", text: "commits is required for list_by_commits" }], isError: true };

          const query: GitPullRequestQuery = {
            queries: [
              {
                items: commits,
                type: GitPullRequestQueryType[queryType as keyof typeof GitPullRequestQueryType],
              } as GitPullRequestQueryInput,
            ],
          };

          const queryResult = await gitApi.getPullRequestQuery(query, repository, project);
          return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
        }

        if (action === "get_changes") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for get_changes" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for get_changes" }], isError: true };
          if (includeLineDiffs && !project) return pullRequestChangesError(new PullRequestChangesError("PROJECT_REQUIRED", "project is required when includeLineDiffs is true."));
          if (includeLineDiffs && (!paths || paths.length === 0)) return pullRequestChangesError(new PullRequestChangesError("PATHS_REQUIRED", "paths is required when includeLineDiffs is true."));
          if ((paths?.length ?? 0) > FILE_DIFF_PATH_MAX)
            return pullRequestChangesError(new PullRequestChangesError("PATH_LIMIT_EXCEEDED", `paths cannot contain more than ${FILE_DIFF_PATH_MAX} entries.`));
          if (!includeLineDiffs && paths?.length) return pullRequestChangesError(new PullRequestChangesError("INVALID_ARGUMENT", "paths can only be used when includeLineDiffs is true."));

          try {
            const pullRequest = await gitApi.getPullRequest(repositoryId, pullRequestId, project);
            const repositoryMatches = REPOSITORY_ID_PATTERN.test(repositoryId)
              ? pullRequest.repository?.id?.toLowerCase() === repositoryId.toLowerCase()
              : pullRequest.repository?.name === repositoryId;
            if (!repositoryMatches) throw new PullRequestChangesError("REPOSITORY_MISMATCH", "The pull request resolved to a different repository.");
            if (pullRequest.forkSource || pullRequest.hasMultipleMergeBases || pullRequest.supportsIterations === false) {
              throw new PullRequestChangesError("AMBIGUOUS_REPOSITORY", "Fork pull requests and pull requests with multiple merge bases are not supported.");
            }
            const sourceRefName = requireBranchRef(pullRequest.sourceRefName, "pullRequest.sourceRefName");
            const targetRefName = requireBranchRef(pullRequest.targetRefName, "pullRequest.targetRefName");

            const initialIterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, project);
            const initialLatest = latestIteration(initialIterations);
            const selectedIterationId = iterationId ?? initialLatest.id;
            if (!initialIterations.some((iteration) => iteration.id === selectedIterationId)) {
              throw new PullRequestChangesError("ITERATION_NOT_FOUND", `Iteration ${selectedIterationId} was not found on this pull request.`);
            }
            const selectedIteration = await gitApi.getPullRequestIteration(repositoryId, pullRequestId, selectedIterationId, project);
            const commits = validateIterationBinding(selectedIteration);
            const changes = await getAllIterationChanges(gitApi, repositoryId, pullRequestId, selectedIterationId, project, changePageSize, changeLimit);

            const seenCurrentPaths = new Set<string>();
            const responseChanges = changes.changeEntries.map((entry) => {
              const changeType = entry.changeType;
              if (typeof changeType !== "number" || !Number.isInteger(changeType) || changeType < 1 || (changeType & ~VersionControlChangeType.All) !== 0)
                throw new PullRequestChangesError("MALFORMED_CHANGE_ENTRY", "A change entry has an absent or malformed changeType.");
              const path = normalizeGitPath(entry.item?.path);
              const originalPath = normalizeGitPath(entry.originalPath);
              if (!path && !originalPath) throw new PullRequestChangesError("MALFORMED_CHANGE_ENTRY", "A change entry has no current or original path.");
              const identityPath = path ?? originalPath;
              if (!identityPath) throw new PullRequestChangesError("MALFORMED_CHANGE_ENTRY", "A change entry has no identity path.");
              if (seenCurrentPaths.has(identityPath)) throw new PullRequestChangesError("DUPLICATE_PATH", `Duplicate change path '${identityPath}'.`);
              seenCurrentPaths.add(identityPath);
              return {
                provenance: { source: "getPullRequestIterationChanges", iterationId: selectedIterationId, changeTrackingId: entry.changeTrackingId },
                changeType: { value: changeType, names: changeTypeNames(changeType) },
                path: path ?? null,
                originalPath: originalPath ?? null,
              };
            });

            let fileDiffs;
            if (includeLineDiffs) {
              if (!project || !paths) throw new PullRequestChangesError("INVALID_ARGUMENT", "project and paths are required when includeLineDiffs is true.");
              const requests = bindRequestedChanges(changes.changeEntries, paths);
              const allFileDiffs: FileDiff[] = [];
              for (let index = 0; index < requests.length; index += FILE_DIFF_BATCH_SIZE) {
                const batch = requests.slice(index, index + FILE_DIFF_BATCH_SIZE);
                const batchDiffs = await gitApi.getFileDiffs(
                  {
                    baseVersionCommit: commits.commonRefCommit,
                    targetVersionCommit: commits.sourceRefCommit,
                    fileDiffParams: batch.map(({ entry, path, originalPath }) => {
                      const changeType = entry.changeType ?? VersionControlChangeType.None;
                      return {
                        path,
                        ...((changeType & VersionControlChangeType.Add) === 0 ? { originalPath: originalPath ?? path } : {}),
                      };
                    }),
                  },
                  project,
                  repositoryId
                );
                allFileDiffs.push(...batchDiffs);
              }
              fileDiffs = bindFileDiffs(requests, allFileDiffs);
            }

            const finalIterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, project);
            const finalLatest = latestIteration(finalIterations);
            const finalSelected = await gitApi.getPullRequestIteration(repositoryId, pullRequestId, selectedIterationId, project);
            if (finalLatest?.id !== initialLatest.id || JSON.stringify(iterationIdentity(finalSelected)) !== JSON.stringify(iterationIdentity(selectedIteration))) {
              throw new PullRequestChangesError("ITERATION_MOVED", "The pull request iteration binding changed during the request.");
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      provenance: {
                        source: "Azure DevOps Git API",
                        repository: { id: pullRequest.repository?.id, name: pullRequest.repository?.name },
                        pullRequestId,
                        currentPullRequestRefs: { sourceRefName, targetRefName },
                        iteration: {
                          id: selectedIterationId,
                          reason: { value: selectedIteration.reason, name: IterationReason[selectedIteration.reason ?? IterationReason.Unknown] ?? "Unknown" },
                          commonRefCommit: { commitId: commits.commonRefCommit, role: "fileDiffBase" },
                          sourceRefCommit: { commitId: commits.sourceRefCommit, role: "fileDiffTarget" },
                          targetRefCommit: { commitId: commits.targetRefCommit, role: "targetTipAtIteration" },
                          retarget: { oldTargetRefName: selectedIteration.oldTargetRefName ?? null, newTargetRefName: selectedIteration.newTargetRefName ?? null },
                        },
                        pagination: changes.pagination,
                        truncation: {
                          iterationCommits: selectedIteration.hasMoreCommits ?? false,
                          changeEntries: false,
                          fileDiffs: includeLineDiffs ? { responseLimitHit: false, apiProvidesTruncationIndicator: false } : null,
                        },
                      },
                      changes: responseChanges,
                      ...(fileDiffs ? { fileDiffs } : {}),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } catch (error) {
            if (error instanceof PullRequestChangesError) return pullRequestChangesError(error);
            throw error;
          }
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request_thread ----------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_thread,
    "Retrieve pull request thread and comment data. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "list_comments"]).describe("The action to perform. Options: list (list comment threads on a pull request), list_comments (list comments in a specific thread)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).describe("The ID of the pull request."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for list_comments."),
      iteration: z.coerce.number().min(1).optional().describe("The iteration ID. Used for list."),
      baseIteration: z.coerce.number().min(1).optional().describe("The base iteration ID. Used for list."),
      top: z.coerce.number().default(100).describe("The maximum number of results to return. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of results to skip. Defaults to 0."),
      fullResponse: z.boolean().optional().default(false).describe("Return full JSON response instead of trimmed data."),
      status: z
        .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
        .optional()
        .describe("Filter threads by status. Used for list."),
      authorEmail: z.string().optional().describe("Filter threads by the email of the thread author. Used for list."),
      authorDisplayName: z.string().optional().describe("Filter threads by the display name of the thread author. Used for list."),
    },
    async ({ action, repositoryId, pullRequestId, project, threadId, iteration, baseIteration, top, skip, fullResponse, status, authorEmail, authorDisplayName }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "list") {
          const threads = (await gitApi.getThreads(repositoryId, pullRequestId, project, iteration, baseIteration)) ?? [];
          let filteredThreads = threads;

          if (status !== undefined) {
            const statusValue = CommentThreadStatus[status as keyof typeof CommentThreadStatus];
            filteredThreads = filteredThreads.filter((thread) => thread.status === statusValue);
          }
          if (authorEmail !== undefined) {
            filteredThreads = filteredThreads.filter((thread) => {
              const firstComment = thread.comments?.[0];
              return firstComment?.author?.uniqueName?.toLowerCase() === authorEmail.toLowerCase();
            });
          }
          if (authorDisplayName !== undefined) {
            const lowerAuthorName = authorDisplayName.toLowerCase();
            filteredThreads = filteredThreads.filter((thread) => {
              const firstComment = thread.comments?.[0];
              return firstComment?.author?.displayName?.toLowerCase().includes(lowerAuthorName);
            });
          }

          const paginatedThreads = filteredThreads.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

          if (fullResponse) {
            return { content: [{ type: "text", text: JSON.stringify(paginatedThreads, null, 2) }] };
          }

          const trimmedThreads = paginatedThreads.map((thread) => trimPullRequestThread(thread));
          return { content: [{ type: "text", text: JSON.stringify(trimmedThreads, null, 2) }] };
        }

        if (action === "list_comments") {
          if (!threadId) return { content: [{ type: "text", text: "threadId is required for list_comments" }], isError: true };

          const comments = await gitApi.getComments(repositoryId, pullRequestId, threadId, project);
          const paginatedComments = comments?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

          if (fullResponse) {
            return { content: [{ type: "text", text: JSON.stringify(paginatedComments, null, 2) }] };
          }

          const trimmedComments = trimComments(paginatedComments);
          return { content: [{ type: "text", text: JSON.stringify(trimmedComments, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request thread operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_branch -----------------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_branch,
    "Retrieve branch data for a repository. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "list", "list_mine"])
        .describe("The action to perform. Options: get (get a branch by name), list (list branches in a repository), list_mine (list branches the current user has pushed to)."),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      branchName: z.string().optional().describe("The name of the branch. Required for get."),
      top: z.coerce.number().default(100).describe("The maximum number of branches to return. Used for list and list_mine. Defaults to 100."),
      filterContains: z.string().optional().describe("Filter branches containing this string. Used for list and list_mine."),
    },
    async ({ action, repositoryId, project, branchName, top, filterContains }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get") {
          if (!branchName) return { content: [{ type: "text", text: "branchName is required for get" }], isError: true };

          const branches = await gitApi.getRefs(repositoryId, project, "heads/", false, false, undefined, false, undefined, branchName);
          const branch = branches.find((branch) => branch.name === `refs/heads/${branchName}` || branch.name === branchName);

          if (!branch) {
            return { content: [{ type: "text", text: `Branch ${branchName} not found in repository ${repositoryId}` }], isError: true };
          }
          return { content: [{ type: "text", text: JSON.stringify(branch, null, 2) }] };
        }

        if (action === "list") {
          const branches = await gitApi.getRefs(repositoryId, project, "heads/", undefined, undefined, undefined, undefined, undefined, filterContains);
          const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);
          return { content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }] };
        }

        if (action === "list_mine") {
          const branches = await gitApi.getRefs(repositoryId, project, undefined, undefined, undefined, true, undefined, undefined, filterContains);
          const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);
          return { content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with branch operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_file -------------------------------------------------------------
  const fileVersionTypeStrings = getEnumKeys(GitVersionType);

  server.tool(
    REPO_TOOLS.repo_file,
    "Retrieve file data from a repository. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get_content", "list_directory"])
        .describe("The action to perform. Options: get_content (get the text content of a file at a specific branch, tag, or commit), list_directory (list files and folders in a directory)."),
      repositoryId: z.string().describe("The ID or name of the repository."),
      path: z.string().optional().default("/").describe("The file or directory path. Required for get_content. Defaults to '/' for list_directory."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name."),
      version: z.string().optional().describe("Version string: branch name, tag name, or commit SHA."),
      versionType: z
        .enum(fileVersionTypeStrings as [string, ...string[]])
        .optional()
        .default("Commit")
        .describe("How to interpret the version parameter. Used for get_content. Defaults to 'Commit'."),
      recursive: z.boolean().optional().default(false).describe("Whether to list items recursively. Used for list_directory. Defaults to false."),
      recursionDepth: z.coerce.number().min(1).optional().default(1).describe("Maximum depth for recursive listing. Used for list_directory when recursive is true. Defaults to 1."),
    },
    async ({ action, repositoryId, path, project, version, versionType, recursive, recursionDepth }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get_content") {
          if (!path) return { content: [{ type: "text", text: "path is required for get_content" }], isError: true };

          const versionDescriptor: GitVersionDescriptor | undefined = version ? { version, versionType: GitVersionType[versionType as keyof typeof GitVersionType] } : undefined;

          const stream = await gitApi.getItemText(repositoryId, path, project, undefined, undefined, undefined, undefined, false, versionDescriptor, true);
          const content = await streamToString(stream);

          const streamError = extractAdoStreamError(content);
          if (streamError) {
            return { content: [{ type: "text", text: `Error getting file content for '${path}': ${streamError}` }], isError: true };
          }

          return { content: [{ type: "text", text: content }] };
        }

        if (action === "list_directory") {
          const versionDescriptor = buildVersionDescriptor(version, versionType === "Commit" ? "Branch" : versionType);
          const clampedDepth = Math.min(Math.max(recursionDepth || 1, 1), 10);
          const recursionType = recursive ? VersionControlRecursionType.Full : VersionControlRecursionType.OneLevel;

          const items = await gitApi.getItems(repositoryId, project, path, recursionType, true, false, false, false, versionDescriptor);

          if (!items || items.length === 0) {
            return { content: [{ type: "text", text: `No items found at path: ${path}. The path may not exist in the repository.` }], isError: true };
          }

          let filteredItems = items;

          if (recursive && clampedDepth < 10) {
            const basePath = path === "/" ? "" : path;
            const baseDepth = basePath.split("/").filter((p) => p).length;
            filteredItems = items.filter((item) => {
              if (!item.path) return false;
              const itemDepth = item.path.split("/").filter((p) => p).length;
              return itemDepth <= baseDepth + clampedDepth;
            });
          }

          const formattedItems = filteredItems.map((item) => ({
            path: item.path,
            isFolder: item.isFolder,
            gitObjectType: item.gitObjectType,
            commitId: item.commitId,
            contentMetadata: item.contentMetadata ? { contentType: item.contentMetadata.contentType, fileName: item.contentMetadata.fileName } : undefined,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: formattedItems.length, path, recursive, recursionDepth: recursive ? clampedDepth : undefined, items: formattedItems }, null, 2),
              },
            ],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with file operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_search_commits ---------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_search_commits,
    "Search commits with filtering by text, author, date range, and more.",
    {
      searchText: z.string().describe("Keywords to search for in commit messages"),
      project: z
        .union([z.string().transform(/* istanbul ignore next */ (value) => [value]), z.array(z.string())])
        .optional()
        .describe("The names of the projects to search within. If omitted, searches across all projects in the organization."),
      repository: z.array(z.string()).optional().describe("The names of the repositories to search within."),
      branch: z.array(z.string()).optional().describe("The names of the repository branches to search within."),
      author: z.array(z.string()).optional().describe("The names of the commit authors to search for. Only full display names are supported."),
      commitStartDate: z.string().optional().describe("Filter commits from this date (format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')"),
      commitEndDate: z.string().optional().describe("Filter commits up to this date (format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')"),
      orderBy: z.enum(["ASC", "DESC"]).optional().describe("Sort commits by date: 'ASC' for oldest-first, 'DESC' for newest-first."),
      includeFacets: z.boolean().default(false).describe("Include facets in the search results"),
      skip: z.coerce.number().default(0).describe("Number of results to skip"),
      top: z.coerce.number().default(10).describe("Maximum number of results to return"),
    },
    async ({ searchText, project, repository, branch, author, commitStartDate, commitEndDate, orderBy, includeFacets, skip, top }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/commitSearchResults?api-version=${apiVersion}`;

      const requestBody: Record<string, unknown> = { searchText, includeFacets, $skip: skip, $top: top };

      const filters: Record<string, string[]> = {};
      if (project && project.length > 0) filters.projectName = project;
      if (repository && repository.length > 0) filters.repositoryName = repository;
      if (branch && branch.length > 0) filters.branchName = branch;
      if (author && author.length > 0) filters.authorName = author;
      if (commitStartDate) filters.commitStartDate = [commitStartDate];
      if (commitEndDate) filters.commitEndDate = [commitEndDate];

      requestBody.filters = filters;

      if (orderBy) {
        requestBody.$orderBy = [{ field: "commitDate", sortOrder: orderBy }];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Commit Search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      return { content: [{ type: "text", text: result }] };
    }
  );

  // --- repo_pull_request_write -----------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_write,
    "Write operations for pull requests. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["create", "update", "update_reviewers", "vote"])
        .describe(
          "The action to perform. Options: create (create a pull request), update (update a pull request, including setting autocomplete), update_reviewers (add or remove pull request reviewers), vote (cast a vote on a pull request)."
        ),
      repositoryId: z.string().optional().describe("The ID or name of the repository. Required for all actions. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The ID of the pull request. Required for update, update_reviewers, and vote."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      sourceRefName: z.string().optional().describe("The source branch name (e.g., 'refs/heads/feature-branch'). Required for create."),
      targetRefName: z.string().optional().describe("The target branch name (e.g., 'refs/heads/main'). Required for create. Optional for update."),
      title: z.string().optional().describe("The title of the pull request. Required for create. Optional for update."),
      description: z.string().max(4000).optional().describe("The description of the pull request. Max 4000 characters. Used for create and update."),
      isDraft: z.boolean().optional().default(false).describe("Whether the pull request is a draft. Used for create and update."),
      workItems: z.string().optional().describe("Work item IDs to associate, space-separated. Used for create."),
      forkSourceRepositoryId: z.string().optional().describe("The ID of the fork repository. Used for create."),
      labels: z.array(z.string()).optional().describe("Array of label names. Used for create and update."),
      status: z.enum(["Active", "Abandoned"]).optional().describe("The new status. Used for update."),
      autoComplete: z.boolean().optional().describe("Set autocomplete when all requirements are met. Used for update."),
      mergeStrategy: z
        .enum(getEnumKeys(GitPullRequestMergeStrategy) as [string, ...string[]])
        .optional()
        .describe("The merge strategy for autocomplete. Used for update."),
      mergeCommitMessage: z.string().optional().describe("Commit message for autocomplete. Used for update."),
      deleteSourceBranch: z.boolean().optional().default(false).describe("Delete source branch on autocomplete. Used for update."),
      transitionWorkItems: z.boolean().optional().default(true).describe("Transition work items on autocomplete. Used for update."),
      bypassReason: z.string().optional().describe("Reason for bypassing branch policies. Used for update."),
      reviewerIds: z.array(z.string()).optional().describe("List of reviewer IDs. Required for update_reviewers."),
      reviewerAction: z.enum(["add", "remove"]).optional().describe("Whether to add or remove reviewers. Required for update_reviewers."),
      vote: z.enum(["Approved", "ApprovedWithSuggestions", "NoVote", "WaitingForAuthor", "Rejected"]).optional().describe("The vote to cast. Required for vote."),
    },
    async ({
      action,
      repositoryId,
      pullRequestId,
      project,
      sourceRefName,
      targetRefName,
      title,
      description,
      isDraft,
      workItems,
      forkSourceRepositoryId,
      labels,
      status,
      autoComplete,
      mergeStrategy,
      mergeCommitMessage,
      deleteSourceBranch,
      transitionWorkItems,
      bypassReason,
      reviewerIds,
      reviewerAction,
      vote,
    }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "create") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for create" }], isError: true };
          if (!sourceRefName) return { content: [{ type: "text", text: "sourceRefName is required for create" }], isError: true };
          if (!targetRefName) return { content: [{ type: "text", text: "targetRefName is required for create" }], isError: true };
          if (!title) return { content: [{ type: "text", text: "title is required for create" }], isError: true };

          const workItemRefs = workItems ? workItems.split(" ").map((id) => ({ id: id.trim() })) : [];
          const noDataErrorMessage =
            `Pull request creation returned no data and no matching PR was found. This often means repositoryId="${repositoryId}" was not resolvable. ` +
            "Try the repository GUID from repo_repository (list action) instead of the Project/RepoName slash format.";

          const forkSource: GitForkRef | undefined = forkSourceRepositoryId ? { repository: { id: forkSourceRepositoryId } } : undefined;
          const labelDefinitions: WebApiTagDefinition[] | undefined = labels ? labels.map((label) => ({ name: label })) : undefined;

          let pullRequest = await gitApi.createPullRequest(
            { sourceRefName, targetRefName, title, description, isDraft, workItemRefs, forkSource, labels: labelDefinitions, supportsIterations: true },
            repositoryId,
            project
          );

          if (!pullRequest) {
            const prs = await gitApi.getPullRequests(repositoryId, { sourceRefName, targetRefName, status: PullRequestStatus.Active }, project, undefined, 0, 1);
            if (prs && prs.length > 0) {
              pullRequest = prs[0];
            } else {
              return { content: [{ type: "text", text: noDataErrorMessage }], isError: true };
            }
          }

          const trimmedPullRequest = trimPullRequest(pullRequest, true);
          return { content: [{ type: "text", text: JSON.stringify(trimmedPullRequest, null, 2) }] };
        }

        if (action === "update") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for update" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for update" }], isError: true };

          const updateRequest: Record<string, unknown> = {};

          if (title !== undefined) updateRequest.title = title;
          if (description !== undefined) updateRequest.description = description;
          if (isDraft !== undefined) updateRequest.isDraft = isDraft;
          if (targetRefName !== undefined) updateRequest.targetRefName = targetRefName;
          if (status !== undefined) {
            updateRequest.status = status === "Active" ? PullRequestStatus.Active.valueOf() : PullRequestStatus.Abandoned.valueOf();
          }

          if (autoComplete !== undefined) {
            if (autoComplete) {
              const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
              updateRequest.autoCompleteSetBy = { id: data.authenticatedUser.id };

              const completionOptions: GitPullRequestCompletionOptions = {
                deleteSourceBranch: deleteSourceBranch || false,
                transitionWorkItems: transitionWorkItems !== false,
                bypassPolicy: !!bypassReason,
              };

              if (mergeStrategy) completionOptions.mergeStrategy = GitPullRequestMergeStrategy[mergeStrategy as keyof typeof GitPullRequestMergeStrategy];
              if (mergeCommitMessage) completionOptions.mergeCommitMessage = mergeCommitMessage;
              if (bypassReason) completionOptions.bypassReason = bypassReason;

              updateRequest.completionOptions = completionOptions;
            } else {
              updateRequest.autoCompleteSetBy = null;
              updateRequest.completionOptions = null;
            }
          }

          if (Object.keys(updateRequest).length === 0 && !labels) {
            return {
              content: [{ type: "text", text: "Error: At least one field (title, description, isDraft, targetRefName, status, autoComplete options, or labels) must be provided for update." }],
              isError: true,
            };
          }

          if (labels) {
            const currentLabels = await gitApi.getPullRequestLabels(repositoryId, pullRequestId, project);
            for (const currentLabel of currentLabels) {
              if (currentLabel.id) await gitApi.deletePullRequestLabels(repositoryId, pullRequestId, currentLabel.id, project);
            }
            for (const label of labels) {
              await gitApi.createPullRequestLabel({ name: label }, repositoryId, pullRequestId, project);
            }
          }

          let updatedPullRequest;
          if (Object.keys(updateRequest).length > 0) {
            updatedPullRequest = await gitApi.updatePullRequest(updateRequest, repositoryId, pullRequestId, project);
          } else {
            updatedPullRequest = await gitApi.getPullRequest(repositoryId, pullRequestId, project);
          }

          const trimmedUpdatedPullRequest = trimPullRequest(updatedPullRequest, true);
          if (!trimmedUpdatedPullRequest) {
            return { content: [{ type: "text", text: "Pull request updated but API returned no data." }] };
          }

          return { content: [{ type: "text", text: JSON.stringify(trimmedUpdatedPullRequest, null, 2) }] };
        }

        if (action === "update_reviewers") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for update_reviewers" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for update_reviewers" }], isError: true };
          if (!reviewerIds || reviewerIds.length === 0) return { content: [{ type: "text", text: "reviewerIds is required for update_reviewers" }], isError: true };
          if (!reviewerAction) return { content: [{ type: "text", text: "reviewerAction is required for update_reviewers" }], isError: true };

          if (reviewerAction === "add") {
            const updatedReviewers = await gitApi.createPullRequestReviewers(
              reviewerIds.map((id) => ({ id })),
              repositoryId,
              pullRequestId,
              project
            );

            const trimmedResponse = updatedReviewers.map((item) => ({
              displayName: item.displayName,
              id: item.id,
              uniqueName: item.uniqueName,
              vote: item.vote,
              hasDeclined: item.hasDeclined,
              isFlagged: item.isFlagged,
            }));

            return { content: [{ type: "text", text: JSON.stringify(trimmedResponse, null, 2) }] };
          } else {
            for (const reviewerId of reviewerIds) {
              await gitApi.deletePullRequestReviewer(repositoryId, pullRequestId, reviewerId, project);
            }
            return { content: [{ type: "text", text: `Reviewers with IDs ${reviewerIds.join(", ")} removed from pull request ${pullRequestId}.` }] };
          }
        }

        if (action === "vote") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for vote" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for vote" }], isError: true };
          if (!vote) return { content: [{ type: "text", text: "vote is required for vote action" }], isError: true };

          const userDetails = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
          const userId = userDetails.authenticatedUser.id;

          if (!userId) throw new Error("Could not determine authenticated user ID.");

          const voteMap: Record<string, number> = {
            Approved: 10,
            ApprovedWithSuggestions: 5,
            NoVote: 0,
            WaitingForAuthor: -5,
            Rejected: -10,
          };

          const existingReviewer = await gitApi.getPullRequestReviewer(repositoryId, pullRequestId, userId, project).catch((error) => {
            if (!(error instanceof Error) || !/not found|reviewer does not exist/i.test(error.message)) throw error;
            return undefined;
          });

          const reviewerPayload = {
            vote: voteMap[vote],
            id: userId,
            ...(existingReviewer?.isRequired !== undefined ? { isRequired: existingReviewer.isRequired } : {}),
          };

          await gitApi.createPullRequestReviewer(reviewerPayload as any, repositoryId, pullRequestId, userId, project);

          return { content: [{ type: "text", text: `Successfully cast vote '${vote}' on PR #${pullRequestId}.` }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request_thread_write ----------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_thread_write,
    "Write operations for pull request comment threads. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["create", "reply", "update_status"])
        .describe(
          "The action to perform. Options: create (create a new comment thread on a pull request), reply (reply to a comment in a thread), update_status (update the status of a comment thread)."
        ),
      repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).describe("The ID of the pull request."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
      threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for reply and update_status."),
      content: z.string().optional().describe("The content of the comment. Required for create and reply."),
      status: z
        .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
        .optional()
        .default(CommentThreadStatus[CommentThreadStatus.Active])
        .describe("The thread status. Used for create (defaults to 'Active') and required for update_status."),
      filePath: z.string().optional().describe("The file path for the comment thread. Used for create."),
      fullResponse: z.boolean().optional().default(false).describe("Return full JSON response. Used for reply."),
      rightFileStartLine: z.coerce.number().min(1).optional().describe("Start line in the right file. Used for create."),
      rightFileStartOffset: z.number().optional().describe("Start character offset in the right file. Used for create."),
      rightFileEndLine: z.number().optional().describe("End line in the right file. Used for create."),
      rightFileEndOffset: z.number().optional().describe("End character offset in the right file. Used for create."),
    },
    async ({ action, repositoryId, pullRequestId, project, threadId, content, status, filePath, fullResponse, rightFileStartLine, rightFileStartOffset, rightFileEndLine, rightFileEndOffset }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "create") {
          if (!content) return { content: [{ type: "text", text: "content is required for create" }], isError: true };

          const normalizedFilePath = filePath && !filePath.startsWith("/") ? `/${filePath}` : filePath;
          const threadContext: CommentThreadContext = { filePath: normalizedFilePath };

          if (rightFileStartLine !== undefined) {
            if (rightFileStartLine < 1) return { content: [{ type: "text", text: "rightFileStartLine must be greater than or equal to 1." }], isError: true };
            threadContext.rightFileStart = { line: rightFileStartLine };
            if (rightFileStartOffset !== undefined) {
              if (rightFileStartOffset < 1) return { content: [{ type: "text", text: "rightFileStartOffset must be greater than or equal to 1." }], isError: true };
              threadContext.rightFileStart.offset = rightFileStartOffset;
            }
          }

          if (rightFileEndLine !== undefined) {
            if (rightFileStartLine === undefined) return { content: [{ type: "text", text: "rightFileEndLine must only be specified if rightFileStartLine is also specified." }], isError: true };
            if (rightFileEndLine < 1) return { content: [{ type: "text", text: "rightFileEndLine must be greater than or equal to 1." }], isError: true };
            if (rightFileEndOffset === undefined) return { content: [{ type: "text", text: "rightFileEndOffset must be specified if rightFileEndLine is specified." }], isError: true };
            threadContext.rightFileEnd = { line: rightFileEndLine };
            /* istanbul ignore else */
            if (rightFileEndOffset !== undefined) {
              if (rightFileEndOffset < 1) return { content: [{ type: "text", text: "rightFileEndOffset must be greater than or equal to 1." }], isError: true };
              threadContext.rightFileEnd.offset = rightFileEndOffset;
            }
          }

          if (rightFileEndOffset !== undefined && rightFileEndLine === undefined) {
            return { content: [{ type: "text", text: "rightFileEndLine must be specified if rightFileEndOffset is specified." }], isError: true };
          }

          if (rightFileStartLine !== undefined && rightFileStartOffset !== undefined) {
            if (rightFileEndLine === undefined || rightFileEndOffset === undefined) {
              return {
                content: [{ type: "text", text: "rightFileEndLine and rightFileEndOffset must both be specified when rightFileStartLine and rightFileStartOffset are both specified." }],
                isError: true,
              };
            }
          }

          if (rightFileStartLine !== undefined && rightFileEndLine !== undefined && rightFileStartLine === rightFileEndLine) {
            if (rightFileEndOffset !== undefined && rightFileStartOffset !== undefined && rightFileEndOffset < rightFileStartOffset) {
              return { content: [{ type: "text", text: "rightFileEndOffset must be greater than or equal to rightFileStartOffset when both are on the same line." }], isError: true };
            }
          }

          const thread = await gitApi.createThread(
            { comments: [{ content, commentType: 1 }], threadContext, status: CommentThreadStatus[status as keyof typeof CommentThreadStatus] },
            repositoryId,
            pullRequestId,
            project
          );

          return { content: [{ type: "text", text: JSON.stringify(trimPullRequestThread(thread), null, 2) }] };
        }

        if (action === "reply") {
          if (!threadId) return { content: [{ type: "text", text: "threadId is required for reply" }], isError: true };
          if (!content) return { content: [{ type: "text", text: "content is required for reply" }], isError: true };

          const comment = await gitApi.createComment({ content, commentType: 1 }, repositoryId, pullRequestId, threadId, project);

          if (!comment) {
            return { content: [{ type: "text", text: `Error: Failed to add comment to thread ${threadId}. The comment was not created successfully.` }], isError: true };
          }

          if (fullResponse) return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };

          return { content: [{ type: "text", text: `Comment successfully added to thread ${threadId}.` }] };
        }

        if (action === "update_status") {
          if (!threadId) return { content: [{ type: "text", text: "threadId is required for update_status" }], isError: true };
          if (!status) return { content: [{ type: "text", text: "status is required for update_status" }], isError: true };

          const updateRequest: Record<string, unknown> = {
            status: CommentThreadStatus[status as keyof typeof CommentThreadStatus],
          };

          const thread = await gitApi.updateThread(updateRequest, repositoryId, pullRequestId, threadId, project);

          if (!thread) {
            return { content: [{ type: "text", text: `Error: Failed to update thread ${threadId}. The thread was not updated successfully.` }], isError: true };
          }

          return { content: [{ type: "text", text: JSON.stringify(trimPullRequestThread(thread), null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request thread write operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_create_branch ----------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_create_branch,
    "Create a new branch in the repository.",
    {
      repositoryId: z
        .string()
        .describe("The ID or name of the repository where the branch will be created. When using a repository name instead of a GUID, the project parameter must also be provided."),
      branchName: z.string().describe("The name of the new branch to create, e.g., 'feature-branch'."),
      sourceBranchName: z.string().optional().default("main").describe("The name of the source branch to create the new branch from. Defaults to 'main'."),
      sourceCommitId: z.string().optional().describe("The commit ID to create the branch from. If not provided, uses the latest commit of the source branch."),
      project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a repository name instead of a GUID."),
    },
    async ({ repositoryId, branchName, sourceBranchName, sourceCommitId, project }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        let commitId = sourceCommitId;

        if (!commitId) {
          const sourceRefName = `refs/heads/${sourceBranchName}`;
          try {
            const sourceBranch = await gitApi.getRefs(repositoryId, project, "heads/", false, false, undefined, false, undefined, sourceBranchName);
            const branch = sourceBranch.find((b) => b.name === sourceRefName);
            if (!branch || !branch.objectId) {
              return { content: [{ type: "text", text: `Error: Source branch '${sourceBranchName}' not found in repository ${repositoryId}` }], isError: true };
            }
            commitId = branch.objectId;
          } catch (error) {
            return { content: [{ type: "text", text: `Error retrieving source branch '${sourceBranchName}': ${error instanceof Error ? error.message : String(error)}` }], isError: true };
          }
        }

        const refUpdate = {
          name: `refs/heads/${branchName}`,
          newObjectId: commitId,
          oldObjectId: "0000000000000000000000000000000000000000",
        };

        try {
          const result = await gitApi.updateRefs([refUpdate], repositoryId, project);

          if (result && result.length > 0 && result[0].success) {
            return { content: [{ type: "text", text: `Branch '${branchName}' created successfully from '${sourceBranchName}' (${commitId})` }] };
          } else {
            const errorMessage = result && result.length > 0 && result[0].customMessage ? result[0].customMessage : "Unknown error occurred during branch creation";
            return { content: [{ type: "text", text: `Error creating branch '${branchName}': ${errorMessage}` }], isError: true };
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error creating branch '${branchName}': ${error instanceof Error ? error.message : String(error)}` }], isError: true };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating branch: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { REPO_TOOLS, configureRepoTools };
