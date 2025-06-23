// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { GitRef } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { z } from "zod";
import { getCurrentUserDetails } from "./auth.js";

const REPO_TOOLS = {
  list_all_repos_by_project: "repo_list_repos_by_project",
  search_repos_by_name: "repo_search_repos_by_name",
  get_repo_by_name_or_id: "repo_get_repo_by_name_or_id",
  list_pull_requests_by_repo: "repo_list_pull_requests_by_repo",
  list_pull_requests_by_project: "repo_list_pull_requests_by_project",
  list_branches_by_repo: "repo_list_branches_by_repo",
  list_my_branches_by_repo: "repo_list_my_branches_by_repo",
  list_pull_request_threads: "repo_list_pull_request_threads",
  list_pull_request_thread_comments: "repo_list_pull_request_thread_comments",
  get_branch_by_name: "repo_get_branch_by_name",
  get_pull_request_by_id: "repo_get_pull_request_by_id",
  create_pull_request: "repo_create_pull_request",  
  update_pull_request_status: "repo_update_pull_request_status",
  reply_to_comment: "repo_reply_to_comment",
  resolve_comment: "repo_resolve_comment",
};

function branchesFilterOutIrrelevantProperties(
  branches: GitRef[],
  top: number
) {
  return branches
    ?.flatMap((branch) => (branch.name ? [branch.name] : []))
    ?.filter((branch) => branch.startsWith("refs/heads/"))
    .map((branch) => branch.replace("refs/heads/", ""))
    .slice(0, top);
}

function configureRepoTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
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
    },
    async ({
      repositoryId,
      sourceRefName,
      targetRefName,
      title,
      description,
      isDraft,
    }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const pullRequest = await gitApi.createPullRequest(
        {
          sourceRefName,
          targetRefName,
          title,
          description,
          isDraft,
        },
        repositoryId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }],
      };
    }
  );

  server.tool(
    REPO_TOOLS.update_pull_request_status,
    "Update status of an existing pull request to active or abandoned.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull request exists."),
      pullRequestId: z.number().describe("The ID of the pull request to be published."),
      status: z.enum(["active", "abandoned"]).describe("The new status of the pull request. Can be 'active' or 'abandoned'."),
    },
    async ({ repositoryId, pullRequestId }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const statusValue = status === "active" ? 3 : 2;

      const updatedPullRequest = await gitApi.updatePullRequest(
        { status: statusValue },
        repositoryId,
        pullRequestId
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(updatedPullRequest, null, 2) },
        ],
      };
    }
  ); 
 
  server.tool(
    REPO_TOOLS.list_all_repos_by_project,
    "Retrieve a list of repositories for a given project",
    { 
      project: z.string().describe("The name or ID of the Azure DevOps project."), 
    },
    async ({ project }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const repositories = await gitApi.getRepositories(
        project,
        false,
        false,
        false
      );

      // Filter out the irrelevant properties
      const filteredRepositories = repositories?.map((repo) => ({
        id: repo.id,
        name: repo.name,
        isDisabled: repo.isDisabled,
        isFork: repo.isFork,
        isInMaintenance: repo.isInMaintenance,
        webUrl: repo.webUrl,
        size: repo.size,
      }));

      return {
        content: [
          { type: "text", text: JSON.stringify(filteredRepositories, null, 2) },
        ],
      };
    }
  );
 
  server.tool(
    REPO_TOOLS.list_pull_requests_by_repo,
    "Retrieve a list of pull requests for a given repository.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull requests are located."),
      created_by_me: z.boolean().default(false).describe("Filter pull requests created by the current user."),
      i_am_reviewer: z.boolean().default(false).describe("Filter pull requests where the current user is a reviewer."),
    },
    async ({ repositoryId, created_by_me, i_am_reviewer }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();

      // Build the search criteria
      const searchCriteria: {
        status: number;
        repositoryId: string;
        creatorId?: string;
        reviewerId?: string;
      } = {
        status: 1,
        repositoryId: repositoryId,
      };

      if (created_by_me || i_am_reviewer) {
        const data = await getCurrentUserDetails(
          tokenProvider,
          connectionProvider
        );
        const userId = data.authenticatedUser.id;
        if (created_by_me) {
          searchCriteria.creatorId = userId;
        }
        if (i_am_reviewer) {
          searchCriteria.reviewerId = userId;
        }
      }

      const pullRequests = await gitApi.getPullRequests(
        repositoryId,
        searchCriteria
      );

      // Filter out the irrelevant properties
      const filteredPullRequests = pullRequests?.map((pr) => ({
        pullRequestId: pr.pullRequestId,
        codeReviewId: pr.codeReviewId,
        status: pr.status,
        createdBy: {
          displayName: pr.createdBy?.displayName,
          uniqueName: pr.createdBy?.uniqueName,
        },
        creationDate: pr.creationDate,
        title: pr.title,
        isDraft: pr.isDraft,
      }));

      return {
        content: [
          { type: "text", text: JSON.stringify(filteredPullRequests, null, 2) },
        ],
      };
    }
  );
 
  server.tool(
    REPO_TOOLS.list_pull_requests_by_project,
    "Retrieve a list of pull requests for a given project Id or Name.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      created_by_me: z.boolean().default(false).describe("Filter pull requests created by the current user."),
      i_am_reviewer: z.boolean().default(false).describe("Filter pull requests where the current user is a reviewer."),
    },
    async ({ project, created_by_me, i_am_reviewer }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();

      // Build the search criteria
      const gitPullRequestSearchCriteria: {
        status: number;
        creatorId?: string;
        reviewerId?: string;
      } = {
        status: 1,
      };

      if (created_by_me || i_am_reviewer) {
        const data = await getCurrentUserDetails(
          tokenProvider,
          connectionProvider
        );
        const userId = data.authenticatedUser.id;
        if (created_by_me) {
          gitPullRequestSearchCriteria.creatorId = userId;
        }
        if (i_am_reviewer) {
          gitPullRequestSearchCriteria.reviewerId = userId;
        }
      }

      const pullRequests = await gitApi.getPullRequestsByProject(
        project,
        gitPullRequestSearchCriteria
      );

      // Filter out the irrelevant properties
      const filteredPullRequests = pullRequests?.map((pr) => ({
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
        isDraft: pr.isDraft,
      }));

      return {
        content: [
          { type: "text", text: JSON.stringify(filteredPullRequests, null, 2) },
        ],
      };
    }
  );
  
  server.tool(
    REPO_TOOLS.list_pull_request_threads,
    "Retrieve a list of comment threads for a pull request.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
      pullRequestId: z.number().describe("The ID of the pull request for which to retrieve threads."),
      project: z.string().optional().describe("Project ID or project name (optional)"),
      iteration: z.number().optional().describe("The iteration ID for which to retrieve threads. Optional, defaults to the latest iteration."),
      baseIteration: z.number().optional().describe("The base iteration ID for which to retrieve threads. Optional, defaults to the latest base iteration."),
    },
    async ({
      repositoryId,
      pullRequestId,
      project,
      iteration,
      baseIteration,
    }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();

      const threads = await gitApi.getThreads(
        repositoryId,
        pullRequestId,
        project,
        iteration,
        baseIteration
      );

      return {
        content: [{ type: "text", text: JSON.stringify(threads, null, 2) }],
      };
    }
  );
  
  server.tool(
    REPO_TOOLS.list_pull_request_thread_comments,
    "Retrieve a list of comments in a pull request thread.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
      pullRequestId: z.number().describe("The ID of the pull request for which to retrieve thread comments."),
      threadId: z.number().describe("The ID of the thread for which to retrieve comments."),
      project: z.string().optional().describe("Project ID or project name (optional)"),
    },
    async ({ repositoryId, pullRequestId, threadId, project }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();

      // Get thread comments - GitApi uses getComments for retrieving comments from a specific thread
      const comments = await gitApi.getComments(
        repositoryId,
        pullRequestId,
        threadId,
        project
      );

      return {
        content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
      };
    }
  );
  
  server.tool(
    REPO_TOOLS.list_branches_by_repo,
    "Retrieve a list of branches for a given repository.",
    {
      repositoryId: z.string().describe("The ID of the repository where the branches are located."),
      top: z.number().default(100).describe("The maximum number of branches to return. Defaults to 100."),
    },
    async ({ repositoryId, top }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const branches = await gitApi.getRefs(repositoryId, undefined);

      const filteredBranches = branchesFilterOutIrrelevantProperties(
        branches,
        top
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(filteredBranches, null, 2) },
        ],
      };
    }
  );

  server.tool(
    REPO_TOOLS.list_my_branches_by_repo,
    "Retrieve a list of my branches for a given repository Id.",
    {
      repositoryId: z.string().describe("The ID of the repository where the branches are located."),
    },
    async ({ repositoryId }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const branches = await gitApi.getRefs(
        repositoryId,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      return {
        content: [{ type: "text", text: JSON.stringify(branches, null, 2) }],
      };
    }
  );

  server.tool(
    REPO_TOOLS.get_repo_by_name_or_id,
    "Get the repository by project and repository name or ID.",
    {
      project: z.string().describe("Project name or ID where the repository is located."),
      repositoryNameOrId: z.string().describe("Repository name or ID."),
    },
    async ({ project, repositoryNameOrId }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const repositories = await gitApi.getRepositories(project);

      const repository = repositories?.find((repo) => repo.name === repositoryNameOrId || repo.id === repositoryNameOrId);
      
      if (!repository) {
        throw new Error(
          `Repository ${repositoryNameOrId} not found in project ${project}`
        );
      }

      return {
        content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
      };
    }
  );
 
  server.tool(
    REPO_TOOLS.get_branch_by_name,
    "Get a branch by its name.",
    { 
      repositoryId: z.string().describe("The ID of the repository where the branch is located."), 
      branchName: z.string().describe("The name of the branch to retrieve, e.g., 'main' or 'feature-branch'."), 
    },
    async ({ repositoryId, branchName }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const branches = await gitApi.getRefs(repositoryId);
      const branch = branches?.find(
        (branch) => branch.name === `refs/heads/${branchName}`
      );
      if (!branch) {
        return {
          content: [
            {
              type: "text",
              text: `Branch ${branchName} not found in repository ${repositoryId}`,
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
      };
    }
  );
 
  server.tool(
    REPO_TOOLS.get_pull_request_by_id,
    "Get a pull request by its ID.",
    { 
      repositoryId: z.string().describe("The ID of the repository where the pull request is located."), 
      pullRequestId: z.number().describe("The ID of the pull request to retrieve."), 
    },
    async ({ repositoryId, pullRequestId }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const pullRequest = await gitApi.getPullRequest(
        repositoryId,
        pullRequestId
      );
      return {
        content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }],
      };
    }
  );

  server.tool(
    REPO_TOOLS.reply_to_comment,
    "Replies to a specific comment on a pull request.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
      pullRequestId: z.number().describe("The ID of the pull request where the comment thread exists."),
      threadId: z.number().describe("The ID of the thread to which the comment will be added."),
      content: z.string().describe("The content of the comment to be added."),
      project: z.string().optional().describe("Project ID or project name (optional)"),
    },
    async ({ repositoryId, pullRequestId, threadId, content, project }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const comment = await gitApi.createComment(
        { content },
        repositoryId,
        pullRequestId,
        threadId,
        project
      );

      return {
        content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
      };
    }
  );
  
  server.tool(
    REPO_TOOLS.resolve_comment,
    "Resolves a specific comment thread on a pull request.",
    {
      repositoryId: z.string().describe("The ID of the repository where the pull request is located."),
      pullRequestId: z.number().describe("The ID of the pull request where the comment thread exists."),
      threadId: z.number().describe("The ID of the thread to be resolved."),
    },
    async ({ repositoryId, pullRequestId, threadId }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const thread = await gitApi.updateThread(
        { status: 2 }, // 2 corresponds to "Resolved" status
        repositoryId,
        pullRequestId,
        threadId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(thread, null, 2) }],
      };
    }
  );

  server.tool(
    REPO_TOOLS.search_repos_by_name,
    "Search and retrieve a list of repositories for a given project filtered by repository name",
    { 
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      searchText: z.string().describe("The search text to filter repositories by name. Case-insensitive partial matching."),
    },
    async ({ project, searchText }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const repositories = await gitApi.getRepositories(
        project,
        false,
        false,
        false
      );

      // Filter repositories by name using case-insensitive search
      const filteredByName = repositories?.filter((repo) => 
        repo.name?.toLowerCase().includes(searchText.toLowerCase())
      );

      // Filter out the irrelevant properties
      const filteredRepositories = filteredByName?.map((repo) => ({
        id: repo.id,
        name: repo.name,
        isDisabled: repo.isDisabled,
        isFork: repo.isFork,
        isInMaintenance: repo.isInMaintenance,
        webUrl: repo.webUrl,
        size: repo.size,
      }));

      return {
        content: [
          { type: "text", text: JSON.stringify(filteredRepositories, null, 2) },
        ],
      };
    }
  );
}

export { REPO_TOOLS, configureRepoTools };
