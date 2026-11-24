// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

type JsonPatchValue = string | number | boolean | null | JsonPatchValue[] | { [key: string]: JsonPatchValue };

export const jsonPatchValueSchema: z.ZodType<JsonPatchValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonPatchValueSchema), z.record(z.string(), jsonPatchValueSchema)])
);

const projectShape = {
  project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
};

export const createWorkItemShape = {
  ...projectShape,
  workItemType: z.string().optional().describe("The type of work item. Required for: create, add_child."),
  fields: z
    .array(
      z.object({
        name: z.string().describe("The field name, e.g. 'System.Title'."),
        value: z.string().describe("The field value."),
        format: z.enum(["Html", "Markdown"]).optional().describe("Format for large text fields. Optional."),
      })
    )
    .optional()
    .describe("Field values to set on the work item. Required for: create."),
};

const updateWorkItemIdShape = {
  id: z.coerce.number().min(1).optional().describe("Work item ID to update. Required for: update."),
};

export const updateWorkItemShape = {
  ...updateWorkItemIdShape,
  updates: z
    .array(
      z.object({
        op: z
          .string()
          .transform((val) => val.toLowerCase())
          .pipe(z.enum(["add", "replace", "remove", "test"]))
          .prefault("add")
          .describe("The operation to perform. Use 'test' with path '/rev' to enforce optimistic concurrency."),
        path: z.string().describe("The path to operate on, e.g. '/fields/System.Title' or '/rev' for a revision test."),
        value: jsonPatchValueSchema
          .optional()
          .describe(
            "The JSON operation value, including objects and arrays. Required for add, replace, and test; omit for remove. Pass relation objects directly, not as JSON strings. For a test on '/rev', pass the numeric revision previously read."
          ),
      })
    )
    .optional()
    .describe(
      'JSON Patch operations for fields and relations on a single work item. Required for: update. For a safe read-modify-write, prepend a test operation on "/rev" with value set to the numeric revision returned by the preceding read; Azure DevOps rejects the entire update if the current revision differs.'
    ),
};

export const updateWorkItemsBatchShape = {
  batchUpdates: z
    .array(
      z.object({
        op: z.enum(["Add", "Replace", "Remove"]).default("Add").describe("The operation to perform."),
        id: z.coerce.number().min(1).describe("The work item ID to update."),
        path: z.string().describe("The field path, e.g. '/fields/System.Title'."),
        value: z.string().describe("The new value for the field."),
        format: z.enum(["Html", "Markdown"]).optional().describe("Format for large text fields. Optional."),
      })
    )
    .optional()
    .describe("Updates for multiple work items. Required for: update_batch."),
};

export const addChildWorkItemsShape = {
  ...projectShape,
  workItemType: z.string().optional().describe("The type of work item. Required for: create, add_child."),
  parentId: z.coerce.number().min(1).optional().describe("The ID of the parent work item. Required for: add_child."),
  items: z
    .array(
      z.object({
        title: z.string().describe("The title of the child work item."),
        description: z.string().describe("The description of the child work item."),
        format: z.enum(["Markdown", "Html"]).default("Markdown").describe("Format for the description. Defaults to 'Markdown'."),
        areaPath: z.string().optional().describe("Optional area path for the child work item."),
        iterationPath: z.string().optional().describe("Optional iteration path for the child work item."),
      })
    )
    .optional()
    .describe("Child work items to create. Required for: add_child."),
};

export const witWorkItemWriteShape = {
  action: z
    .enum(["create", "update", "update_batch", "add_child"])
    .describe(
      "The action to perform. Options: create (create a new work item), update (update fields on a single work item), update_batch (update multiple work items in one call), add_child (create child work items under a parent)."
    ),
  ...projectShape,
  ...updateWorkItemIdShape,
  ...createWorkItemShape,
  ...updateWorkItemShape,
  ...updateWorkItemsBatchShape,
  ...addChildWorkItemsShape,
};

