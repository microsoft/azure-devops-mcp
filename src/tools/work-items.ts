// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { WorkItemExpand, WorkItemRelation } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { batchApiVersion, markdownCommentsApiVersion, getEnumKeys, safeEnumConvert, encodeFormattedValue } from "../utils.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";
import { createExternalContentResponse } from "../shared/content-safety.js";

const WORKITEM_TOOLS = {
  wit_work_item: "wit_work_item",
  wit_query: "wit_query",
  wit_backlog: "wit_backlog",
  wit_work_item_attachment: "wit_work_item_attachment",
  wit_work_item_write: "wit_work_item_write",
  wit_work_item_comment_write: "wit_work_item_comment_write",
  wit_work_item_link_write: "wit_work_item_link_write",
};

function getLinkTypeFromName(name: string) {
  switch (name.toLowerCase()) {
    case "parent":
      return "System.LinkTypes.Hierarchy-Reverse";
    case "child":
      return "System.LinkTypes.Hierarchy-Forward";
    case "duplicate":
      return "System.LinkTypes.Duplicate-Forward";
    case "duplicate of":
      return "System.LinkTypes.Duplicate-Reverse";
    case "related":
      return "System.LinkTypes.Related";
    case "successor":
      return "System.LinkTypes.Dependency-Forward";
    case "predecessor":
      return "System.LinkTypes.Dependency-Reverse";
    case "tested by":
      return "Microsoft.VSTS.Common.TestedBy-Forward";
    case "tests":
      return "Microsoft.VSTS.Common.TestedBy-Reverse";
    case "affects":
      return "Microsoft.VSTS.Common.Affects-Forward";
    case "affected by":
      return "Microsoft.VSTS.Common.Affects-Reverse";
    case "artifact":
      return "ArtifactLink";
    default:
      throw new Error(`Unknown link type: ${name}`);
  }
}

function getArtifactLinkAttributeName(linkType: string): string {
  switch (linkType) {
    case "Wiki":
      return "Wiki Page";
    default:
      return linkType;
  }
}

function configureWorkItemTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- wit_work_item ----------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item,
    "Retrieve work item data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_batch", "list_comments", "my", "list_revisions", "list_for_iteration", "get_type"])
        .describe(
          "The action to perform. Options: get (get a single work item by ID), get_batch (get multiple work items by IDs), list_comments (list comments on a work item), my (get work items relevant to the authenticated user), list_revisions (list revisions of a work item), list_for_iteration (list work items for a team iteration), get_type (get metadata for a work item type)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      id: z.coerce.number().min(1).optional().describe("Work item ID. Required for: get."),
      ids: z.array(z.coerce.number().min(1)).optional().describe("Work item IDs. Required for: get_batch."),
      workItemId: z.coerce.number().min(1).optional().describe("Work item ID. Required for: list_comments, list_revisions."),
      fields: z.array(z.string()).optional().describe("Field names to include in the response. Used for: get, get_batch. For get, cannot be combined with expand."),
      asOf: z.coerce.date().optional().describe("Retrieve the work item as of a specific date. Used for: get."),
      expand: z
        .enum(getEnumKeys(WorkItemExpand) as [string, ...string[]])
        .optional()
        .describe("Expand options (None, Fields, Relations, Links, All). Used for: get, list_revisions. For get, cannot be combined with fields."),
      top: z.coerce.number().optional().describe("Maximum number of results to return. Used for: get_batch, list_comments, my, list_revisions. Defaults vary by action."),
      includeCompleted: z.boolean().optional().default(false).describe("Include completed work items. Used for: my. Defaults to false."),
      type: z.enum(["assignedtome", "myactivity"]).optional().describe("Type of work items to retrieve. Used for: my. Defaults to 'assignedtome'."),
      skip: z.coerce.number().optional().describe("Number of results to skip for pagination. Used for: list_revisions."),
      team: z.string().optional().describe("Team name or ID. Used for: list_for_iteration."),
      iterationId: z.string().optional().describe("Iteration ID. Required for: list_for_iteration."),
      workItemType: z.string().optional().describe("Work item type name. Required for: get_type."),
    },
    async ({ action, project, id, ids, workItemId, fields, asOf, expand, top, includeCompleted, type, skip, team, iterationId, workItemType }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (action === "get") {
          if (!id) return { content: [{ type: "text", text: "id is required for get" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item from.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          let effectiveExpand = expand;
          if (fields && fields.length > 0 && effectiveExpand != null) {
            effectiveExpand = "none";
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItem = await workItemApi.getWorkItem(id, fields, asOf, effectiveExpand as unknown as WorkItemExpand, resolvedProject);
          return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
        }

        if (action === "get_batch") {
          if (!ids || ids.length === 0) return { content: [{ type: "text", text: "ids is required for get_batch" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];
          const fieldsToUse = !fields || fields.length === 0 ? defaultFields : fields;
          const workitems = await workItemApi.getWorkItemsBatch({ ids, fields: fieldsToUse }, resolvedProject);

          const identityFields = [
            "System.AssignedTo",
            "System.CreatedBy",
            "System.ChangedBy",
            "System.AuthorizedAs",
            "Microsoft.VSTS.Common.ActivatedBy",
            "Microsoft.VSTS.Common.ResolvedBy",
            "Microsoft.VSTS.Common.ClosedBy",
          ];

          if (workitems && Array.isArray(workitems)) {
            workitems.forEach((item) => {
              if (item.fields) {
                identityFields.forEach((fieldName) => {
                  if (item.fields && item.fields[fieldName] && typeof item.fields[fieldName] === "object") {
                    const identityField = item.fields[fieldName];
                    const name = identityField.displayName || "";
                    const email = identityField.uniqueName || "";
                    item.fields[fieldName] = `${name} <${email}>`.trim();
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }] };
        }

        if (action === "list_comments") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_comments" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item comments for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const comments = await workItemApi.getComments(resolvedProject, workItemId, top ?? 50);
          return { content: [{ type: "text", text: JSON.stringify(comments, null, 2) }] };
        }

        if (action === "my") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getPredefinedQueryResults(resolvedProject, type ?? "assignedtome", top ?? 50, includeCompleted ?? false);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "list_revisions") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_revisions" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item revisions for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const revisions = await workItemApi.getRevisions(workItemId, top ?? 50, skip, safeEnumConvert(WorkItemExpand, expand), resolvedProject);

          if (revisions && Array.isArray(revisions)) {
            revisions.forEach((revision) => {
              if (revision.fields) {
                const revFields = revision.fields;
                Object.keys(revFields).forEach((fieldName) => {
                  const fieldValue = revFields[fieldName];
                  if (
                    fieldValue &&
                    typeof fieldValue === "object" &&
                    !Array.isArray(fieldValue) &&
                    "displayName" in fieldValue &&
                    ("url" in fieldValue || "_links" in fieldValue || "uniqueName" in fieldValue)
                  ) {
                    delete fieldValue.url;
                    delete fieldValue._links;
                    delete fieldValue.id;
                    delete fieldValue.uniqueName;
                    delete fieldValue.imageUrl;
                    delete fieldValue.descriptor;
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }] };
        }

        if (action === "list_for_iteration") {
          if (!iterationId) return { content: [{ type: "text", text: "iterationId is required for list_for_iteration" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for iteration.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getIterationWorkItems({ project: resolvedProject, team }, iterationId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "get_type") {
          if (!workItemType) return { content: [{ type: "text", text: "workItemType is required for get_type" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item type from.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItemTypeInfo = await workItemApi.getWorkItemType(resolvedProject, workItemType);
          return { content: [{ type: "text", text: JSON.stringify(workItemTypeInfo, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving work item: ${errorMessage}`,
          get_batch: `Error retrieving work items batch: ${errorMessage}`,
          list_comments: `Error listing work item comments: ${errorMessage}`,
          my: `Error retrieving work items: ${errorMessage}`,
          list_revisions: `Error listing work item revisions: ${errorMessage}`,
          list_for_iteration: `Error retrieving work items for iteration: ${errorMessage}`,
          get_type: `Error retrieving work item type: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_query --------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_query,
    "Retrieve work item query data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_results", "wiql"])
        .describe("The action to perform. Options: get (get a query by ID or path), get_results (run a saved query and return results), wiql (execute an ad-hoc WIQL query)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      query: z.string().optional().describe("The ID or path of the query. Required for: get."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("Expand parameter to include additional details. Used for: get."),
      depth: z.coerce.number().default(0).describe("Depth of expansion. Used for: get. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Include deleted items. Used for: get. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Use ISO date format in the response. Used for: get. Defaults to false."),
      id: z.string().optional().describe("The ID of the saved query. Required for: get_results."),
      team: z.string().optional().describe("Team name or ID. Used for: get_results, wiql."),
      timePrecision: z.boolean().optional().describe("Include time precision in date fields. Used for: get_results, wiql."),
      top: z.coerce.number().default(50).describe("Maximum number of results to return. Used for: get_results, wiql. Defaults to 50."),
      responseType: z.enum(["full", "ids"]).default("full").describe("Response type: 'full' returns complete results (default), 'ids' returns only work item IDs. Used for: get_results."),
      wiql: z.string().max(32768).optional().describe('The WIQL query string to execute. Required for: wiql. Example: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project".'),
    },
    async ({ action, project, query, expand, depth, includeDeleted, useIsoDateFormat, id, team, timePrecision, top, responseType, wiql }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, `Select the Azure DevOps project for ${action}.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        if (action === "get") {
          if (!query) return { content: [{ type: "text", text: "query is required for get" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const queryDetails = await workItemApi.getQuery(resolvedProject, query, safeEnumConvert(QueryExpand, expand), depth, includeDeleted, useIsoDateFormat);
          return { content: [{ type: "text", text: JSON.stringify(queryDetails, null, 2) }] };
        }

        if (action === "get_results") {
          if (!id) return { content: [{ type: "text", text: "id is required for get_results" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryById(id, teamContext, timePrecision, top);
          if (responseType === "ids") {
            const ids = queryResult.workItems?.map((workItem) => workItem.id).filter((wid): wid is number => wid !== undefined) || [];
            return { content: [{ type: "text", text: JSON.stringify({ ids, count: ids.length }, null, 2) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
        }

        if (action === "wiql") {
          if (!wiql) return { content: [{ type: "text", text: "wiql is required for wiql" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryByWiql({ query: wiql }, teamContext, timePrecision, top);
          return createExternalContentResponse(queryResult, "wiql query results");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving query: ${errorMessage}`,
          get_results: `Error retrieving query results: ${errorMessage}`,
          wiql: `Error executing WIQL query: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_backlog ------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_backlog,
    "Retrieve backlog data for a project and team. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "list_work_items"]).describe("The action to perform. Options: list (list backlog levels for a team), list_work_items (list work items in a specific backlog level)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Reuse from prior context if already known. If not provided, a team selection prompt will be shown."),
      backlogId: z.string().optional().describe("The ID of the backlog category to retrieve work items from. Required for: list_work_items."),
    },
    async ({ action, project, team, backlogId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitProject(server, connection, `Select the Azure DevOps project to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitTeam(server, connection, resolvedProject, `Select the Azure DevOps team to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };

        if (action === "list") {
          const backlogs = await workApi.getBacklogs(teamContext);
          return { content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }] };
        }

        if (action === "list_work_items") {
          if (!backlogId) return { content: [{ type: "text", text: "backlogId is required for list_work_items" }], isError: true };
          const workItems = await workApi.getBacklogLevelWorkItems(teamContext, backlogId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error listing backlogs: ${errorMessage}`,
          list_work_items: `Error listing backlog work items: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_work_item_attachment -----------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_attachment,
    "Download a work item attachment by its ID. By default returns the content as a base64-encoded resource. If savePath is provided, saves the file locally to that directory and returns the file path instead. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      attachmentId: z.string().describe("The GUID of the attachment. Found in the attachment URL: https://dev.azure.com/{org}/{project}/_apis/wit/attachments/{attachmentId}"),
      fileName: z.string().optional().describe("The file name of the attachment, e.g. 'screenshot.png'. Used to determine the MIME type or the saved file's name."),
      savePath: z
        .string()
        .optional()
        .describe(
          "Optional local directory path where the file should be saved. Must be a relative path (e.g. 'temp' or 'downloads/attachments'); absolute paths and path traversals are not allowed. If provided, saves the attachment to this directory and returns the file path. If omitted, returns the content as a base64-encoded resource."
        ),
    },
    async ({ project, attachmentId, fileName, savePath }) => {
      const isAbsolutePath = (value: string) => path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
      const hasDriveLetter = (value: string) => /^[a-zA-Z]:/.test(value);

      if (savePath !== undefined && (savePath.includes("..") || isAbsolutePath(savePath) || hasDriveLetter(savePath))) {
        throw new Error("Invalid savePath: absolute paths and path traversals are not allowed.");
      }

      if (fileName !== undefined && fileName.includes("..")) {
        throw new Error("Invalid fileName: path traversal is not allowed.");
      }

      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item attachment from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const stream = await workItemApi.getAttachmentContent(attachmentId, fileName, resolvedProject);

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          stream.on("end", resolve);
          stream.on("error", reject);
        });

        const buffer = Buffer.concat(chunks);

        if (savePath) {
          const resolvedFileName = fileName ?? attachmentId;
          const localFilePath = path.join(savePath, resolvedFileName);

          if (fs.existsSync(localFilePath)) {
            throw new Error(`File already exists: ${localFilePath}`);
          }

          fs.writeFileSync(localFilePath, buffer);

          return {
            content: [{ type: "text", text: `Attachment saved to: ${localFilePath}` }],
          };
        }

        const mimeType = getMimeType(fileName);

        if (mimeType.startsWith("text/")) {
          return {
            content: [{ type: "text", text: buffer.toString("utf-8") }],
          };
        }

        const base64Data = buffer.toString("base64");
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `data:${mimeType};base64,${base64Data}`,
                mimeType,
                blob: base64Data,
              },
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work item attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- wit_work_item_write ----------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_write,
    "Write operations for work items. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["create", "update", "update_batch", "add_child"])
        .describe(
          "The action to perform. Options: create (create a new work item), update (update fields on a single work item), update_batch (update multiple work items in one call), add_child (create child work items under a parent)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      id: z.coerce.number().min(1).optional().describe("Work item ID to update. Required for: update."),
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
      updates: z
        .array(
          z.object({
            op: z
              .string()
              .transform((val) => val.toLowerCase())
              .pipe(z.enum(["add", "replace", "remove"]))
              .default("add")
              .describe("The operation to perform."),
            path: z.string().describe("The field path, e.g. '/fields/System.Title'."),
            value: z.string().describe("The new value for the field."),
          })
        )
        .optional()
        .describe("Field updates for a single work item. Required for: update."),
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
    },
    async ({ action, project, id, workItemType, fields, updates, batchUpdates, parentId, items }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (action === "create") {
          if (!workItemType) return { content: [{ type: "text", text: "workItemType is required for create" }], isError: true };
          if (!fields || fields.length === 0) return { content: [{ type: "text", text: "fields is required for create" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to create the work item in.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workItemApi = await connection.getWorkItemTrackingApi();

          const document = fields.map(({ name, value, format }) => ({
            op: "add",
            path: `/fields/${name}`,
            value: encodeFormattedValue(value, format),
          }));

          fields.forEach(({ name, value, format }) => {
            if (value.length > 100 && format === "Markdown") {
              document.push({
                op: "add",
                path: `/multilineFieldsFormat/${name}`,
                value: "Markdown",
              });
            }
          });

          const newWorkItem = await workItemApi.createWorkItem(null, document, resolvedProject, workItemType);

          if (!newWorkItem) {
            return { content: [{ type: "text", text: "Work item was not created" }], isError: true };
          }

          return { content: [{ type: "text", text: JSON.stringify(newWorkItem, null, 2) }] };
        }

        if (action === "update") {
          if (!id) return { content: [{ type: "text", text: "id is required for update" }], isError: true };
          if (!updates || updates.length === 0) return { content: [{ type: "text", text: "updates is required for update" }], isError: true };

          const workItemApi = await connection.getWorkItemTrackingApi();
          const apiUpdates = updates.map((update) => ({ ...update, op: update.op }));
          const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id);
          return { content: [{ type: "text", text: JSON.stringify(updatedWorkItem, null, 2) }] };
        }

        if (action === "update_batch") {
          if (!batchUpdates || batchUpdates.length === 0) return { content: [{ type: "text", text: "batchUpdates is required for update_batch" }], isError: true };

          const orgUrl = connection.serverUrl;
          const accessToken = await tokenProvider();
          const uniqueIds = Array.from(new Set(batchUpdates.map((update) => update.id)));

          const body = uniqueIds.map((uid) => {
            const workItemUpdates = batchUpdates.filter((update) => update.id === uid);
            const operations = workItemUpdates.map(({ op, path: fieldPath, value, format }) => ({
              op: op,
              path: fieldPath,
              value: encodeFormattedValue(value, format),
            }));

            workItemUpdates.forEach(({ path: fieldPath, value, format }) => {
              if (format === "Markdown" && value && value.length > 100) {
                operations.push({
                  op: "Add",
                  path: `/multilineFieldsFormat${fieldPath.replace("/fields", "")}`,
                  value: "Markdown",
                });
              }
            });

            return {
              method: "PATCH",
              uri: `/_apis/wit/workitems/${uid}?api-version=${batchApiVersion}`,
              headers: { "Content-Type": "application/json-patch+json" },
              body: operations,
            };
          });

          const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": userAgentProvider(),
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            throw new Error(`Failed to update work items in batch: ${response.statusText}`);
          }

          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        if (action === "add_child") {
          if (!parentId) return { content: [{ type: "text", text: "parentId is required for add_child" }], isError: true };
          if (!workItemType) return { content: [{ type: "text", text: "workItemType is required for add_child" }], isError: true };
          if (!items || items.length === 0) return { content: [{ type: "text", text: "items is required for add_child" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to create child work items in.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          if (items.length > 50) {
            return { content: [{ type: "text", text: "A maximum of 50 child work items can be created in a single call." }], isError: true };
          }

          const orgUrl = connection.serverUrl;
          const accessToken = await tokenProvider();

          const body = items.map((item, x) => {
            const encodedDescription = encodeFormattedValue(item.description, item.format);

            const ops: { op: string; path: string; value: unknown }[] = [
              { op: "add", path: "/id", value: `-${x + 1}` },
              { op: "add", path: "/fields/System.Title", value: item.title },
              { op: "add", path: "/fields/System.Description", value: encodedDescription },
              { op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: encodedDescription },
              {
                op: "add",
                path: "/relations/-",
                value: {
                  rel: "System.LinkTypes.Hierarchy-Reverse",
                  url: `${connection.serverUrl}/${resolvedProject}/_apis/wit/workItems/${parentId}`,
                },
              },
            ];

            if (item.areaPath && item.areaPath.trim().length > 0) {
              ops.push({ op: "add", path: "/fields/System.AreaPath", value: item.areaPath });
            }

            if (item.iterationPath && item.iterationPath.trim().length > 0) {
              ops.push({ op: "add", path: "/fields/System.IterationPath", value: item.iterationPath });
            }

            if (item.format && item.format === "Markdown") {
              ops.push({ op: "add", path: "/multilineFieldsFormat/System.Description", value: item.format });
              ops.push({ op: "add", path: "/multilineFieldsFormat/Microsoft.VSTS.TCM.ReproSteps", value: item.format });
            }

            return {
              method: "PATCH",
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              uri: `/${encodeURIComponent(resolvedProject!)}/_apis/wit/workitems/$${encodeURIComponent(workItemType!)}?api-version=${batchApiVersion}`,
              headers: { "Content-Type": "application/json-patch+json" },
              body: ops,
            };
          });

          const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": userAgentProvider(),
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            throw new Error(`Failed to update work items in batch: ${response.statusText}`);
          }

          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          create: `Error creating work item: ${errorMessage}`,
          update: `Error updating work item: ${errorMessage}`,
          update_batch: `Error updating work items in batch: ${errorMessage}`,
          add_child: `Error creating child work items: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_work_item_comment_write --------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_comment_write,
    "Write operations for work item comments. Use the action parameter to specify the operation.",
    {
      action: z.enum(["add", "update"]).describe("The action to perform. Options: add (add a comment to a work item), update (update an existing comment on a work item)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      workItemId: z.coerce.number().min(1).optional().describe("The ID of the work item. Required for: add, update."),
      text: z.string().optional().describe("The comment text. Required for: add, update."),
      commentId: z.coerce.number().min(1).optional().describe("The ID of the comment to update. Required for: update."),
      format: z.enum(["Markdown", "Html"]).optional().default("Markdown").describe("Format of the comment text. Optional, defaults to 'Markdown'."),
    },
    async ({ action, project, workItemId, text, commentId, format }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const label = action === "add" ? "add a work item comment in" : "update the work item comment in";
          const result = await elicitProject(server, connection, `Select the Azure DevOps project to ${label}.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        if (!workItemId) return { content: [{ type: "text", text: "workItemId is required" }], isError: true };
        if (!text) return { content: [{ type: "text", text: "text is required" }], isError: true };

        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();
        const formatParameter = (format ?? "Markdown") === "Markdown" ? 0 : 1;

        if (action === "add") {
          const response = await fetch(
            `${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": userAgentProvider(),
              },
              body: JSON.stringify({ text }),
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to add a work item comment: ${response.statusText}}`);
          }

          return { content: [{ type: "text", text: await response.text() }] };
        }

        if (action === "update") {
          if (!commentId) return { content: [{ type: "text", text: "commentId is required for update" }], isError: true };

          const response = await fetch(
            `${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments/${commentId}?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`,
            {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": userAgentProvider(),
              },
              body: JSON.stringify({ text }),
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to update work item comment: ${response.statusText}`);
          }

          return { content: [{ type: "text", text: await response.text() }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          add: `Error adding work item comment: ${errorMessage}`,
          update: `Error updating work item comment: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_work_item_link_write -----------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_link_write,
    "Write operations for work item links. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["link", "unlink", "link_to_pull_request", "add_artifact_link"])
        .describe(
          "The action to perform. Options: link (link two work items together), unlink (remove links from a work item), link_to_pull_request (link a work item to a pull request), add_artifact_link (add a repository, branch, commit, or build artifact link to a work item)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      // link
      updates: z
        .array(
          z.object({
            id: z.coerce.number().min(1).describe("The ID of the work item to update."),
            linkToId: z.coerce.number().min(1).describe("The ID of the work item to link to."),
            type: z
              .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by"])
              .default("related")
              .describe("Type of link. Defaults to 'related'."),
            comment: z.string().optional().describe("Optional comment for the link."),
          })
        )
        .optional()
        .describe("Link operations to apply. Required for: link."),
      // unlink
      id: z.coerce.number().min(1).optional().describe("Work item ID to remove links from. Required for: unlink."),
      type: z
        .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by", "artifact"])
        .optional()
        .describe("Link type to remove. Required for: unlink."),
      url: z.string().optional().describe("URL to match when removing a link. Used for: unlink. If not provided, all links of the specified type are removed."),
      // link_to_pull_request and add_artifact_link
      projectId: z.string().optional().describe("The project ID (GUID). Required for: link_to_pull_request, and add_artifact_link (Git/Wiki types)."),
      repositoryId: z.string().optional().describe("The repository ID. Required for: link_to_pull_request and add_artifact_link (Git types)."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The pull request ID. Required for: link_to_pull_request; used for: add_artifact_link (Pull Request type)."),
      workItemId: z.coerce.number().min(1).optional().describe("The work item ID. Required for: link_to_pull_request, add_artifact_link."),
      pullRequestProjectId: z.string().optional().describe("Project ID containing the pull request. Used for: link_to_pull_request. Defaults to projectId."),
      // add_artifact_link
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
    },
    async ({
      action,
      project,
      updates,
      id,
      type,
      url,
      projectId,
      repositoryId,
      pullRequestId,
      workItemId,
      pullRequestProjectId,
      artifactUri,
      branchName,
      commitId,
      buildId,
      wikiId,
      pageId,
      pagePath,
      linkType,
      comment,
    }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (action === "link") {
          if (!updates || updates.length === 0) return { content: [{ type: "text", text: "updates is required for link" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to link work items in.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const orgUrl = connection.serverUrl;
          const accessToken = await tokenProvider();
          const uniqueIds = Array.from(new Set(updates.map((update) => update.id)));

          const body = uniqueIds.map((uid) => ({
            method: "PATCH",
            uri: `/_apis/wit/workitems/${uid}?api-version=${batchApiVersion}`,
            headers: { "Content-Type": "application/json-patch+json" },
            body: updates
              .filter((update) => update.id === uid)
              .map(({ linkToId, type: linkTypeName, comment: linkComment }) => ({
                op: "add",
                path: "/relations/-",
                value: {
                  rel: `${getLinkTypeFromName(linkTypeName)}`,
                  url: `${orgUrl}/${resolvedProject}/_apis/wit/workItems/${linkToId}`,
                  attributes: { comment: linkComment || "" },
                },
              })),
          }));

          const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": userAgentProvider(),
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            throw new Error(`Failed to update work items in batch: ${response.statusText}`);
          }

          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        if (action === "unlink") {
          if (!id) return { content: [{ type: "text", text: "id is required for unlink" }], isError: true };
          if (!type) return { content: [{ type: "text", text: "type is required for unlink" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to unlink work items in.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItem = await workItemApi.getWorkItem(id, undefined, undefined, WorkItemExpand.Relations, resolvedProject);
          const relations: WorkItemRelation[] = workItem.relations ?? [];
          const linkTypeName = getLinkTypeFromName(type);

          let relationIndexes: number[] = [];

          if (url && url.trim().length > 0) {
            relationIndexes = relations.map((relation, idx) => (relation.rel === linkTypeName && relation.url === url ? idx : -1)).filter((idx) => idx !== -1);
          } else {
            relationIndexes = relations.map((relation, idx) => (relation.rel === linkTypeName ? idx : -1)).filter((idx) => idx !== -1);
          }

          if (relationIndexes.length === 0) {
            return {
              content: [{ type: "text", text: `No matching relations found for link type '${type}'${url ? ` and URL '${url}'` : ""}.\n${JSON.stringify(relations, null, 2)}` }],
              isError: true,
            };
          }

          const removedRelations = relationIndexes.map((idx) => relations[idx]);
          relationIndexes.sort((a, b) => b - a);

          const apiUpdates = relationIndexes.map((idx) => ({ op: "remove", path: `/relations/${idx}` }));
          const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id, resolvedProject);

          return {
            content: [
              {
                type: "text",
                text:
                  `Removed ${removedRelations.length} link(s) of type '${type}':\n` +
                  JSON.stringify(removedRelations, null, 2) +
                  `\n\nUpdated work item result:\n` +
                  JSON.stringify(updatedWorkItem, null, 2),
              },
            ],
            isError: false,
          };
        }

        if (action === "link_to_pull_request") {
          if (!projectId) return { content: [{ type: "text", text: "projectId is required for link_to_pull_request" }], isError: true };
          if (!repositoryId) return { content: [{ type: "text", text: "repositoryId is required for link_to_pull_request" }], isError: true };
          if (pullRequestId === undefined) return { content: [{ type: "text", text: "pullRequestId is required for link_to_pull_request" }], isError: true };
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for link_to_pull_request" }], isError: true };

          const workItemTrackingApi = await connection.getWorkItemTrackingApi();
          const artifactProjectId = pullRequestProjectId && pullRequestProjectId.trim() !== "" ? pullRequestProjectId : projectId;
          const artifactPathValue = `${artifactProjectId}/${repositoryId}/${pullRequestId}`;
          const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

          const patchDocument = [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: vstfsUrl,
                attributes: { name: "Pull Request" },
              },
            },
          ];

          const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, projectId);

          if (!workItem) {
            return { content: [{ type: "text", text: "Work item update failed" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify({ workItemId, pullRequestId, success: true }, null, 2) }],
          };
        }

        if (action === "add_artifact_link") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for add_artifact_link" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to add the artifact link in.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workItemTrackingApi = await connection.getWorkItemTrackingApi();
          const effectiveLinkType = linkType ?? "Branch";
          let finalArtifactUri: string;

          if (artifactUri) {
            finalArtifactUri = artifactUri;
          } else {
            switch (effectiveLinkType) {
              case "Branch":
                if (!projectId || !repositoryId || !branchName) {
                  return { content: [{ type: "text", text: "For 'Branch' links, 'projectId', 'repositoryId', and 'branchName' are required." }], isError: true };
                }
                finalArtifactUri = `vstfs:///Git/Ref/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2FGB${encodeURIComponent(branchName)}`;
                break;

              case "Fixed in Commit":
                if (!projectId || !repositoryId || !commitId) {
                  return { content: [{ type: "text", text: "For 'Fixed in Commit' links, 'projectId', 'repositoryId', and 'commitId' are required." }], isError: true };
                }
                finalArtifactUri = `vstfs:///Git/Commit/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(commitId)}`;
                break;

              case "Pull Request":
                if (!projectId || !repositoryId || pullRequestId === undefined) {
                  return { content: [{ type: "text", text: "For 'Pull Request' links, 'projectId', 'repositoryId', and 'pullRequestId' are required." }], isError: true };
                }
                finalArtifactUri = `vstfs:///Git/PullRequestId/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(pullRequestId.toString())}`;
                break;

              case "Build":
              case "Found in build":
              case "Integrated in build":
                if (buildId === undefined) {
                  return { content: [{ type: "text", text: `For '${effectiveLinkType}' links, 'buildId' is required.` }], isError: true };
                }
                finalArtifactUri = `vstfs:///Build/Build/${encodeURIComponent(buildId.toString())}`;
                break;

              case "Wiki": {
                if (!projectId || !wikiId) {
                  return { content: [{ type: "text", text: "For 'Wiki' links, 'projectId', 'wikiId', and 'pagePath' are required." }], isError: true };
                }

                let resolvedPagePath = pagePath;

                if (pageId !== undefined) {
                  const orgUrl = connection.serverUrl;
                  const accessToken = await tokenProvider();
                  const pageResponse = await fetch(`${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wiki/wikis/${encodeURIComponent(wikiId)}/pages/${pageId}?api-version=7.1`, {
                    headers: {
                      "Authorization": `Bearer ${accessToken}`,
                      "User-Agent": userAgentProvider(),
                    },
                  });
                  if (!pageResponse.ok) {
                    return { content: [{ type: "text", text: `Failed to look up wiki page ID ${pageId}: ${pageResponse.statusText}` }], isError: true };
                  }
                  const pageData = await pageResponse.json();
                  resolvedPagePath = pageData.path as string;
                }

                if (!resolvedPagePath) {
                  return { content: [{ type: "text", text: "For 'Wiki' links, 'pageId' or 'pagePath' is required." }], isError: true };
                }

                const normalizedPath = resolvedPagePath.startsWith("/") ? resolvedPagePath.slice(1) : resolvedPagePath;
                const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("%2F");
                finalArtifactUri = `vstfs:///Wiki/WikiPage/${encodeURIComponent(projectId)}%2F${encodeURIComponent(wikiId)}%2F${encodedPath}`;
                break;
              }

              default:
                return {
                  content: [{ type: "text", text: `URI building from components is not supported for link type '${effectiveLinkType}'. Please provide the full 'artifactUri' instead.` }],
                  isError: true,
                };
            }
          }

          const patchDocument = [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: finalArtifactUri,
                attributes: {
                  name: getArtifactLinkAttributeName(effectiveLinkType),
                  ...(comment && { comment }),
                },
              },
            },
          ];

          const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, resolvedProject);

          if (!workItem) {
            return { content: [{ type: "text", text: "Work item update failed" }], isError: true };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ workItemId, artifactUri: finalArtifactUri, linkType: effectiveLinkType, comment: comment || null, success: true }, null, 2),
              },
            ],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          link: `Error linking work items: ${errorMessage}`,
          unlink: `Error unlinking work item: ${errorMessage}`,
          link_to_pull_request: `Error linking work item to pull request: ${errorMessage}`,
          add_artifact_link: `Error adding artifact link to work item: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );
}

function getMimeType(fileName: string | undefined): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    html: "text/html",
    htm: "text/html",
    xml: "text/xml",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    zip: "application/zip",
  };
  return (ext && mimeTypes[ext]) ?? "application/octet-stream";
}

export { WORKITEM_TOOLS, configureWorkItemTools };
