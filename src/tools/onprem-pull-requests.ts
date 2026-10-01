// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { AzureDevOpsServerClient, AzureDevOpsServerError, seg } from "../onprem/client.js";
import { createUnifiedDiff } from "../onprem/diff.js";

/**
 * Read-only pull request review tools for Azure DevOps Server (on-premises).
 * These tools are registered only when the server is started with --server-url and
 * use REST routes and api-versions available in Azure DevOps Server 2019 (5.0).
 */
const ONPREM_TOOLS = {
  onprem_project_list: "onprem_project_list",
  onprem_repository: "onprem_repository",
  onprem_pull_request: "onprem_pull_request",
  onprem_pull_request_change: "onprem_pull_request_change",
  onprem_pull_request_thread: "onprem_pull_request_thread",
};

type Json = any;

interface ResolvedPullRequest {
  pr: Json;
  project: string;
  repositoryId: string;
  repoPath: string;
}

interface IterationCommits {
  iterationId: number;
  compareTo: number;
  sourceCommit: string;
  baseCommit: string;
  targetCommit?: string;
}

const VOTE_LABELS: Record<string, string> = {
  "10": "Approved",
  "5": "Approved with suggestions",
  "0": "No vote",
  "-5": "Waiting for author",
  "-10": "Rejected",
};

const prLocator = {
  pullRequestId: z.coerce.number().int().positive().describe("The pull request ID."),
  project: z.string().optional().describe("Project name or ID. Optional: resolved from the pull request when omitted."),
  repository: z.string().optional().describe("Repository name or ID. Optional: resolved from the pull request when omitted. A repository name requires project."),
};

function textResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(operation: string, error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown error occurred";
  return { content: [{ type: "text", text: `Error ${operation}: ${message}` }], isError: true };
}

function identity(identityRef: Json) {
  return identityRef ? { displayName: identityRef.displayName, uniqueName: identityRef.uniqueName, id: identityRef.id } : undefined;
}

function trimPullRequest(pr: Json, collectionUrl: string, includeDetails: boolean) {
  const project = pr.repository?.project?.name;
  const repositoryName = pr.repository?.name;
  return {
    pullRequestId: pr.pullRequestId,
    title: pr.title,
    ...(includeDetails ? { description: pr.description ?? "" } : {}),
    status: pr.status,
    isDraft: pr.isDraft,
    createdBy: identity(pr.createdBy),
    creationDate: pr.creationDate,
    closedDate: pr.closedDate,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    mergeStatus: pr.mergeStatus,
    project,
    repository: { id: pr.repository?.id, name: repositoryName },
    reviewers: pr.reviewers?.map((reviewer: Json) => ({
      displayName: reviewer.displayName,
      uniqueName: reviewer.uniqueName,
      vote: reviewer.vote,
      voteLabel: VOTE_LABELS[String(reviewer.vote)] ?? String(reviewer.vote),
      isRequired: reviewer.isRequired,
      isContainer: reviewer.isContainer,
    })),
    ...(includeDetails
      ? {
          lastMergeSourceCommit: pr.lastMergeSourceCommit?.commitId,
          lastMergeTargetCommit: pr.lastMergeTargetCommit?.commitId,
          lastMergeCommit: pr.lastMergeCommit?.commitId,
          labels: pr.labels?.map((label: Json) => label.name),
          autoCompleteSetBy: identity(pr.autoCompleteSetBy),
          completionOptions: pr.completionOptions,
        }
      : {}),
    webUrl: project && repositoryName ? `${collectionUrl}/${seg(project)}/_git/${seg(repositoryName)}/pullrequest/${pr.pullRequestId}` : undefined,
  };
}