export const addWorkItemCommentShape = {
  ...projectShape,
  workItemId: z.coerce.number().min(1).optional().describe("The ID of the work item. Required for: add, update."),
  text: z.string().optional().describe("The comment text. Required for: add, update."),
  format: z.enum(["Markdown", "Html"]).optional().default("Markdown").describe("Format of the comment text. Optional, defaults to 'Markdown'."),
};

export const updateWorkItemCommentShape = {
  ...projectShape,
  workItemId: z.coerce.number().min(1).optional().describe("The ID of the work item. Required for: add, update."),
  text: z.string().optional().describe("The comment text. Required for: add, update."),
  commentId: z.coerce.number().min(1).optional().describe("The ID of the comment to update. Required for: update."),
  format: z.enum(["Markdown", "Html"]).optional().default("Markdown").describe("Format of the comment text. Optional, defaults to 'Markdown'."),
};

export const witWorkItemCommentWriteShape = {
  action: z.enum(["add", "update"]).describe("The action to perform. Options: add (add a comment to a work item), update (update an existing comment on a work item)."),
  ...updateWorkItemCommentShape,
  ...addWorkItemCommentShape,
};

export const linkWorkItemsShape = {
  ...projectShape,
  updates: z
    .array(
      z.object({
        id: z.coerce.number().min(1).describe("The ID of the work item to update."),
        linkToId: z.coerce.number().min(1).optional().describe("The ID of the work item to link to. Required unless type is 'hyperlink'."),
        url: z.string().optional().describe("The URL for a hyperlink. Required when type is 'hyperlink'."),
        type: z
          .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by", "hyperlink"])
          .default("related")
          .describe("Type of link. Defaults to 'related'."),
        comment: z.string().optional().describe("Optional comment for the link."),
      })
    )
    .optional()
    .describe("Link operations to apply. Required for: link."),
};

export const unlinkWorkItemShape = {
  ...projectShape,
  id: z.coerce.number().min(1).optional().describe("Work item ID to remove links from. Required for: unlink."),
  type: z
    .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by", "artifact", "hyperlink"])
    .optional()
    .describe("Link type to remove. Required for: unlink."),
  url: z.string().optional().describe("URL to match when removing a link. Used for: unlink. If not provided, all links of the specified type are removed."),
};

export const linkWorkItemToPullRequestShape = {
  projectId: z.string().optional().describe("The project ID (GUID). Required for: link_to_pull_request, and add_artifact_link (Git/Wiki types)."),
  repositoryId: z.string().optional().describe("The repository ID. Required for: link_to_pull_request and add_artifact_link (Git types)."),
  pullRequestId: z.coerce.number().min(1).optional().describe("The pull request ID. Required for: link_to_pull_request; used for: add_artifact_link (Pull Request type)."),
  workItemId: z.coerce.number().min(1).optional().describe("The work item ID. Required for: link_to_pull_request, add_artifact_link."),
  pullRequestProjectId: z.string().optional().describe("Project ID containing the pull request. Used for: link_to_pull_request. Defaults to projectId."),
};

