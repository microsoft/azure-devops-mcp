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
  Comment,
  ItemContentType,
  VersionControlChangeType,
  VersionControlRecursionType,
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getCurrentUserDetails, getUserIdFromEmail } from "./auth.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces.js";
import { WebApiTagDefinition } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { extractAdoStreamError, getEnumKeys, streamToString, apiVersion } from "../utils.js";
import { orgName } from "../index.js";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  repoFileWriteShape,
  repoPullRequestWriteShape,
  repoPullRequestThreadWriteShape,
  WriteRepositoryFileArgs,
  RepoFileWriteArgs,
  CreatePullRequestArgs,
  UpdatePullRequestArgs,
  UpdatePullRequestReviewersArgs,
  VotePullRequestArgs,
  RepoPullRequestWriteArgs,
  CreatePullRequestThreadArgs,
  ReplyToPullRequestThreadArgs,
  UpdatePullRequestCommentArgs,
  UpdatePullRequestThreadStatusArgs,
  RepoPullRequestThreadWriteArgs,
} from "./repositories.dto.js";

const errorResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

const REPO_TOOLS = {
  repo_repository: "repo_repository",
  repo_pull_request: "repo_pull_request",
  repo_pull_request_org: "repo_pull_request_org",
  repo_pull_request_thread: "repo_pull_request_thread",
  repo_branch: "repo_branch",
  repo_file: "repo_file",
  repo_file_write: "repo_file_write",
  repo_search_commits: "repo_search_commits",
  repo_pull_request_write: "repo_pull_request_write",
  repo_pull_request_thread_write: "repo_pull_request_thread_write",
  repo_create_branch: "repo_create_branch",
};

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
    pullRequestThreadContext: thread.pullRequestThreadContext,
  };
}

function trimComment(comment: Comment) {
  return {
    id: comment.id,
    author: {
      displayName: comment.author?.displayName,
      uniqueName: comment.author?.uniqueName,
    },
    content: comment.content,
    publishedDate: comment.publishedDate,
    lastUpdatedDate: comment.lastUpdatedDate,
    lastContentUpdatedDate: comment.lastContentUpdatedDate,
  };
}

function trimComments(comments: Comment[] | undefined | null) {
  return comments?.filter((comment) => !comment.isDeleted)?.map(trimComment);
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

function trimOrganizationPullRequest(pr: GitPullRequest) {
  return {
    ...trimPullRequest(pr),
    projectId: pr.repository?.project?.id,
    repositoryId: pr.repository?.id,
    createdBy: {
      id: pr.createdBy?.id,
      displayName: pr.createdBy?.displayName,
      uniqueName: pr.createdBy?.uniqueName,
    },
    reviewers: pr.reviewers?.map((reviewer) => ({
      id: reviewer.id,
      displayName: reviewer.displayName,
      uniqueName: reviewer.uniqueName,
      vote: reviewer.vote,
      isRequired: reviewer.isRequired,
    })),
    webUrl: pr.remoteUrl,
  };
}

async function getOrganizationPullRequests(connection: WebApi, identityFilter: "creatorId" | "reviewerId", identityId: string, status: number, skip: number, top: number): Promise<GitPullRequest[]> {
  const url = new URL(`${connection.serverUrl.replace(/\/$/, "")}/_apis/git/pullrequests`);

  url.searchParams.set("api-version", "7.1");
  url.searchParams.set("$skip", String(skip));
  url.searchParams.set("$top", String(top));
  url.searchParams.set(`searchCriteria.${identityFilter}`, identityId);
  url.searchParams.set("searchCriteria.status", String(status));

  const response = await connection.rest.get<{ value?: GitPullRequest[] }>(url.toString(), { deserializeDates: true });
  return response.result?.value ?? [];
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

async function writeRepositoryFile(args: WriteRepositoryFileArgs & Pick<RepoFileWriteArgs, "action">, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { action, repositoryId, project, branchName, path, content, commitMessage, expectedOldObjectId } = args;
  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const refName = `refs/heads/${branchName}`;
  const refs = await gitApi.getRefs(repositoryId, project, "heads/", false, false, undefined, false, undefined, branchName);
  const branch = refs.find((ref) => ref.name === refName);

  if (!branch?.objectId) return errorResult(`Error: Branch '${branchName}' not found in repository ${repositoryId}`);
  if (expectedOldObjectId && expectedOldObjectId !== branch.objectId) return errorResult(`Error: Branch '${branchName}' has moved from expected commit ${expectedOldObjectId}`);

  const oldObjectId = branch.objectId;
  const filePath = path.startsWith("/") ? path : `/${path}`;
  const push = await gitApi.createPush(
    {
      refUpdates: [{ name: refName, oldObjectId }],
      commits: [
        {
          comment: commitMessage,
          changes: [
            {
              changeType: action === "create" ? VersionControlChangeType.Add : VersionControlChangeType.Edit,
              item: { path: filePath },
              newContent: { content, contentType: ItemContentType.RawText },
            },
          ],
        },
      ],
    },
    repositoryId,
    project
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ pushId: push.pushId, commitId: push.commits?.[0]?.commitId, branchName, path: filePath }, null, 2),
      },
    ],
  };
}