async function resolvePullRequest(client: AzureDevOpsServerClient, pullRequestId: number, project?: string, repository?: string): Promise<ResolvedPullRequest> {
  let pr: Json;
  if (repository) {
    const prefix = project ? `${seg(project)}/` : "";
    pr = await client.getJson(`${prefix}_apis/git/repositories/${seg(repository)}/pullRequests/${pullRequestId}`);
  } else {
    const prefix = project ? `${seg(project)}/` : "";
    pr = await client.getJson(`${prefix}_apis/git/pullRequests/${pullRequestId}`);
  }
  const repositoryId: string | undefined = pr?.repository?.id;
  const projectName: string | undefined = pr?.repository?.project?.name ?? pr?.repository?.project?.id ?? project;
  if (!repositoryId || !projectName) {
    throw new Error(`Unable to resolve the repository for pull request ${pullRequestId}.`);
  }
  return { pr, project: projectName, repositoryId, repoPath: `${seg(projectName)}/_apis/git/repositories/${seg(repositoryId)}` };
}

async function resolveIterationCommits(client: AzureDevOpsServerClient, resolved: ResolvedPullRequest, iterationId?: number, compareTo?: number): Promise<IterationCommits> {
  const response: Json = await client.getJson(`${resolved.repoPath}/pullRequests/${resolved.pr.pullRequestId}/iterations`);
  const iterations: Json[] = response?.value ?? [];
  if (iterations.length === 0) {
    throw new Error(`Pull request ${resolved.pr.pullRequestId} has no iterations.`);
  }
  const selected = iterationId ? iterations.find((iteration) => iteration.id === iterationId) : iterations.reduce((latest, iteration) => (iteration.id > latest.id ? iteration : latest));
  if (!selected) {
    throw new Error(`Iteration ${iterationId} was not found. Available iterations: ${iterations.map((iteration) => iteration.id).join(", ")}.`);
  }
  const sourceCommit: string | undefined = selected.sourceRefCommit?.commitId;
  let baseCommit: string | undefined;
  if (compareTo) {
    const previous = iterations.find((iteration) => iteration.id === compareTo);
    if (!previous) {
      throw new Error(`compareTo iteration ${compareTo} was not found.`);
    }
    baseCommit = previous.sourceRefCommit?.commitId;
  } else {
    baseCommit = selected.commonRefCommit?.commitId ?? selected.targetRefCommit?.commitId;
  }
  if (!sourceCommit || !baseCommit) {
    throw new Error(`Iteration ${selected.id} does not expose source/base commits.`);
  }
  return { iterationId: selected.id, compareTo: compareTo ?? 0, sourceCommit, baseCommit, targetCommit: selected.targetRefCommit?.commitId };
}

interface FileVersion {
  exists: boolean;
  isBinary: boolean;
  content: string;
}

async function getFileAtCommit(client: AzureDevOpsServerClient, repoPath: string, path: string, commitId: string): Promise<FileVersion> {
  try {
    const item: Json = await client.getJson(`${repoPath}/items`, {
      "path": path,
      "versionDescriptor.version": commitId,
      "versionDescriptor.versionType": "commit",
      "includeContent": true,
      "includeContentMetadata": true,
      "$format": "json",
    });
    if (item?.isFolder || item?.gitObjectType === "tree") {
      throw new Error(`'${path}' is a folder.`);
    }
    const content: string = typeof item?.content === "string" ? item.content : "";
    const isBinary = item?.contentMetadata?.isBinary === true || content.includes("\u0000");
    return { exists: true, isBinary, content: isBinary ? "" : content };
  } catch (error) {
    if (error instanceof AzureDevOpsServerError && error.status === 404) {
      return { exists: false, isBinary: false, content: "" };
    }
    throw error;
  }
}

function truncateLines(text: string, maxLines: number): { text: string; truncated: boolean; totalLines: number } {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return { text, truncated: false, totalLines: lines.length };
  return { text: lines.slice(0, maxLines).join("\n"), truncated: true, totalLines: lines.length };
}