export const addArtifactLinkShape = {
  ...projectShape,
  projectId: z.string().optional().describe("The project ID (GUID). Required for: link_to_pull_request, and add_artifact_link (Git/Wiki types)."),
  repositoryId: z.string().optional().describe("The repository ID. Required for: link_to_pull_request and add_artifact_link (Git types)."),
  pullRequestId: z.coerce.number().min(1).optional().describe("The pull request ID. Required for: link_to_pull_request; used for: add_artifact_link (Pull Request type)."),
  workItemId: z.coerce.number().min(1).optional().describe("The work item ID. Required for: link_to_pull_request, add_artifact_link."),
  artifactUri: z.string().optional().describe("The complete VSTFS URI of the artifact. Used for: add_artifact_link. If provided, individual component parameters are ignored."),
  branchName: z.string().optional().describe("The branch name. Used for: add_artifact_link (Branch type)."),
  commitId: z.string().optional().describe("The commit SHA hash. Used for: add_artifact_link (Fixed in Commit type)."),
  buildId: z.coerce.number().min(1).optional().describe("The build ID. Used for: add_artifact_link (Build, Found in build, Integrated in build types)."),
  wikiId: z.string().optional().describe("The wiki ID (GUID). Used for: add_artifact_link (Wiki type)."),
  pageId: z.coerce.number().min(1).optional().describe("The numeric wiki page ID. Used for: add_artifact_link (Wiki type). Takes precedence over pagePath."),
  pagePath: z.string().optional().describe("The full wiki page path. Used for: add_artifact_link (Wiki type) when pageId is not provided."),
  linkType: z
    .enum([
      "Branch",
      "Build",
      "Fixed in Changeset",
      "Fixed in Commit",
      "Found in build",
      "Integrated in build",
      "Model Link",
      "Pull Request",
      "Related Workitem",
      "Result Attachment",
      "Source Code File",
      "Tag",
      "Test Result",
      "Wiki",
    ])
    .optional()
    .describe("Type of artifact link. Used for: add_artifact_link. Defaults to 'Branch'."),
  comment: z.string().optional().describe("Comment to include with the artifact link. Used for: add_artifact_link."),
};

export const witWorkItemLinkWriteShape = {
  action: z
    .enum(["link", "unlink", "link_to_pull_request", "add_artifact_link"])
    .describe(
      "The action to perform. Options: link (link two work items together), unlink (remove links from a work item), link_to_pull_request (link a work item to a pull request), add_artifact_link (add a repository, branch, commit, or build artifact link to a work item)."
    ),
  ...linkWorkItemsShape,
  ...unlinkWorkItemShape,
  ...linkWorkItemToPullRequestShape,
  ...addArtifactLinkShape,
};

export const createWorkItemSchema = z.object(createWorkItemShape);
export const updateWorkItemSchema = z.object(updateWorkItemShape);
export const updateWorkItemsBatchSchema = z.object(updateWorkItemsBatchShape);
export const addChildWorkItemsSchema = z.object(addChildWorkItemsShape);
export const witWorkItemWriteSchema = z.object(witWorkItemWriteShape);
export const addWorkItemCommentSchema = z.object(addWorkItemCommentShape);
export const updateWorkItemCommentSchema = z.object(updateWorkItemCommentShape);
export const witWorkItemCommentWriteSchema = z.object(witWorkItemCommentWriteShape);
export const linkWorkItemsSchema = z.object(linkWorkItemsShape);
export const unlinkWorkItemSchema = z.object(unlinkWorkItemShape);
export const linkWorkItemToPullRequestSchema = z.object(linkWorkItemToPullRequestShape);
export const addArtifactLinkSchema = z.object(addArtifactLinkShape);
export const witWorkItemLinkWriteSchema = z.object(witWorkItemLinkWriteShape);

export type CreateWorkItemArgs = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemArgs = z.infer<typeof updateWorkItemSchema>;
export type UpdateWorkItemsBatchArgs = z.infer<typeof updateWorkItemsBatchSchema>;
export type AddChildWorkItemsArgs = z.infer<typeof addChildWorkItemsSchema>;
export type WitWorkItemWriteArgs = z.infer<typeof witWorkItemWriteSchema>;
export type AddWorkItemCommentArgs = z.infer<typeof addWorkItemCommentSchema>;
export type UpdateWorkItemCommentArgs = z.infer<typeof updateWorkItemCommentSchema>;
export type WitWorkItemCommentWriteArgs = z.infer<typeof witWorkItemCommentWriteSchema>;
export type LinkWorkItemsArgs = z.infer<typeof linkWorkItemsSchema>;
export type UnlinkWorkItemArgs = z.infer<typeof unlinkWorkItemSchema>;
export type LinkWorkItemToPullRequestArgs = z.infer<typeof linkWorkItemToPullRequestSchema>;
export type AddArtifactLinkArgs = z.infer<typeof addArtifactLinkSchema>;
export type WitWorkItemLinkWriteArgs = z.infer<typeof witWorkItemLinkWriteSchema>;