const repoFileWriteErrorPrefixes: Record<RepoFileWriteArgs["action"], string> = {
  create: "Error writing repository file: ",
  update: "Error writing repository file: ",
};

async function createPullRequest(args: CreatePullRequestArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { repositoryId, project, sourceRefName, targetRefName, title, description, isDraft, workItems, forkSourceRepositoryId, labels } = args;
  if (!repositoryId) return errorResult("repositoryId is required for create");
  if (!sourceRefName) return errorResult("sourceRefName is required for create");
  if (!targetRefName) return errorResult("targetRefName is required for create");
  if (!title) return errorResult("title is required for create");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const workItemRefs = workItems ? workItems.split(" ").map((id) => ({ id: id.trim() })) : [];
  const noDataErrorMessage =
    `Pull request creation returned no data and no matching PR was found. This often means repositoryId="${repositoryId}" was not resolvable. ` +
    "Try the repository GUID from repo_repository (list action) instead of the Project/RepoName slash format.";

  const forkSource: GitForkRef | undefined = forkSourceRepositoryId ? { repository: { id: forkSourceRepositoryId } } : undefined;
  const labelDefinitions: WebApiTagDefinition[] | undefined = labels ? labels.map((label) => ({ name: label })) : undefined;

  let pullRequest = await gitApi.createPullRequest(
    { sourceRefName, targetRefName, title, description, isDraft: isDraft ?? false, workItemRefs, forkSource, labels: labelDefinitions, supportsIterations: true },
    repositoryId,
    project
  );

  if (!pullRequest) {
    const prs = await gitApi.getPullRequests(repositoryId, { sourceRefName, targetRefName, status: PullRequestStatus.Active }, project, undefined, 0, 1);
    if (!prs || prs.length === 0) return errorResult(noDataErrorMessage);
    pullRequest = prs[0];
  }

  const trimmedPullRequest = trimPullRequest(pullRequest, true);
  return { content: [{ type: "text", text: JSON.stringify(trimmedPullRequest, null, 2) }] };
}