function configureOnPremPullRequestTools(server: McpServer, client: AzureDevOpsServerClient, collectionUrl: string) {
  // --- onprem_project_list ---------------------------------------------------
  server.tool(
    ONPREM_TOOLS.onprem_project_list,
    "List projects in the Azure DevOps Server (on-premises) project collection.",
    {
      top: z.coerce.number().int().positive().default(100).describe("Maximum number of projects to return. Defaults to 100."),
      skip: z.coerce.number().int().min(0).default(0).describe("Number of projects to skip. Defaults to 0."),
      projectNameFilter: z.string().optional().describe("Optional case-insensitive filter on the project name."),
    },
    async ({ top, skip, projectNameFilter }) => {
      try {
        const response: Json = await client.getJson("_apis/projects", { $top: top, $skip: skip, stateFilter: "wellFormed" });
        const filter = projectNameFilter?.toLowerCase();
        const projects = (response?.value ?? [])
          .filter((project: Json) => !filter || String(project.name).toLowerCase().includes(filter))
          .map((project: Json) => ({ id: project.id, name: project.name, description: project.description, state: project.state, lastUpdateTime: project.lastUpdateTime }));
        return textResult(projects);
      } catch (error) {
        return errorResult("listing projects", error);
      }
    }
  );

  // --- onprem_repository -----------------------------------------------------
  server.tool(
    ONPREM_TOOLS.onprem_repository,
    "Read Git repositories in an Azure DevOps Server (on-premises) project. Actions: list (repositories in a project), get (one repository by name or ID).",
    {
      action: z.enum(["list", "get"]).describe("list: list repositories in the project. get: get a repository by name or ID."),
      project: z.string().describe("Project name or ID."),
      repository: z.string().optional().describe("Repository name or ID. Required for get."),
      repoNameFilter: z.string().optional().describe("Optional case-insensitive repository name filter. Used for list."),
    },
    async ({ action, project, repository, repoNameFilter }) => {
      try {
        const trim = (repo: Json) => ({
          id: repo.id,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          size: repo.size,
          isDisabled: repo.isDisabled,
          webUrl: repo.webUrl,
          project: repo.project?.name,
        });
        if (action === "get") {
          if (!repository) return { content: [{ type: "text", text: "repository is required for get" }], isError: true };
          const repo: Json = await client.getJson(`${seg(project)}/_apis/git/repositories/${seg(repository)}`);
          return textResult(trim(repo));
        }
        const response: Json = await client.getJson(`${seg(project)}/_apis/git/repositories`);
        const filter = repoNameFilter?.toLowerCase();
        const repos = (response?.value ?? [])
          .filter((repo: Json) => !filter || String(repo.name).toLowerCase().includes(filter))
          .sort((a: Json, b: Json) => String(a.name).localeCompare(String(b.name)))
          .map(trim);
        return textResult(repos);
      } catch (error) {
        return errorResult("reading repositories", error);
      }
    }
  );

  // --- onprem_pull_request ---------------------------------------------------
  server.tool(
    ONPREM_TOOLS.onprem_pull_request,
    "Read pull request data from Azure DevOps Server (on-premises) for code review. Actions: list (pull requests in a repository), get (metadata, description, reviewers and votes, merge status), commits (commits in the pull request), iterations (pushes/updates with source, target and merge-base commits), work_items (linked work items with title, state, description and acceptance criteria).",
    {
      action: z.enum(["list", "get", "commits", "iterations", "work_items"]).describe("The read operation to perform."),
      pullRequestId: z.coerce.number().int().positive().optional().describe("The pull request ID. Required for every action except list."),
      project: z.string().optional().describe("Project name or ID. Required for list; optional otherwise."),
      repository: z.string().optional().describe("Repository name or ID. Required for list; optional otherwise (resolved from the pull request)."),
      status: z.enum(["active", "completed", "abandoned", "all"]).default("active").describe("Status filter for list. Defaults to active."),
      sourceRefName: z.string().optional().describe("Source branch filter for list, e.g. refs/heads/feature/x."),
      targetRefName: z.string().optional().describe("Target branch filter for list, e.g. refs/heads/main."),
      creatorId: z.string().optional().describe("Creator identity ID filter for list."),
      reviewerId: z.string().optional().describe("Reviewer identity ID filter for list."),
      top: z.coerce.number().int().positive().default(50).describe("Maximum results for list and commits. Defaults to 50."),
      skip: z.coerce.number().int().min(0).default(0).describe("Results to skip for list. Defaults to 0."),
    },
    async ({ action, pullRequestId, project, repository, status, sourceRefName, targetRefName, creatorId, reviewerId, top, skip }) => {
      try {
        if (action === "list") {
          if (!project || !repository) return { content: [{ type: "text", text: "project and repository are required for list" }], isError: true };
          const response: Json = await client.getJson(`${seg(project)}/_apis/git/repositories/${seg(repository)}/pullRequests`, {
            "searchCriteria.status": status,
            "searchCriteria.sourceRefName": sourceRefName,
            "searchCriteria.targetRefName": targetRefName,
            "searchCriteria.creatorId": creatorId,
            "searchCriteria.reviewerId": reviewerId,
            "$top": top,
            "$skip": skip,
          });
          return textResult((response?.value ?? []).map((pr: Json) => trimPullRequest(pr, collectionUrl, false)));
        }

        if (!pullRequestId) return { content: [{ type: "text", text: `pullRequestId is required for ${action}` }], isError: true };
        const resolved = await resolvePullRequest(client, pullRequestId, project, repository);
        const prPath = `${resolved.repoPath}/pullRequests/${pullRequestId}`;

        switch (action) {
          case "get":
            return textResult(trimPullRequest(resolved.pr, collectionUrl, true));
          case "commits": {
            const response: Json = await client.getJson(`${prPath}/commits`, { $top: top });
            return textResult(
              (response?.value ?? []).map((commit: Json) => ({
                commitId: commit.commitId,
                author: commit.author?.name,
                authorDate: commit.author?.date,
                comment: commit.comment,
              }))
            );
          }
          case "iterations": {
            const response: Json = await client.getJson(`${prPath}/iterations`);
            return textResult(
              (response?.value ?? []).map((iteration: Json) => ({
                id: iteration.id,
                description: iteration.description,
                author: identity(iteration.author),
                createdDate: iteration.createdDate,
                updatedDate: iteration.updatedDate,
                reason: iteration.reason,
                sourceRefCommit: iteration.sourceRefCommit?.commitId,
                targetRefCommit: iteration.targetRefCommit?.commitId,
                commonRefCommit: iteration.commonRefCommit?.commitId,
              }))
            );
          }
          case "work_items": {
            const refs: Json = await client.getJson(`${prPath}/workitems`);
            const ids: string[] = (refs?.value ?? []).map((ref: Json) => String(ref.id)).filter(Boolean);
            if (ids.length === 0) return textResult([]);
            const response: Json = await client.getJson("_apis/wit/workitems", { ids: ids.slice(0, 200).join(","), errorPolicy: "omit" });
            return textResult(
              (response?.value ?? [])
                .filter((workItem: Json) => workItem)
                .map((workItem: Json) => {
                  const fields = workItem.fields ?? {};
                  return {
                    id: workItem.id,
                    type: fields["System.WorkItemType"],
                    title: fields["System.Title"],
                    state: fields["System.State"],
                    assignedTo: fields["System.AssignedTo"]?.displayName ?? fields["System.AssignedTo"],
                    areaPath: fields["System.AreaPath"],
                    iterationPath: fields["System.IterationPath"],
                    tags: fields["System.Tags"],
                    description: fields["System.Description"],
                    acceptanceCriteria: fields["Microsoft.VSTS.Common.AcceptanceCriteria"],
                    reproSteps: fields["Microsoft.VSTS.TCM.ReproSteps"],
                  };
                })
            );
          }
        }
        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        return errorResult("reading pull request", error);
      }
    }
  );

  // --- onprem_pull_request_change --------------------------------------------
  server.tool(
    ONPREM_TOOLS.onprem_pull_request_change,
    "Read the code changes of an Azure DevOps Server (on-premises) pull request. Actions: list (changed files in an iteration), diff (unified diff of one file between the merge base, or an earlier iteration, and the iteration's source commit), content (file content at the pull request source, merge base, target, or a specific commit).",
    {
      action: z.enum(["list", "diff", "content"]).describe("The read operation to perform."),
      ...prLocator,
      iterationId: z.coerce.number().int().positive().optional().describe("Pull request iteration ID. Defaults to the latest iteration."),
      compareTo: z.coerce.number().int().positive().optional().describe("Earlier iteration ID to compare against (incremental review). Defaults to the merge base with the target branch."),
      path: z.string().optional().describe("Repository file path, e.g. /src/app.ts. Required for diff and content."),
      originalPath: z.string().optional().describe("Original path of a renamed file, for diff. Use the originalPath returned by list."),
      side: z.enum(["source", "base", "target"]).default("source").describe("For content: source (PR head), base (merge base), or target (target branch at the iteration). Defaults to source."),
      commitId: z.string().optional().describe("For content: explicit commit SHA, overrides side."),
      contextLines: z.coerce.number().int().min(0).max(50).default(3).describe("Context lines around diff hunks. Defaults to 3."),
      maxLines: z.coerce.number().int().positive().default(2000).describe("Maximum output lines for diff and content. Defaults to 2000."),
      top: z.coerce.number().int().positive().default(200).describe("Maximum changed files for list. Defaults to 200."),
      skip: z.coerce.number().int().min(0).default(0).describe("Changed files to skip for list. Defaults to 0."),
    },
    async ({ action, pullRequestId, project, repository, iterationId, compareTo, path, originalPath, side, commitId, contextLines, maxLines, top, skip }) => {
      try {
        const filePath = path ?? "";
        if (action !== "list" && !filePath) return { content: [{ type: "text", text: `path is required for ${action}` }], isError: true };
        const resolved = await resolvePullRequest(client, pullRequestId, project, repository);

        if (action === "content" && commitId) {
          const file = await getFileAtCommit(client, resolved.repoPath, filePath, commitId);
          return textResult(formatContent(filePath, commitId, file, maxLines));
        }

        const commits = await resolveIterationCommits(client, resolved, iterationId, compareTo);

        if (action === "list") {
          const response: Json = await client.getJson(`${resolved.repoPath}/pullRequests/${pullRequestId}/iterations/${commits.iterationId}/changes`, {
            $top: top,
            $skip: skip,
            $compareTo: commits.compareTo,
          });
          const changes = (response?.changeEntries ?? [])
            .filter((entry: Json) => !entry.item?.isFolder && entry.item?.gitObjectType !== "tree")
            .map((entry: Json) => ({
              path: entry.item?.path,
              originalPath: entry.originalPath ?? entry.sourceServerItem,
              changeType: entry.changeType,
              objectId: entry.item?.objectId,
              originalObjectId: entry.item?.originalObjectId,
            }));
          return textResult({
            iterationId: commits.iterationId,
            compareTo: commits.compareTo,
            baseCommit: commits.baseCommit,
            sourceCommit: commits.sourceCommit,
            changes,
            nextSkip: response?.nextSkip || undefined,
          });
        }

        if (action === "content") {
          const commit = side === "base" ? commits.baseCommit : side === "target" ? (commits.targetCommit ?? commits.baseCommit) : commits.sourceCommit;
          const file = await getFileAtCommit(client, resolved.repoPath, filePath, commit);
          return textResult(formatContent(filePath, commit, file, maxLines));
        }

        const [before, after] = await Promise.all([
          getFileAtCommit(client, resolved.repoPath, originalPath ?? filePath, commits.baseCommit),
          getFileAtCommit(client, resolved.repoPath, filePath, commits.sourceCommit),
        ]);
        const header = {
          path,
          originalPath: originalPath ?? undefined,
          iterationId: commits.iterationId,
          compareTo: commits.compareTo,
          baseCommit: commits.baseCommit,
          sourceCommit: commits.sourceCommit,
          changeType: !before.exists && after.exists ? "add" : before.exists && !after.exists ? "delete" : originalPath && originalPath !== path ? "rename" : "edit",
        };
        if (!before.exists && !after.exists) {
          return { content: [{ type: "text", text: `File '${path}' was not found at the base (${commits.baseCommit}) or source (${commits.sourceCommit}) commit.` }], isError: true };
        }
        if (before.isBinary || after.isBinary) {
          return textResult({ ...header, binary: true, diff: "Binary file; textual diff not available." });
        }
        const result = createUnifiedDiff(before.content, after.content, before.exists ? `a${originalPath ?? path}` : "/dev/null", after.exists ? `b${path}` : "/dev/null", contextLines);
        const truncated = truncateLines(result.diff, maxLines);
        return textResult({
          ...header,
          addedLines: result.addedLines,
          removedLines: result.removedLines,
          ...(result.minimal ? {} : { note: "File too large for a minimal diff; changed region shown as a single replacement." }),
          ...(truncated.truncated ? { truncated: true, totalDiffLines: truncated.totalLines } : {}),
          diff: truncated.text || "(no textual changes)",
        });
      } catch (error) {
        return errorResult("reading pull request changes", error);
      }
    }
  );

  // --- onprem_pull_request_thread --------------------------------------------
  server.tool(
    ONPREM_TOOLS.onprem_pull_request_thread,
    "List discussion threads and comments on an Azure DevOps Server (on-premises) pull request, including file path and line positions for inline comments.",
    {
      ...prLocator,
      status: z.enum(["active", "fixed", "wontFix", "closed", "byDesign", "pending", "unknown"]).optional().describe("Optional thread status filter."),
      includeSystem: z.boolean().default(false).describe("Include system-generated threads (votes, pushes, policy updates). Defaults to false."),
      top: z.coerce.number().int().positive().default(100).describe("Maximum threads to return. Defaults to 100."),
      skip: z.coerce.number().int().min(0).default(0).describe("Threads to skip. Defaults to 0."),
    },
    async ({ pullRequestId, project, repository, status, includeSystem, top, skip }) => {
      try {
        const resolved = await resolvePullRequest(client, pullRequestId, project, repository);
        const response: Json = await client.getJson(`${resolved.repoPath}/pullRequests/${pullRequestId}/threads`);
        const threads = (response?.value ?? [])
          .filter((thread: Json) => !thread.isDeleted)
          .map((thread: Json) => ({ ...thread, comments: (thread.comments ?? []).filter((comment: Json) => !comment.isDeleted) }))
          .filter((thread: Json) => thread.comments.length > 0)
          .filter((thread: Json) => includeSystem || thread.comments.some((comment: Json) => comment.commentType !== "system"))
          .filter((thread: Json) => !status || String(thread.status).toLowerCase() === status.toLowerCase())
          .slice(skip, skip + top)
          .map((thread: Json) => ({
            id: thread.id,
            status: thread.status,
            publishedDate: thread.publishedDate,
            lastUpdatedDate: thread.lastUpdatedDate,
            filePath: thread.threadContext?.filePath,
            rightFileStart: thread.threadContext?.rightFileStart,
            rightFileEnd: thread.threadContext?.rightFileEnd,
            leftFileStart: thread.threadContext?.leftFileStart,
            leftFileEnd: thread.threadContext?.leftFileEnd,
            iterationContext: thread.pullRequestThreadContext?.iterationContext,
            comments: thread.comments.map((comment: Json) => ({
              id: comment.id,
              parentCommentId: comment.parentCommentId,
              author: comment.author?.displayName,
              content: comment.content,
              commentType: comment.commentType,
              publishedDate: comment.publishedDate,
              lastUpdatedDate: comment.lastUpdatedDate,
            })),
          }));
        return textResult(threads);
      } catch (error) {
        return errorResult("reading pull request threads", error);
      }
    }
  );
}

function formatContent(path: string, commitId: string, file: FileVersion, maxLines: number) {
  if (!file.exists) {
    return { path, commitId, exists: false };
  }
  if (file.isBinary) {
    return { path, commitId, exists: true, binary: true };
  }
  const truncated = truncateLines(file.content, maxLines);
  return { path, commitId, exists: true, ...(truncated.truncated ? { truncated: true, totalLines: truncated.totalLines } : {}), content: truncated.text };
}

export { configureOnPremPullRequestTools, ONPREM_TOOLS };
