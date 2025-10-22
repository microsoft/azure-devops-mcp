// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  GitRef,
  GitForkRef,
  PullRequestStatus,
  GitQueryCommitsCriteria,
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
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getCurrentUserDetails, getUserIdFromEmail } from "./auth.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces.js";
import { getEnumKeys } from "../utils.js";

const REPO_TOOLS = {
  list_repos_by_project: "repo_list_repos_by_project",
  list_pull_requests_by_repo_or_project: "repo_list_pull_requests_by_repo_or_project",
  list_branches_by_repo: "repo_list_branches_by_repo",
  list_my_branches_by_repo: "repo_list_my_branches_by_repo",
  list_pull_request_threads: "repo_list_pull_request_threads",
  list_pull_request_thread_comments: "repo_list_pull_request_thread_comments",
  get_repo_by_name_or_id: "repo_get_repo_by_name_or_id",
  get_branch_by_name: "repo_get_branch_by_name",
  get_pull_request_by_id: "repo_get_pull_request_by_id",
  create_pull_request: "repo_create_pull_request",
  create_branch: "repo_create_branch",
  update_pull_request: "repo_update_pull_request",
  update_pull_request_reviewers: "repo_update_pull_request_reviewers",
  reply_to_comment: "repo_reply_to_comment",
  create_pull_request_thread: "repo_create_pull_request_thread",
  resolve_comment: "repo_resolve_comment",
  search_commits: "repo_search_commits",
  list_pull_requests_by_commits: "repo_list_pull_requests_by_commits",
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
  };
}

/**
 * Trims comment data to essential properties, filtering out deleted comments
 * @param comments Array of comments to trim (can be undefined/null)
 * @returns Array of trimmed comment objects with essential properties only
 */
function trimComments(comments: Comment[] | undefined | null) {
  return comments
    ?.filter((comment) => !comment.isDeleted) // Exclude deleted comments
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
  const filteredByName = repositories?.filter((repo) => repo.name?.toLowerCase().includes(lowerCaseFilter));

  return filteredByName;
}

function trimPullRequest(pr: GitPullRequest, includeDescription = false) {
  return {
    pullRequestId: pr.pullRequestId,
    codeReviewId: pr.codeReviewId,
    repository: pr.repository?.name,
    status: pr.status,
    createdBy: {
      displayName: pr.createdBy?.displayName,
      uniqueName: pr.createdBy?.uniqueName,
    },
    creationDate: pr.creationDate,
    title: pr.title,
    ...(includeDescription ? { description: pr.description ?? "" } : {}),
    isDraft: pr.isDraft,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
  };
}

function configureRepoTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, isReadOnlyMode: boolean) {
  const registeredTools: RegisteredTool[] = [
    server.tool(
      REPO_TOOLS.create_pull_request,
      "Create a new pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request will be created."),
        sourceRefName: z.string().describe("The source branch name for the pull request, e.g., 'refs/heads/feature-branch'."),
        targetRefName: z.string().describe("The target branch name for the pull request, e.g., 'refs/heads/main'."),
        title: z.string().describe("The title of the pull request."),
        description: z.string().optional().describe("The description of the pull request. Optional."),
        isDraft: z.boolean().optional().default(false).describe("Indicates whether the pull request is a draft. Defaults to false."),
        workItems: z.string().optional().describe("Work item IDs to associate with the pull request, space-separated."),
        forkSourceRepositoryId: z.string().optional().describe("The ID of the fork repository that the pull request originates from. Optional, used when creating a pull request from a fork."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, sourceRefName, targetRefName, title, description, isDraft, workItems, forkSourceRepositoryId }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const workItemRefs = workItems ? workItems.split(" ").map((id) => ({ id: id.trim() })) : [];

        const forkSource: GitForkRef | undefined = forkSourceRepositoryId
          ? {
              repository: {
                id: forkSourceRepositoryId,
              },
            }
          : undefined;

        const pullRequest = await gitApi.createPullRequest(
          {
            sourceRefName,
            targetRefName,
            title,
            description,
            isDraft,
            workItemRefs: workItemRefs,
            forkSource,
          },
          repositoryId
        );

        const trimmedPullRequest = trimPullRequest(pullRequest, true);

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedPullRequest, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.create_branch,
      "Create a new branch in the repository.",
      {
        repositoryId: z.string().describe("The ID of the repository where the branch will be created."),
        branchName: z.string().describe("The name of the new branch to create, e.g., 'feature-branch'."),
        sourceBranchName: z.string().optional().default("main").describe("The name of the source branch to create the new branch from. Defaults to 'main'."),
        sourceCommitId: z.string().optional().describe("The commit ID to create the branch from. If not provided, uses the latest commit of the source branch."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, branchName, sourceBranchName, sourceCommitId }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        let commitId = sourceCommitId;

        // If no commit ID is provided, get the latest commit from the source branch
        if (!commitId) {
          const sourceRefName = `refs/heads/${sourceBranchName}`;
          try {
            const sourceBranch = await gitApi.getRefs(repositoryId, undefined, "heads/", false, false, undefined, false, undefined, sourceBranchName);
            const branch = sourceBranch.find((b) => b.name === sourceRefName);
            if (!branch || !branch.objectId) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Error: Source branch '${sourceBranchName}' not found in repository ${repositoryId}`,
                  },
                ],
                isError: true,
              };
            }
            commitId = branch.objectId;
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error retrieving source branch '${sourceBranchName}': ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        // Create the new branch using updateRefs
        const newRefName = `refs/heads/${branchName}`;
        const refUpdate = {
          name: newRefName,
          newObjectId: commitId,
          oldObjectId: "0000000000000000000000000000000000000000", // All zeros indicates creating a new ref
        };

        try {
          const result = await gitApi.updateRefs([refUpdate], repositoryId);

          // Check if the branch creation was successful
          if (result && result.length > 0 && result[0].success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Branch '${branchName}' created successfully from '${sourceBranchName}' (${commitId})`,
                },
              ],
            };
          } else {
            const errorMessage = result && result.length > 0 && result[0].customMessage ? result[0].customMessage : "Unknown error occurred during branch creation";
            return {
              content: [
                {
                  type: "text",
                  text: `Error creating branch '${branchName}': ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    server.tool(
      REPO_TOOLS.update_pull_request,
      "Update a Pull Request by ID with specified fields, including setting autocomplete with various completion options.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request exists."),
        pullRequestId: z.number().describe("The ID of the pull request to update."),
        title: z.string().optional().describe("The new title for the pull request."),
        description: z.string().optional().describe("The new description for the pull request."),
        isDraft: z.boolean().optional().describe("Whether the pull request should be a draft."),
        targetRefName: z.string().optional().describe("The new target branch name (e.g., 'refs/heads/main')."),
        status: z.enum(["Active", "Abandoned"]).optional().describe("The new status of the pull request. Can be 'Active' or 'Abandoned'."),
        autoComplete: z.boolean().optional().describe("Set the pull request to autocomplete when all requirements are met."),
        mergeStrategy: z
          .enum(getEnumKeys(GitPullRequestMergeStrategy) as [string, ...string[]])
          .optional()
          .describe("The merge strategy to use when the pull request autocompletes. Defaults to 'NoFastForward'."),
        deleteSourceBranch: z.boolean().optional().default(false).describe("Whether to delete the source branch when the pull request autocompletes. Defaults to false."),
        transitionWorkItems: z.boolean().optional().default(true).describe("Whether to transition associated work items to the next state when the pull request autocompletes. Defaults to true."),
        bypassReason: z.string().optional().describe("Reason for bypassing branch policies. When provided, branch policies will be automatically bypassed during autocompletion."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, pullRequestId, title, description, isDraft, targetRefName, status, autoComplete, mergeStrategy, deleteSourceBranch, transitionWorkItems, bypassReason }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        // Build update object with only provided fields
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
            const autoCompleteUserId = data.authenticatedUser.id;
            updateRequest.autoCompleteSetBy = { id: autoCompleteUserId };

            const completionOptions: GitPullRequestCompletionOptions = {
              deleteSourceBranch: deleteSourceBranch || false,
              transitionWorkItems: transitionWorkItems !== false, // Default to true unless explicitly set to false
              bypassPolicy: !!bypassReason, // Automatically set to true if bypassReason is provided
            };

            if (mergeStrategy) {
              completionOptions.mergeStrategy = GitPullRequestMergeStrategy[mergeStrategy as keyof typeof GitPullRequestMergeStrategy];
            }

            if (bypassReason) {
              completionOptions.bypassReason = bypassReason;
            }

            updateRequest.completionOptions = completionOptions;
          } else {
            updateRequest.autoCompleteSetBy = null;
            updateRequest.completionOptions = null;
          }
        }

        // Validate that at least one field is provided for update
        if (Object.keys(updateRequest).length === 0) {
          return {
            content: [{ type: "text", text: "Error: At least one field (title, description, isDraft, targetRefName, status, or autoComplete options) must be provided for update." }],
            isError: true,
          };
        }

        const updatedPullRequest = await gitApi.updatePullRequest(updateRequest, repositoryId, pullRequestId);
        const trimmedUpdatedPullRequest = trimPullRequest(updatedPullRequest, true);

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedUpdatedPullRequest, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.update_pull_request_reviewers,
      "Add or remove reviewers for an existing pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request exists."),
        pullRequestId: z.number().describe("The ID of the pull request to update."),
        reviewerIds: z.array(z.string()).describe("List of reviewer ids to add or remove from the pull request."),
        action: z.enum(["add", "remove"]).describe("Action to perform on the reviewers. Can be 'add' or 'remove'."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, pullRequestId, reviewerIds, action }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        let updatedPullRequest;
        if (action === "add") {
          updatedPullRequest = await gitApi.createPullRequestReviewers(
            reviewerIds.map((id) => ({ id: id })),
            repositoryId,
            pullRequestId
          );

          const trimmedResponse = updatedPullRequest.map((item) => ({
            displayName: item.displayName,
            id: item.id,
            uniqueName: item.uniqueName,
            vote: item.vote,
            hasDeclined: item.hasDeclined,
            isFlagged: item.isFlagged,
          }));

          return {
            content: [{ type: "text", text: JSON.stringify(trimmedResponse, null, 2) }],
          };
        } else {
          for (const reviewerId of reviewerIds) {
            await gitApi.deletePullRequestReviewer(repositoryId, pullRequestId, reviewerId);
          }

          return {
            content: [{ type: "text", text: `Reviewers with IDs ${reviewerIds.join(", ")} removed from pull request ${pullRequestId}.` }],
          };
        }
      }
    ),

    server.tool(
      REPO_TOOLS.list_repos_by_project,
      "Retrieve a list of repositories for a given project",
      {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        top: z.number().default(100).describe("The maximum number of repositories to return."),
        skip: z.number().default(0).describe("The number of repositories to skip. Defaults to 0."),
        repoNameFilter: z.string().optional().describe("Optional filter to search for repositories by name. If provided, only repositories with names containing this string will be returned."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, top, skip, repoNameFilter }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const repositories = await gitApi.getRepositories(project, false, false, false);

        const filteredRepositories = repoNameFilter ? filterReposByName(repositories, repoNameFilter) : repositories;

        const paginatedRepositories = filteredRepositories?.sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0).slice(skip, skip + top);

        // Filter out the irrelevant properties
        const trimmedRepositories = paginatedRepositories?.map((repo) => ({
          id: repo.id,
          name: repo.name,
          isDisabled: repo.isDisabled,
          isFork: repo.isFork,
          isInMaintenance: repo.isInMaintenance,
          webUrl: repo.webUrl,
          size: repo.size,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedRepositories, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.list_pull_requests_by_repo_or_project,
      "Retrieve a list of pull requests for a given repository. Either repositoryId or project must be provided.",
      {
        repositoryId: z.string().optional().describe("The ID of the repository where the pull requests are located."),
        project: z.string().optional().describe("The ID of the project where the pull requests are located."),
        top: z.number().default(100).describe("The maximum number of pull requests to return."),
        skip: z.number().default(0).describe("The number of pull requests to skip."),
        created_by_me: z.boolean().default(false).describe("Filter pull requests created by the current user."),
        created_by_user: z.string().optional().describe("Filter pull requests created by a specific user (provide email or unique name). Takes precedence over created_by_me if both are provided."),
        i_am_reviewer: z.boolean().default(false).describe("Filter pull requests where the current user is a reviewer."),
        user_is_reviewer: z
          .string()
          .optional()
          .describe("Filter pull requests where a specific user is a reviewer (provide email or unique name). Takes precedence over i_am_reviewer if both are provided."),
        status: z
          .enum(getEnumKeys(PullRequestStatus) as [string, ...string[]])
          .default("Active")
          .describe("Filter pull requests by status. Defaults to 'Active'."),
        sourceRefName: z.string().optional().describe("Filter pull requests from this source branch (e.g., 'refs/heads/feature-branch')."),
        targetRefName: z.string().optional().describe("Filter pull requests into this target branch (e.g., 'refs/heads/main')."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, project, top, skip, created_by_me, created_by_user, i_am_reviewer, user_is_reviewer, status, sourceRefName, targetRefName }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        // Build the search criteria
        const searchCriteria: {
          status: number;
          repositoryId?: string;
          creatorId?: string;
          reviewerId?: string;
          sourceRefName?: string;
          targetRefName?: string;
        } = {
          status: pullRequestStatusStringToInt(status),
        };

        if (!repositoryId && !project) {
          return {
            content: [
              {
                type: "text",
                text: "Either repositoryId or project must be provided.",
              },
            ],
            isError: true,
          };
        }

        if (repositoryId) {
          searchCriteria.repositoryId = repositoryId;
        }

        if (sourceRefName) {
          searchCriteria.sourceRefName = sourceRefName;
        }

        if (targetRefName) {
          searchCriteria.targetRefName = targetRefName;
        }

        if (created_by_user) {
          try {
            const userId = await getUserIdFromEmail(created_by_user, tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.creatorId = userId;
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error finding user with email ${created_by_user}: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        } else if (created_by_me) {
          const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
          const userId = data.authenticatedUser.id;
          searchCriteria.creatorId = userId;
        }

        if (user_is_reviewer) {
          try {
            const reviewerUserId = await getUserIdFromEmail(user_is_reviewer, tokenProvider, connectionProvider, userAgentProvider);
            searchCriteria.reviewerId = reviewerUserId;
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error finding reviewer with email ${user_is_reviewer}: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        } else if (i_am_reviewer) {
          const data = await getCurrentUserDetails(tokenProvider, connectionProvider, userAgentProvider);
          const userId = data.authenticatedUser.id;
          searchCriteria.reviewerId = userId;
        }

        let pullRequests;
        if (repositoryId) {
          pullRequests = await gitApi.getPullRequests(
            repositoryId,
            searchCriteria,
            project, // project
            undefined, // maxCommentLength
            skip,
            top
          );
        } else if (project) {
          // If only project is provided, use getPullRequestsByProject
          pullRequests = await gitApi.getPullRequestsByProject(
            project,
            searchCriteria,
            undefined, // maxCommentLength
            skip,
            top
          );
        } else {
          // This case should not occur due to earlier validation, but added for completeness
          return {
            content: [
              {
                type: "text",
                text: "Either repositoryId or project must be provided.",
              },
            ],
            isError: true,
          };
        }

        const filteredPullRequests = pullRequests?.map((pr) => trimPullRequest(pr));

        return {
          content: [{ type: "text", text: JSON.stringify(filteredPullRequests, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.list_pull_request_threads,
      "Retrieve a list of comment threads for a pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request for which to retrieve threads."),
        project: z.string().optional().describe("Project ID or project name (optional)"),
        iteration: z.number().optional().describe("The iteration ID for which to retrieve threads. Optional, defaults to the latest iteration."),
        baseIteration: z.number().optional().describe("The base iteration ID for which to retrieve threads. Optional, defaults to the latest base iteration."),
        top: z.number().default(100).describe("The maximum number of threads to return."),
        skip: z.number().default(0).describe("The number of threads to skip."),
        fullResponse: z.boolean().optional().default(false).describe("Return full thread JSON response instead of trimmed data."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, pullRequestId, project, iteration, baseIteration, top, skip, fullResponse }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const threads = await gitApi.getThreads(repositoryId, pullRequestId, project, iteration, baseIteration);

        const paginatedThreads = threads?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

        if (fullResponse) {
          return {
            content: [{ type: "text", text: JSON.stringify(paginatedThreads, null, 2) }],
          };
        }

        // Return trimmed thread data focusing on essential information
        const trimmedThreads = paginatedThreads?.map((thread) => trimPullRequestThread(thread));

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedThreads, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.list_pull_request_thread_comments,
      "Retrieve a list of comments in a pull request thread.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request for which to retrieve thread comments."),
        threadId: z.number().describe("The ID of the thread for which to retrieve comments."),
        project: z.string().optional().describe("Project ID or project name (optional)"),
        top: z.number().default(100).describe("The maximum number of comments to return."),
        skip: z.number().default(0).describe("The number of comments to skip."),
        fullResponse: z.boolean().optional().default(false).describe("Return full comment JSON response instead of trimmed data."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, pullRequestId, threadId, project, top, skip, fullResponse }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        // Get thread comments - GitApi uses getComments for retrieving comments from a specific thread
        const comments = await gitApi.getComments(repositoryId, pullRequestId, threadId, project);

        const paginatedComments = comments?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(skip, skip + top);

        if (fullResponse) {
          return {
            content: [{ type: "text", text: JSON.stringify(paginatedComments, null, 2) }],
          };
        }

        // Return trimmed comment data focusing on essential information
        const trimmedComments = trimComments(paginatedComments);

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedComments, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.list_branches_by_repo,
      "Retrieve a list of branches for a given repository.",
      {
        repositoryId: z.string().describe("The ID of the repository where the branches are located."),
        top: z.number().default(100).describe("The maximum number of branches to return. Defaults to 100."),
        filterContains: z.string().optional().describe("Filter to find branches that contain this string in their name."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, top, filterContains }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const branches = await gitApi.getRefs(repositoryId, undefined, "heads/", undefined, undefined, undefined, undefined, undefined, filterContains);

        const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);

        return {
          content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.list_my_branches_by_repo,
      "Retrieve a list of my branches for a given repository Id.",
      {
        repositoryId: z.string().describe("The ID of the repository where the branches are located."),
        top: z.number().default(100).describe("The maximum number of branches to return."),
        filterContains: z.string().optional().describe("Filter to find branches that contain this string in their name."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, top, filterContains }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const branches = await gitApi.getRefs(repositoryId, undefined, "heads/", undefined, undefined, true, undefined, undefined, filterContains);

        const filteredBranches = branchesFilterOutIrrelevantProperties(branches, top);

        return {
          content: [{ type: "text", text: JSON.stringify(filteredBranches, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.get_repo_by_name_or_id,
      "Get the repository by project and repository name or ID.",
      {
        project: z.string().describe("Project name or ID where the repository is located."),
        repositoryNameOrId: z.string().describe("Repository name or ID."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, repositoryNameOrId }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const repositories = await gitApi.getRepositories(project);

        const repository = repositories?.find((repo) => repo.name === repositoryNameOrId || repo.id === repositoryNameOrId);

        if (!repository) {
          throw new Error(`Repository ${repositoryNameOrId} not found in project ${project}`);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.get_branch_by_name,
      "Get a branch by its name.",
      {
        repositoryId: z.string().describe("The ID of the repository where the branch is located."),
        branchName: z.string().describe("The name of the branch to retrieve, e.g., 'main' or 'feature-branch'."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, branchName }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const branches = await gitApi.getRefs(repositoryId, undefined, "heads/", false, false, undefined, false, undefined, branchName);
        const branch = branches.find((branch) => branch.name === `refs/heads/${branchName}` || branch.name === branchName);
        if (!branch) {
          return {
            content: [
              {
                type: "text",
                text: `Branch ${branchName} not found in repository ${repositoryId}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.get_pull_request_by_id,
      "Get a pull request by its ID.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request to retrieve."),
        includeWorkItemRefs: z.boolean().optional().default(false).describe("Whether to reference work items associated with the pull request."),
      },
      {
        readOnlyHint: true,
      },
      async ({ repositoryId, pullRequestId, includeWorkItemRefs }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const pullRequest = await gitApi.getPullRequest(repositoryId, pullRequestId, undefined, undefined, undefined, undefined, undefined, includeWorkItemRefs);
        return {
          content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.reply_to_comment,
      "Replies to a specific comment on a pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request where the comment thread exists."),
        threadId: z.number().describe("The ID of the thread to which the comment will be added."),
        content: z.string().describe("The content of the comment to be added."),
        project: z.string().optional().describe("Project ID or project name (optional)"),
        fullResponse: z.boolean().optional().default(false).describe("Return full comment JSON response instead of a simple confirmation message."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, pullRequestId, threadId, content, project, fullResponse }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const comment = await gitApi.createComment({ content }, repositoryId, pullRequestId, threadId, project);

        // Check if the comment was successfully created
        if (!comment) {
          return {
            content: [{ type: "text", text: `Error: Failed to add comment to thread ${threadId}. The comment was not created successfully.` }],
            isError: true,
          };
        }

        if (fullResponse) {
          return {
            content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: `Comment successfully added to thread ${threadId}.` }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.create_pull_request_thread,
      "Creates a new comment thread on a pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request where the comment thread exists."),
        content: z.string().describe("The content of the comment to be added."),
        project: z.string().optional().describe("Project ID or project name (optional)"),
        filePath: z.string().optional().describe("The path of the file where the comment thread will be created. (optional)"),
        status: z
          .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
          .optional()
          .default(CommentThreadStatus[CommentThreadStatus.Active])
          .describe("The status of the comment thread. Defaults to 'Active'."),
        rightFileStartLine: z.number().optional().describe("Position of first character of the thread's span in right file. The line number of a thread's position. Starts at 1. (optional)"),
        rightFileStartOffset: z
          .number()
          .optional()
          .describe(
            "Position of first character of the thread's span in right file. The line number of a thread's position. The character offset of a thread's position inside of a line. Starts at 1. Must only be set if rightFileStartLine is also specified. (optional)"
          ),
        rightFileEndLine: z
          .number()
          .optional()
          .describe(
            "Position of last character of the thread's span in right file. The line number of a thread's position. Starts at 1. Must only be set if rightFileStartLine is also specified. (optional)"
          ),
        rightFileEndOffset: z
          .number()
          .optional()
          .describe(
            "Position of last character of the thread's span in right file. The character offset of a thread's position inside of a line. Must only be set if rightFileEndLine is also specified. (optional)"
          ),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, pullRequestId, content, project, filePath, status, rightFileStartLine, rightFileStartOffset, rightFileEndLine, rightFileEndOffset }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const normalizedFilePath = filePath && !filePath.startsWith("/") ? `/${filePath}` : filePath;
        const threadContext: CommentThreadContext = { filePath: normalizedFilePath };

        if (rightFileStartLine !== undefined) {
          if (rightFileStartLine < 1) {
            throw new Error("rightFileStartLine must be greater than or equal to 1.");
          }

          threadContext.rightFileStart = { line: rightFileStartLine };

          if (rightFileStartOffset !== undefined) {
            if (rightFileStartOffset < 1) {
              throw new Error("rightFileStartOffset must be greater than or equal to 1.");
            }

            threadContext.rightFileStart.offset = rightFileStartOffset;
          }
        }

        if (rightFileEndLine !== undefined) {
          if (rightFileStartLine === undefined) {
            throw new Error("rightFileEndLine must only be specified if rightFileStartLine is also specified.");
          }

          if (rightFileEndLine < 1) {
            throw new Error("rightFileEndLine must be greater than or equal to 1.");
          }

          threadContext.rightFileEnd = { line: rightFileEndLine };

          if (rightFileEndOffset !== undefined) {
            if (rightFileEndOffset < 1) {
              throw new Error("rightFileEndOffset must be greater than or equal to 1.");
            }

            threadContext.rightFileEnd.offset = rightFileEndOffset;
          }
        }

        const thread = await gitApi.createThread(
          { comments: [{ content: content }], threadContext: threadContext, status: CommentThreadStatus[status as keyof typeof CommentThreadStatus] },
          repositoryId,
          pullRequestId,
          project
        );

        const trimmedThread = trimPullRequestThread(thread);

        return {
          content: [{ type: "text", text: JSON.stringify(trimmedThread, null, 2) }],
        };
      }
    ),

    server.tool(
      REPO_TOOLS.resolve_comment,
      "Resolves a specific comment thread on a pull request.",
      {
        repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
        pullRequestId: z.number().describe("The ID of the pull request where the comment thread exists."),
        threadId: z.number().describe("The ID of the thread to be resolved."),
        fullResponse: z.boolean().optional().default(false).describe("Return full thread JSON response instead of a simple confirmation message."),
      },
      {
        readOnlyHint: false,
      },
      async ({ repositoryId, pullRequestId, threadId, fullResponse }) => {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();
        const thread = await gitApi.updateThread(
          { status: 2 }, // 2 corresponds to "Resolved" status
          repositoryId,
          pullRequestId,
          threadId
        );

        // Check if the thread was successfully resolved
        if (!thread) {
          return {
            content: [{ type: "text", text: `Error: Failed to resolve thread ${threadId}. The thread status was not updated successfully.` }],
            isError: true,
          };
        }

        if (fullResponse) {
          return {
            content: [{ type: "text", text: JSON.stringify(thread, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: `Thread ${threadId} was successfully resolved.` }],
        };
      }
    ),

    (() => {
      const gitVersionTypeStrings = Object.values(GitVersionType).filter((value): value is string => typeof value === "string");
      return server.tool(
        REPO_TOOLS.search_commits,
        "Searches for commits in a repository",
        {
          project: z.string().describe("Project name or ID"),
          repository: z.string().describe("Repository name or ID"),
          fromCommit: z.string().optional().describe("Starting commit ID"),
          toCommit: z.string().optional().describe("Ending commit ID"),
          version: z.string().optional().describe("The name of the branch, tag or commit to filter commits by"),
          versionType: z
            .enum(gitVersionTypeStrings as [string, ...string[]])
            .optional()
            .default(GitVersionType[GitVersionType.Branch])
            .describe("The meaning of the version parameter, e.g., branch, tag or commit"),
          skip: z.number().optional().default(0).describe("Number of commits to skip"),
          top: z.number().optional().default(10).describe("Maximum number of commits to return"),
          includeLinks: z.boolean().optional().default(false).describe("Include commit links"),
          includeWorkItems: z.boolean().optional().default(false).describe("Include associated work items"),
        },
        {
          readOnlyHint: true,
        },
        async ({ project, repository, fromCommit, toCommit, version, versionType, skip, top, includeLinks, includeWorkItems }) => {
          try {
            const connection = await connectionProvider();
            const gitApi = await connection.getGitApi();

            const searchCriteria: GitQueryCommitsCriteria = {
              fromCommitId: fromCommit,
              toCommitId: toCommit,
              includeLinks: includeLinks,
              includeWorkItems: includeWorkItems,
            };

            if (version) {
              const itemVersion: GitVersionDescriptor = {
                version: version,
                versionType: GitVersionType[versionType as keyof typeof GitVersionType],
              };
              searchCriteria.itemVersion = itemVersion;
            }

            const commits = await gitApi.getCommits(
              repository,
              searchCriteria,
              project,
              skip, // skip
              top
            );

            return {
              content: [{ type: "text", text: JSON.stringify(commits, null, 2) }],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error searching commits: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
    })(),

    (() => {
      const pullRequestQueryTypesStrings = Object.values(GitPullRequestQueryType).filter((value): value is string => typeof value === "string");

      return server.tool(
        REPO_TOOLS.list_pull_requests_by_commits,
        "Lists pull requests by commit IDs to find which pull requests contain specific commits",
        {
          project: z.string().describe("Project name or ID"),
          repository: z.string().describe("Repository name or ID"),
          commits: z.array(z.string()).describe("Array of commit IDs to query for"),
          queryType: z
            .enum(pullRequestQueryTypesStrings as [string, ...string[]])
            .optional()
            .default(GitPullRequestQueryType[GitPullRequestQueryType.LastMergeCommit])
            .describe("Type of query to perform"),
        },
        {
          readOnlyHint: true,
        },
        async ({ project, repository, commits, queryType }) => {
          try {
            const connection = await connectionProvider();
            const gitApi = await connection.getGitApi();

            const query: GitPullRequestQuery = {
              queries: [
                {
                  items: commits,
                  type: GitPullRequestQueryType[queryType as keyof typeof GitPullRequestQueryType],
                } as GitPullRequestQueryInput,
              ],
            };

            const queryResult = await gitApi.getPullRequestQuery(query, repository, project);

            return {
              content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error querying pull requests by commits: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
    })(),
  ];

  if (isReadOnlyMode) {
    for (const tool of registeredTools) {
      if (!tool.annotations?.readOnlyHint) {
        tool.remove();
      }
    }
  }
}

export { REPO_TOOLS, configureRepoTools };
