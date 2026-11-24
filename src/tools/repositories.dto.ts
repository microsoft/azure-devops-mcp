// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";
import { getEnumKeys } from "../utils.js";
import { CommentThreadStatus, GitPullRequestMergeStrategy } from "azure-devops-node-api/interfaces/GitInterfaces.js";

export const writeRepositoryFileShape = {
  repositoryId: z.string().describe("The ID or name of the repository."),
  project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name."),
  branchName: z.string().min(1).describe("The name of the existing branch to update, without the 'refs/heads/' prefix."),
  path: z.string().min(1).describe("The absolute repository path of the file, for example '/src/example.ts'."),
  content: z.string().describe("The complete UTF-8 text content to write to the file."),
  commitMessage: z.string().min(1).describe("The commit message for the file change."),
  expectedOldObjectId: z
    .string()
    .optional()
    .describe("The expected current commit ID of the branch. When provided, the push fails if the branch has moved. If omitted, the current branch head is retrieved before pushing."),
};

export const repoFileWriteShape = {
  action: z.enum(["create", "update"]).describe("Whether to create a new file or update an existing file."),
  ...writeRepositoryFileShape,
};

const pullRequestShape = {
  repositoryId: z.string().optional().describe("The ID or name of the repository. Required for all actions. When using a name instead of a GUID, project must also be provided."),
  pullRequestId: z.coerce.number().min(1).optional().describe("The ID of the pull request. Required for update, update_reviewers, and vote."),
  project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
};

export const createPullRequestShape = {
  ...pullRequestShape,
  sourceRefName: z.string().optional().describe("The source branch name (e.g., 'refs/heads/feature-branch'). Required for create."),
  targetRefName: z.string().optional().describe("The target branch name (e.g., 'refs/heads/main'). Required for create. Optional for update."),
  title: z.string().optional().describe("The title of the pull request. Required for create. Optional for update."),
  description: z.string().max(4000).optional().describe("The description of the pull request. Max 4000 characters. Used for create and update."),
  isDraft: z.boolean().optional().describe("Whether the pull request is a draft. Defaults to false for create. When omitted during update, the existing draft state is preserved."),
  workItems: z.string().optional().describe("Work item IDs to associate, space-separated. Used for create."),
  forkSourceRepositoryId: z.string().optional().describe("The ID of the fork repository. Used for create."),
  labels: z.array(z.string()).optional().describe("Array of label names. Used for create and update."),
};

export const updatePullRequestShape = {
  ...pullRequestShape,
  targetRefName: z.string().optional().describe("The target branch name (e.g., 'refs/heads/main'). Required for create. Optional for update."),
  title: z.string().optional().describe("The title of the pull request. Required for create. Optional for update."),
  description: z.string().max(4000).optional().describe("The description of the pull request. Max 4000 characters. Used for create and update."),
  isDraft: z.boolean().optional().describe("Whether the pull request is a draft. Defaults to false for create. When omitted during update, the existing draft state is preserved."),
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
  bypassPolicy: z.boolean().optional().default(false).describe("Explicitly bypass branch policies on autocomplete. Used for update and requires bypassReason when true."),
  bypassReason: z.string().optional().describe("Reason for bypassing branch policies. Used for update only when bypassPolicy is true."),
};

export const updatePullRequestReviewersShape = {
  ...pullRequestShape,
  reviewerIds: z.array(z.string()).optional().describe("List of reviewer IDs. Required for update_reviewers."),
  reviewerAction: z.enum(["add", "remove"]).optional().describe("Whether to add or remove reviewers. Required for update_reviewers."),
};

export const votePullRequestShape = {
  ...pullRequestShape,
  vote: z.enum(["Approved", "ApprovedWithSuggestions", "NoVote", "WaitingForAuthor", "Rejected"]).optional().describe("The vote to cast. Required for vote."),
};

export const repoPullRequestWriteShape = {
  action: z
    .enum(["create", "update", "update_reviewers", "vote"])
    .describe(
      "The action to perform. Options: create (create a pull request), update (update a pull request, including setting autocomplete), update_reviewers (add or remove pull request reviewers), vote (cast a vote on a pull request)."
    ),
  ...createPullRequestShape,
  ...updatePullRequestShape,
  ...updatePullRequestReviewersShape,
  ...votePullRequestShape,
};

const pullRequestThreadShape = {
  repositoryId: z.string().describe("The ID or name of the repository. When using a name instead of a GUID, project must also be provided."),
  pullRequestId: z.coerce.number().min(1).describe("The ID of the pull request."),
  project: z.string().optional().describe("Project ID or project name. Required when repositoryId is a name instead of a GUID."),
};