async function updatePullRequest(
  args: UpdatePullRequestArgs,
  connectionProvider: () => Promise<WebApi>,
  tokenProvider: () => Promise<string>,
  userAgentProvider: () => string
): Promise<CallToolResult> {
  const {
    repositoryId,
    pullRequestId,
    project,
    targetRefName,
    title,
    description,
    isDraft,
    labels,
    status,
    autoComplete,
    mergeStrategy,
    mergeCommitMessage,
    deleteSourceBranch,
    transitionWorkItems,
    bypassPolicy,
    bypassReason,
  } = args;
  if (!repositoryId) return errorResult("repositoryId is required for update");
  if (!pullRequestId) return errorResult("pullRequestId is required for update");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const updateRequest: Record<string, unknown> = {};

  if (title !== undefined) updateRequest.title = title;
  if (description !== undefined) updateRequest.description = description;
  if (isDraft !== undefined) updateRequest.isDraft = isDraft;
  if (targetRefName !== undefined) updateRequest.targetRefName = targetRefName;
  if (status !== undefined) {
    updateRequest.status = status === "Active" ? PullRequestStatus.Active.valueOf() : PullRequestStatus.Abandoned.valueOf();
  }

  if (autoComplete === false) {
    updateRequest.autoCompleteSetBy = null;
    updateRequest.completionOptions = null;
  }

  if (autoComplete) {
    if (bypassPolicy && !bypassReason) return errorResult("bypassReason is required when bypassPolicy is true");

    const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
    updateRequest.autoCompleteSetBy = { id: data.authenticatedUser.id };

    const completionOptions: GitPullRequestCompletionOptions = {
      deleteSourceBranch: deleteSourceBranch || false,
      transitionWorkItems: transitionWorkItems !== false,
      bypassPolicy: bypassPolicy === true,
    };

    if (mergeStrategy) completionOptions.mergeStrategy = GitPullRequestMergeStrategy[mergeStrategy as keyof typeof GitPullRequestMergeStrategy];
    if (mergeCommitMessage) completionOptions.mergeCommitMessage = mergeCommitMessage;
    if (bypassPolicy && bypassReason) completionOptions.bypassReason = bypassReason;

    updateRequest.completionOptions = completionOptions;
  }

  if (Object.keys(updateRequest).length === 0 && !labels) {
    return errorResult("Error: At least one field (title, description, isDraft, targetRefName, status, autoComplete options, or labels) must be provided for update.");
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

  const updatedPullRequest =
    Object.keys(updateRequest).length > 0 ? await gitApi.updatePullRequest(updateRequest, repositoryId, pullRequestId, project) : await gitApi.getPullRequest(repositoryId, pullRequestId, project);

  const trimmedUpdatedPullRequest = trimPullRequest(updatedPullRequest, true);
  if (!trimmedUpdatedPullRequest) return { content: [{ type: "text", text: "Pull request updated but API returned no data." }] };

  return { content: [{ type: "text", text: JSON.stringify(trimmedUpdatedPullRequest, null, 2) }] };
}

async function updatePullRequestReviewers(args: UpdatePullRequestReviewersArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { repositoryId, pullRequestId, project, reviewerIds, reviewerAction } = args;
  if (!repositoryId) return errorResult("repositoryId is required for update_reviewers");
  if (!pullRequestId) return errorResult("pullRequestId is required for update_reviewers");
  if (!reviewerIds || reviewerIds.length === 0) return errorResult("reviewerIds is required for update_reviewers");
  if (!reviewerAction) return errorResult("reviewerAction is required for update_reviewers");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();

  if (reviewerAction === "remove") {
    for (const reviewerId of reviewerIds) {
      await gitApi.deletePullRequestReviewer(repositoryId, pullRequestId, reviewerId, project);
    }
    return { content: [{ type: "text", text: `Reviewers with IDs ${reviewerIds.join(", ")} removed from pull request ${pullRequestId}.` }] };
  }

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
}

async function votePullRequest(args: VotePullRequestArgs, connectionProvider: () => Promise<WebApi>, tokenProvider: () => Promise<string>, userAgentProvider: () => string): Promise<CallToolResult> {
  const { repositoryId, pullRequestId, project, vote } = args;
  if (!repositoryId) return errorResult("repositoryId is required for vote");
  if (!pullRequestId) return errorResult("pullRequestId is required for vote");
  if (!vote) return errorResult("vote is required for vote action");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
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

const repoPullRequestWriteErrorPrefixes: Record<RepoPullRequestWriteArgs["action"], string> = {
  create: "Error with pull request write operation: ",
  update: "Error with pull request write operation: ",
  update_reviewers: "Error with pull request write operation: ",
  vote: "Error with pull request write operation: ",
};

async function createPullRequestThread(args: CreatePullRequestThreadArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const {
    repositoryId,
    pullRequestId,
    project,
    content,
    status,
    filePath,
    rightFileStartLine,
    rightFileStartOffset,
    rightFileEndLine,
    rightFileEndOffset,
    changeTrackingId,
    firstComparingIteration,
    secondComparingIteration,
  } = args;
  if (!content) return errorResult("content is required for create");

  const normalizedFilePath = filePath && !filePath.startsWith("/") ? `/${filePath}` : filePath;
  const threadContext: CommentThreadContext = { filePath: normalizedFilePath };

  if (rightFileStartLine !== undefined) {
    if (rightFileStartLine < 1) return errorResult("rightFileStartLine must be greater than or equal to 1.");
    threadContext.rightFileStart = { line: rightFileStartLine };
    if (rightFileStartOffset !== undefined) {
      if (rightFileStartOffset < 1) return errorResult("rightFileStartOffset must be greater than or equal to 1.");
      threadContext.rightFileStart.offset = rightFileStartOffset;
    }
  }

  if (rightFileEndLine !== undefined) {
    if (rightFileStartLine === undefined) return errorResult("rightFileEndLine must only be specified if rightFileStartLine is also specified.");
    if (rightFileEndLine < 1) return errorResult("rightFileEndLine must be greater than or equal to 1.");
    if (rightFileEndOffset === undefined) return errorResult("rightFileEndOffset must be specified if rightFileEndLine is specified.");
    if (rightFileEndOffset < 1) return errorResult("rightFileEndOffset must be greater than or equal to 1.");
    threadContext.rightFileEnd = { line: rightFileEndLine, offset: rightFileEndOffset };
  }

  if (rightFileEndOffset !== undefined && rightFileEndLine === undefined) {
    return errorResult("rightFileEndLine must be specified if rightFileEndOffset is specified.");
  }

  if (rightFileStartLine !== undefined && rightFileStartOffset !== undefined && (rightFileEndLine === undefined || rightFileEndOffset === undefined)) {
    return errorResult("rightFileEndLine and rightFileEndOffset must both be specified when rightFileStartLine and rightFileStartOffset are both specified.");
  }

  if (
    rightFileStartLine !== undefined &&
    rightFileStartLine === rightFileEndLine &&
    rightFileEndOffset !== undefined &&
    rightFileStartOffset !== undefined &&
    rightFileEndOffset < rightFileStartOffset
  ) {
    return errorResult("rightFileEndOffset must be greater than or equal to rightFileStartOffset when both are on the same line.");
  }

  const iterationContextValues = [changeTrackingId, firstComparingIteration, secondComparingIteration];
  if (iterationContextValues.some((value) => value !== undefined) && iterationContextValues.some((value) => value === undefined)) {
    return errorResult("changeTrackingId, firstComparingIteration, and secondComparingIteration must all be specified together.");
  }

  const pullRequestThreadContext =
    changeTrackingId !== undefined && firstComparingIteration !== undefined && secondComparingIteration !== undefined
      ? { changeTrackingId, iterationContext: { firstComparingIteration, secondComparingIteration } }
      : undefined;
  const threadStatus = status === undefined ? CommentThreadStatus.Active : CommentThreadStatus[status as keyof typeof CommentThreadStatus];

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const thread = await gitApi.createThread({ comments: [{ content, commentType: 1 }], threadContext, pullRequestThreadContext, status: threadStatus }, repositoryId, pullRequestId, project);

  return { content: [{ type: "text", text: JSON.stringify(trimPullRequestThread(thread), null, 2) }] };
}

async function replyToPullRequestThread(args: ReplyToPullRequestThreadArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { repositoryId, pullRequestId, project, threadId, content, status, fullResponse } = args;
  if (!threadId) return errorResult("threadId is required for reply");
  if (!content) return errorResult("content is required for reply");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const comment = await gitApi.createComment({ content, commentType: 1 }, repositoryId, pullRequestId, threadId, project);

  if (!comment) return errorResult(`Error: Failed to add comment to thread ${threadId}. The comment was not created successfully.`);

  if (status === undefined) {
    if (fullResponse) return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
    return { content: [{ type: "text", text: JSON.stringify(trimComment(comment), null, 2) }] };
  }

  let statusUpdateError: string | undefined;
  let resultingThreadStatus: CommentThreadStatus | undefined;
  try {
    const thread = await gitApi.updateThread({ status: CommentThreadStatus[status as keyof typeof CommentThreadStatus] }, repositoryId, pullRequestId, threadId, project);
    if (!thread) {
      statusUpdateError = `Thread ${threadId} was not updated successfully.`;
    } else {
      resultingThreadStatus = thread.status;
    }
  } catch (error) {
    statusUpdateError = error instanceof Error ? error.message : "Unknown error occurred";
  }

  if (statusUpdateError !== undefined) {
    return errorResult(
      JSON.stringify(
        {
          message: `Comment ${comment.id} was posted successfully, but the thread status update failed. Do not retry the reply.`,
          comment: trimComment(comment),
          statusUpdate: {
            succeeded: false,
            requestedStatus: status,
            error: statusUpdateError,
          },
        },
        null,
        2
      )
    );
  }

  return { content: [{ type: "text", text: JSON.stringify({ comment: trimComment(comment), status: resultingThreadStatus }, null, 2) }] };
}

async function updatePullRequestComment(args: UpdatePullRequestCommentArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { repositoryId, pullRequestId, project, threadId, commentId, content, fullResponse } = args;
  if (!threadId) return errorResult("threadId is required for update");
  if (!commentId) return errorResult("commentId is required for update");
  if (!content) return errorResult("content is required for update");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const comment = await gitApi.updateComment({ content }, repositoryId, pullRequestId, threadId, commentId, project);

  if (!comment) return errorResult(`Error: Failed to update comment ${commentId} in thread ${threadId}. The comment was not updated successfully.`);
  if (fullResponse) return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };

  return { content: [{ type: "text", text: `Comment ${commentId} successfully updated in thread ${threadId}.` }] };
}

async function updatePullRequestThreadStatus(args: UpdatePullRequestThreadStatusArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  const { repositoryId, pullRequestId, project, threadId, status } = args;
  if (!threadId) return errorResult("threadId is required for update_status");
  if (!status) return errorResult("status is required for update_status");

  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();
  const updateRequest: Record<string, unknown> = {
    status: CommentThreadStatus[status as keyof typeof CommentThreadStatus],
  };

  const thread = await gitApi.updateThread(updateRequest, repositoryId, pullRequestId, threadId, project);

  if (!thread) return errorResult(`Error: Failed to update thread ${threadId}. The thread was not updated successfully.`);

  return { content: [{ type: "text", text: JSON.stringify(trimPullRequestThread(thread), null, 2) }] };
}

const repoPullRequestThreadWriteErrorPrefixes: Record<RepoPullRequestThreadWriteArgs["action"], string> = {
  create: "Error with pull request thread write operation: ",
  reply: "Error with pull request thread write operation: ",
  update: "Error with pull request thread write operation: ",
  update_status: "Error with pull request thread write operation: ",
};

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
    "Retrieve pull request data for a specific repository or project, or retrieve one pull request by ID. For the authenticated user's active pull requests across the entire organization, use repo_pull_request_org.",
    {
      action: z
        .enum(["get", "list", "list_by_commits"])
        .describe(
          "The action to perform. Options: get (get a pull request by ID), list (list pull requests in a repository or project), list_by_commits (find pull requests that contain specific commit IDs)."
        ),
      repositoryId: z.string().optional().describe("The ID or name of the repository. Required for get. Optional for list. When using a name instead of a GUID, project must also be provided."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The ID of the pull request. Required for get."),
      project: z.string().optional().describe("Project ID or name. Required for list_by_commits and when repositoryId is a name. Optional when repositoryId is a GUID."),
      includeWorkItemRefs: z.boolean().optional().default(false).describe("Whether to include work item references. Used for get."),
      includeLabels: z.boolean().optional().default(false).describe("Whether to include labels. Used for get."),
      includeChangedFiles: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to include the list of changed files, compared against the common commit (iteration 0). When changedFilesSummary returns a nextSkip greater than 0, pass nextSkip and nextTop back as skip and top for the next page. Used for get."
        ),
      top: z.coerce.number().default(100).describe("The maximum number of pull requests to return (list), or of changed files to return (get with includeChangedFiles). Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of pull requests to skip (list), or of changed files to skip (get with includeChangedFiles). Defaults to 0."),
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
    }) => {
      try {
        if (action === "get") {
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for get" }], isError: true };
          if (!pullRequestId) return { content: [{ type: "text", text: "pullRequestId is required for get" }], isError: true };
          if (!project && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(repositoryId)) {
            return {
              content: [{ type: "text", text: "When repositoryId is a repository name, project is required. Provide the project name or ID, or use the repository GUID." }],
              isError: true,
            };
          }

          const connection = await connectionProvider();
          const gitApi = await connection.getGitApi();
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
                  const changes = await gitApi.getPullRequestIterationChanges(repositoryId, pullRequestId, latestIteration.id, project, top, skip);
                  enhancedResponse = {
                    ...enhancedResponse,
                    changedFilesSummary: {
                      changeEntries: changes?.changeEntries ?? [],
                      fileCount: changes?.changeEntries?.length ?? 0,
                      firstComparingIteration: 0,
                      secondComparingIteration: latestIteration.id,
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

          return createExternalContentResponse(enhancedResponse, "pull request");
        }

        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

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

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with pull request operation: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- repo_pull_request_org -------------------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_org,
    "List active pull requests across all projects and repositories in the organization for the authenticated user. Use this tool for organization-wide requests such as 'my pull requests' or 'pull requests awaiting my review'. For a specific project, repository, or pull request ID, use repo_pull_request.",
    {
      is_reviewer: z
        .boolean()
        .default(false)
        .describe("Set to true for active pull requests where the authenticated user is a reviewer. Set to false for active pull requests created by the authenticated user."),
      reviewStatus: z
        .enum(["all", "approved", "pending"])
        .default("all")
        .describe(
          "Filter by the authenticated user's reviewer vote when is_reviewer is true: all includes every vote, approved includes Approved and Approved with suggestions, and pending includes only No vote."
        ),
      top: z.coerce.number().default(100).describe("The maximum number of active pull requests to retrieve before applying the reviewStatus filter. Defaults to 100."),
      skip: z.coerce.number().default(0).describe("The number of active pull requests to skip before applying the reviewStatus filter. Defaults to 0."),
    },
    async ({ is_reviewer, reviewStatus, top, skip }) => {
      try {
        const currentUser = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
        const userId = currentUser.authenticatedUser.id;
        const identityFilter = is_reviewer ? "reviewerId" : "creatorId";
        const connection = await connectionProvider();
        const pullRequests = await getOrganizationPullRequests(connection, identityFilter, userId, PullRequestStatus.Active, skip, top);

        const filteredPullRequests = pullRequests.filter((pullRequest) => {
          if (!is_reviewer || reviewStatus === "all") return true;

          const reviewer = pullRequest.reviewers?.find((item) => item.id === userId);
          if (reviewStatus === "approved") return reviewer?.vote === 10 || reviewer?.vote === 5;
          return reviewer?.vote === 0;
        });

        const trimmedPullRequests = filteredPullRequests.map((pullRequest) => trimOrganizationPullRequest(pullRequest));

        return { content: [{ type: "text", text: JSON.stringify(trimmedPullRequests, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error with organization pull request operation: ${errorMessage}` }], isError: true };
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
        .describe("How to interpret the version parameter. Defaults to 'Commit' for get_content and 'Branch' for list_directory."),
      recursive: z.boolean().optional().default(false).describe("Whether to list items recursively. Used for list_directory. Defaults to false."),
      recursionDepth: z.coerce.number().min(1).optional().default(1).describe("Maximum depth for recursive listing. Used for list_directory when recursive is true. Defaults to 1."),
    },
    async ({ action, repositoryId, path, project, version, versionType, recursive, recursionDepth }) => {
      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        if (action === "get_content") {
          if (!path) return { content: [{ type: "text", text: "path is required for get_content" }], isError: true };

          const versionDescriptor = buildVersionDescriptor(version, versionType ?? "Commit");

          const stream = await gitApi.getItemText(repositoryId, path, project, undefined, undefined, undefined, undefined, false, versionDescriptor, true);
          const content = await streamToString(stream);

          const streamError = extractAdoStreamError(content);
          if (streamError) {
            return { content: [{ type: "text", text: `Error getting file content for '${path}': ${streamError}` }], isError: true };
          }

          return createExternalContentResponse(content, "repository file");
        }

        if (action === "list_directory") {
          const versionDescriptor = buildVersionDescriptor(version, versionType);
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

  // --- repo_file_write -------------------------------------------------------
  server.tool(REPO_TOOLS.repo_file_write, "Create or update a text file in an existing repository branch and commit the change.", repoFileWriteShape, async (args) => {
    try {
      switch (args.action) {
        case "create":
        case "update":
          return await writeRepositoryFile(args, connectionProvider);
        default: {
          const unsupportedAction: never = args.action;
          return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(repoFileWriteErrorPrefixes).sort().join(", ")}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return errorResult(`${repoFileWriteErrorPrefixes[args.action]}${message}`);
    }
  });

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
  server.tool(REPO_TOOLS.repo_pull_request_write, "Write operations for pull requests. Use the action parameter to specify the operation.", repoPullRequestWriteShape, async (args) => {
    try {
      switch (args.action) {
        case "create":
          return await createPullRequest(args, connectionProvider);
        case "update":
          return await updatePullRequest(args, connectionProvider, tokenProvider, userAgentProvider);
        case "update_reviewers":
          return await updatePullRequestReviewers(args, connectionProvider);
        case "vote":
          return await votePullRequest(args, connectionProvider, tokenProvider, userAgentProvider);
        default: {
          const unsupportedAction: never = args.action;
          return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(repoPullRequestWriteErrorPrefixes).sort().join(", ")}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return errorResult(`${repoPullRequestWriteErrorPrefixes[args.action]}${message}`);
    }
  });

  // --- repo_pull_request_thread_write ----------------------------------------
  server.tool(
    REPO_TOOLS.repo_pull_request_thread_write,
    "Write operations for pull request comment threads. Use the action parameter to specify the operation.",
    repoPullRequestThreadWriteShape,
    async (args) => {
      try {
        switch (args.action) {
          case "create":
            return await createPullRequestThread(args, connectionProvider);
          case "reply":
            return await replyToPullRequestThread(args, connectionProvider);
          case "update":
            return await updatePullRequestComment(args, connectionProvider);
          case "update_status":
            return await updatePullRequestThreadStatus(args, connectionProvider);
          default: {
            const unsupportedAction: never = args.action;
            return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(repoPullRequestThreadWriteErrorPrefixes).sort().join(", ")}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        return errorResult(`${repoPullRequestThreadWriteErrorPrefixes[args.action]}${message}`);
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

export {
  REPO_TOOLS,
  configureRepoTools,
  writeRepositoryFile,
  createPullRequest,
  updatePullRequest,
  updatePullRequestReviewers,
  votePullRequest,
  createPullRequestThread,
  replyToPullRequestThread,
  updatePullRequestComment,
  updatePullRequestThreadStatus,
};
export type {
  WriteRepositoryFileArgs,
  RepoFileWriteArgs,
  CreatePullRequestArgs,
  UpdatePullRequestArgs,
  UpdatePullRequestReviewersArgs,
  VotePullRequestArgs,
  CreatePullRequestThreadArgs,
  ReplyToPullRequestThreadArgs,
  UpdatePullRequestCommentArgs,
  UpdatePullRequestThreadStatusArgs,
};