export const createPullRequestThreadShape = {
  ...pullRequestThreadShape,
  content: z.string().optional().describe("The content of the comment. Required for create, reply, and update."),
  status: z
    .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
    .optional()
    .describe("The thread status. Used for create (defaults to 'Active'), optionally for reply, and required for update_status."),
  filePath: z.string().optional().describe("The file path for the comment thread. Used for create."),
  rightFileStartLine: z.coerce.number().min(1).optional().describe("Start line in the right file. Used for create."),
  rightFileStartOffset: z.number().optional().describe("Start character offset in the right file. Used for create."),
  rightFileEndLine: z.number().optional().describe("End line in the right file. Used for create. Must be supplied together with rightFileEndOffset."),
  rightFileEndOffset: z.number().optional().describe("End character offset in the right file. Used for create. Must be supplied together with rightFileEndLine."),
  changeTrackingId: z.coerce.number().int().min(1).optional().describe("The file change tracking ID from the pull request iteration changes. Used for create."),
  firstComparingIteration: z.coerce.number().int().min(0).optional().describe("The iteration on the left side of the diff. Used for create."),
  secondComparingIteration: z.coerce.number().int().min(1).optional().describe("The iteration on the right side of the diff. Used for create."),
};

export const replyToPullRequestThreadShape = {
  ...pullRequestThreadShape,
  threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for reply, update, and update_status."),
  content: z.string().optional().describe("The content of the comment. Required for create, reply, and update."),
  status: z
    .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
    .optional()
    .describe("The thread status. Used for create (defaults to 'Active'), optionally for reply, and required for update_status."),
  fullResponse: z.boolean().optional().default(false).describe("Return full JSON response. Used for reply and update."),
};

export const updatePullRequestCommentShape = {
  ...pullRequestThreadShape,
  threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for reply, update, and update_status."),
  commentId: z.coerce.number().min(1).optional().describe("The ID of the comment to update. Required for update."),
  content: z.string().optional().describe("The content of the comment. Required for create, reply, and update."),
  fullResponse: z.boolean().optional().default(false).describe("Return full JSON response. Used for reply and update."),
};

export const updatePullRequestThreadStatusShape = {
  ...pullRequestThreadShape,
  threadId: z.coerce.number().min(1).optional().describe("The ID of the thread. Required for reply, update, and update_status."),
  status: z
    .enum(getEnumKeys(CommentThreadStatus) as [string, ...string[]])
    .optional()
    .describe("The thread status. Used for create (defaults to 'Active'), optionally for reply, and required for update_status."),
};

export const repoPullRequestThreadWriteShape = {
  action: z
    .enum(["create", "reply", "update", "update_status"])
    .describe(
      "The action to perform. Options: create (create a new comment thread on a pull request), reply (reply to a comment in a thread), update (update an existing comment), update_status (update the status of a comment thread)."
    ),
  ...updatePullRequestCommentShape,
  ...replyToPullRequestThreadShape,
  ...updatePullRequestThreadStatusShape,
  ...createPullRequestThreadShape,
};

export const writeRepositoryFileSchema = z.object(writeRepositoryFileShape);
export const repoFileWriteSchema = z.object(repoFileWriteShape);
export const createPullRequestSchema = z.object(createPullRequestShape);
export const updatePullRequestSchema = z.object(updatePullRequestShape);
export const updatePullRequestReviewersSchema = z.object(updatePullRequestReviewersShape);
export const votePullRequestSchema = z.object(votePullRequestShape);
export const repoPullRequestWriteSchema = z.object(repoPullRequestWriteShape);
export const createPullRequestThreadSchema = z.object(createPullRequestThreadShape);
export const replyToPullRequestThreadSchema = z.object(replyToPullRequestThreadShape);
export const updatePullRequestCommentSchema = z.object(updatePullRequestCommentShape);
export const updatePullRequestThreadStatusSchema = z.object(updatePullRequestThreadStatusShape);
export const repoPullRequestThreadWriteSchema = z.object(repoPullRequestThreadWriteShape);

export type WriteRepositoryFileArgs = z.infer<typeof writeRepositoryFileSchema>;
export type RepoFileWriteArgs = z.infer<typeof repoFileWriteSchema>;
export type CreatePullRequestArgs = z.infer<typeof createPullRequestSchema>;
export type UpdatePullRequestArgs = z.infer<typeof updatePullRequestSchema>;
export type UpdatePullRequestReviewersArgs = z.infer<typeof updatePullRequestReviewersSchema>;
export type VotePullRequestArgs = z.infer<typeof votePullRequestSchema>;
export type RepoPullRequestWriteArgs = z.infer<typeof repoPullRequestWriteSchema>;
export type CreatePullRequestThreadArgs = z.infer<typeof createPullRequestThreadSchema>;
export type ReplyToPullRequestThreadArgs = z.infer<typeof replyToPullRequestThreadSchema>;
export type UpdatePullRequestCommentArgs = z.infer<typeof updatePullRequestCommentSchema>;
export type UpdatePullRequestThreadStatusArgs = z.infer<typeof updatePullRequestThreadStatusSchema>;
export type RepoPullRequestThreadWriteArgs = z.infer<typeof repoPullRequestThreadWriteSchema>;
