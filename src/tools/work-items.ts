// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import { Readable } from "stream";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { WorkItemExpand, WorkItemRelation } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { GetFieldsExpand, QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { batchApiVersion, markdownCommentsApiVersion, getEnumKeys, safeEnumConvert, encodeFormattedValue } from "../utils.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { optionalProject, optionalTeam, optionalTeamWith, requiredProjectWith } from "../shared/common-params.js";

const WORKITEM_TOOLS = {
  my_work_items: "wit_my_work_items",
  list_backlogs: "wit_list_backlogs",
  list_backlog_work_items: "wit_list_backlog_work_items",
  get_work_item: "wit_get_work_item",
  get_work_items_batch_by_ids: "wit_get_work_items_batch_by_ids",
  update_work_item: "wit_update_work_item",
  create_work_item: "wit_create_work_item",
  list_work_item_comments: "wit_list_work_item_comments",
  list_work_item_revisions: "wit_list_work_item_revisions",
  get_work_items_for_iteration: "wit_get_work_items_for_iteration",
  add_work_item_comment: "wit_add_work_item_comment",
  update_work_item_comment: "wit_update_work_item_comment",
  add_child_work_items: "wit_add_child_work_items",
  link_work_item_to_pull_request: "wit_link_work_item_to_pull_request",
  get_work_item_type: "wit_get_work_item_type",
  get_query: "wit_get_query",
  get_query_results_by_id: "wit_get_query_results_by_id",
  update_work_items_batch: "wit_update_work_items_batch",
  work_items_link: "wit_work_items_link",
  work_item_unlink: "wit_work_item_unlink",
  add_artifact_link: "wit_add_artifact_link",
  get_work_item_attachment: "wit_get_work_item_attachment",
  create_attachment: "wit_create_attachment",
  query_by_wiql: "wit_query_by_wiql",
  delete_work_item: "wit_delete_work_item",
  list_deleted_work_items: "wit_list_deleted_work_items",
  restore_work_item: "wit_restore_work_item",
  destroy_work_item: "wit_destroy_work_item",
  list_tags: "wit_list_tags",
  get_tag: "wit_get_tag",
  update_tag: "wit_update_tag",
  delete_tag: "wit_delete_tag",
  list_templates: "wit_list_templates",
  get_template: "wit_get_template",
  create_template: "wit_create_template",
  replace_template: "wit_replace_template",
  delete_template: "wit_delete_template",
  list_queries: "wit_list_queries",
  create_query: "wit_create_query",
  update_query: "wit_update_query",
  delete_query: "wit_delete_query",
  list_work_item_types: "wit_list_work_item_types",
  list_type_categories: "wit_list_type_categories",
  get_type_category: "wit_get_type_category",
  list_relation_types: "wit_list_relation_types",
  list_fields: "wit_list_fields",
  get_field: "wit_get_field",
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
      // Anything dotted is treated as a link type reference name, e.g.
      // "System.LinkTypes.Hierarchy-Forward" or a custom type from
      // wit_list_relation_types. The friendly names above only cover the
      // standard set, so without this custom link types are unusable.
      if (name.includes(".")) {
        return name;
      }
      throw new Error(`Unknown link type: ${name}`);
  }
}

function configureWorkItemTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  registerTool(
    server,
    WORKITEM_TOOLS.list_backlogs,
    "Receive a list of backlogs for a given project and team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list backlogs for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list backlogs for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };
        const backlogs = await workApi.getBacklogs(teamContext);

        return {
          content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error listing backlogs: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_backlog_work_items,
    "Retrieve a list of backlogs of for a given project, team, and backlog category. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      backlogId: z.string().describe("The ID of the backlog category to retrieve work items from."),
    },
    async ({ project, team, backlogId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list backlog work items for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list backlog work items for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };

        const workItems = await workApi.getBacklogLevelWorkItems(teamContext, backlogId);

        return {
          content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error listing backlog work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.my_work_items,
    "Retrieve a list of work items relevent to the authenticated user. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      type: z.enum(["assignedtome", "myactivity"]).default("assignedtome").describe("The type of work items to retrieve. Defaults to 'assignedtome'."),
      top: z.coerce.number().default(50).describe("The maximum number of work items to return. Defaults to 50."),
      includeCompleted: z.boolean().default(false).describe("Whether to include completed work items. Defaults to false."),
    },
    async ({ project, type, top, includeCompleted }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();

        const workItems = await workApi.getPredefinedQueryResults(resolvedProject, type, top, includeCompleted);

        return {
          content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_work_items_batch_by_ids,
    "Retrieve list of work items by IDs in batch. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      ids: z.array(z.coerce.number().min(1)).describe("The IDs of the work items to retrieve."),
      fields: z.array(z.string()).optional().describe("Optional list of fields to include in the response. If not provided, a hardcoded default set of fields will be used."),
    },
    async ({ project, ids, fields }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];

        // If no fields are provided, use the default set of fields
        const fieldsToUse = !fields || fields.length === 0 ? defaultFields : fields;

        const workitems = await workItemApi.getWorkItemsBatch({ ids, fields: fieldsToUse }, resolvedProject);

        // List of identity fields that need to be transformed from objects to formatted strings
        const identityFields = [
          "System.AssignedTo",
          "System.CreatedBy",
          "System.ChangedBy",
          "System.AuthorizedAs",
          "Microsoft.VSTS.Common.ActivatedBy",
          "Microsoft.VSTS.Common.ResolvedBy",
          "Microsoft.VSTS.Common.ClosedBy",
        ];

        // Format identity fields to include displayName and uniqueName
        // Removing the identity object as the response. It's too much and not needed
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

        return {
          content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work items batch: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_work_item,
    "Get a single work item by ID. If a project is not specified, you will be prompted to select one.",
    {
      id: z.coerce.number().min(1).describe("The ID of the work item to retrieve."),
      project: optionalProject,
      fields: z
        .array(z.string())
        .optional()
        .describe("Optional list of fields to include in the response. If not provided, all fields will be returned. Cannot be used together with the expand parameter."),
      asOf: z.coerce.date().optional().describe("Optional date string to retrieve the work item as of a specific time. If not provided, the current state will be returned."),
      expand: z
        .enum(["all", "fields", "links", "none", "relations"])
        .describe("Optional expand parameter to include additional details in the response. Cannot be used together with the fields parameter.")
        .optional()
        .describe(
          "Expand options include 'All', 'Fields', 'Links', 'None', and 'Relations'. Relations can be used to get child workitems. Defaults to 'None'. Cannot be used together with the fields parameter."
        ),
    },
    async ({ id, project, fields, asOf, expand }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item from.");

          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        // The Azure DevOps API does not support using expand and fields together.
        // When both are provided, prefer fields as it is the more specific selection.
        if (fields && fields.length > 0 && expand != null) {
          expand = "none";
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItem = await workItemApi.getWorkItem(id, fields, asOf, expand as unknown as WorkItemExpand, resolvedProject);

        return {
          content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error retrieving work item: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_work_item_comments,
    "Retrieve list of comments for a work item by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to retrieve comments for."),
      top: z.coerce.number().default(50).describe("Optional number of comments to retrieve. Defaults to all comments."),
    },
    async ({ project, workItemId, top }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item comments for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const comments = await workItemApi.getComments(resolvedProject, workItemId, top);

        return {
          content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error listing work item comments: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.add_work_item_comment,
    "Add comment to a work item by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to add a comment to."),
      comment: z
        .string()
        .describe(
          "The text of the comment to add to the work item. Pass non-ASCII text (e.g. Cyrillic) as raw UTF-8 characters, not as literal \\uXXXX escape sequences — escape sequences are stored verbatim and not decoded."
        ),
      format: z.enum(["Markdown", "Html"]).optional().default("Markdown").describe("The format of the comment text, e.g., 'Markdown', 'Html'. Optional, defaults to 'Markdown'."),
    },
    async ({ project, workItemId, comment, format }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to add a work item comment in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        const body = {
          text: comment,
        };

        const formatParameter = (format ?? "Markdown") === "Markdown" ? 0 : 1;
        const response = await fetch(
          `${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=utf-8",
              "User-Agent": userAgentProvider(),
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to add a work item comment: ${response.statusText}}`);
        }

        const comments = await response.text();

        return {
          content: [{ type: "text", text: comments }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error adding work item comment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.update_work_item_comment,
    "Update an existing comment on a work item by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemId: z.coerce.number().min(1).describe("The ID of the work item."),
      commentId: z.coerce.number().min(1).describe("The ID of the comment to update."),
      text: z
        .string()
        .describe(
          "The updated comment text. Pass non-ASCII text (e.g. Cyrillic) as raw UTF-8 characters, not as literal \\uXXXX escape sequences — escape sequences are stored verbatim and not decoded."
        ),
      format: z.enum(["Markdown", "Html"]).optional().default("Markdown").describe("The format of the comment text, e.g., 'Markdown', 'Html'. Optional, defaults to 'Markdown'."),
    },
    async ({ project, workItemId, commentId, text, format }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to update the work item comment in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();
        const body: Record<string, string> = { text };
        const formatParameter = (format ?? "Markdown") === "Markdown" ? 0 : 1;

        const response = await fetch(
          `${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments/${commentId}?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=utf-8",
              "User-Agent": userAgentProvider(),
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update work item comment: ${response.statusText}`);
        }

        const updatedComment = await response.text();

        return {
          content: [{ type: "text", text: updatedComment }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error updating work item comment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_work_item_revisions,
    "Retrieve list of revisions for a work item by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to retrieve revisions for."),
      top: z.coerce.number().default(50).describe("Optional number of revisions to retrieve. If not provided, all revisions will be returned."),
      skip: z.coerce.number().optional().describe("Optional number of revisions to skip for pagination. Defaults to 0."),
      expand: z
        .enum(getEnumKeys(WorkItemExpand) as [string, ...string[]])
        .default("None")
        .optional()
        .describe("Optional expand parameter to include additional details. Defaults to 'None'."),
    },
    async ({ project, workItemId, top, skip, expand }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item revisions for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const revisions = await workItemApi.getRevisions(workItemId, top, skip, safeEnumConvert(WorkItemExpand, expand), resolvedProject);

        // Dynamically clean up identity objects in revision fields
        // Identity objects typically have properties like displayName, url, _links, id, uniqueName, imageUrl, descriptor
        if (revisions && Array.isArray(revisions)) {
          revisions.forEach((revision) => {
            if (revision.fields) {
              const fields = revision.fields;
              Object.keys(fields).forEach((fieldName) => {
                const fieldValue = fields[fieldName];
                // Check if this is an identity object by looking for common identity properties
                if (
                  fieldValue &&
                  typeof fieldValue === "object" &&
                  !Array.isArray(fieldValue) &&
                  "displayName" in fieldValue &&
                  ("url" in fieldValue || "_links" in fieldValue || "uniqueName" in fieldValue)
                ) {
                  // Remove unwanted properties from identity objects
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

        return {
          content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error listing work item revisions: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.add_child_work_items,
    "Create one or many child work items from a parent by work item type and parent id. If a project is not specified, you will be prompted to select one.",
    {
      parentId: z.coerce.number().min(1).describe("The ID of the parent work item to create a child work item under."),
      project: optionalProject,
      workItemType: z.string().describe("The type of the child work item to create."),
      items: z.array(
        z.object({
          title: z.string().describe("The title of the child work item."),
          description: z.string().describe("The description of the child work item."),
          format: z.enum(["Markdown", "Html"]).default("Markdown").describe("Format for the description on the child work item, e.g., 'Markdown', 'Html'. Defaults to 'Markdown'."),
          areaPath: z.string().optional().describe("Optional area path for the child work item."),
          iterationPath: z.string().optional().describe("Optional iteration path for the child work item."),
        })
      ),
    },
    async ({ parentId, project, workItemType, items }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to create child work items in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        if (items.length > 50) {
          return {
            content: [{ type: "text", text: `A maximum of 50 child work items can be created in a single call.` }],
            isError: true,
          };
        }

        const body = items.map((item, x) => {
          const encodedDescription = encodeFormattedValue(item.description, item.format);

          const ops = [
            {
              op: "add",
              path: "/id",
              value: `-${x + 1}`,
            },
            {
              op: "add",
              path: "/fields/System.Title",
              value: item.title,
            },
            {
              op: "add",
              path: "/fields/System.Description",
              value: encodedDescription,
            },
            {
              op: "add",
              path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
              value: encodedDescription,
            },
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
            ops.push({
              op: "add",
              path: "/fields/System.AreaPath",
              value: item.areaPath,
            });
          }

          if (item.iterationPath && item.iterationPath.trim().length > 0) {
            ops.push({
              op: "add",
              path: "/fields/System.IterationPath",
              value: item.iterationPath,
            });
          }

          if (item.format && item.format === "Markdown") {
            ops.push({
              op: "add",
              path: "/multilineFieldsFormat/System.Description",
              value: item.format,
            });

            ops.push({
              op: "add",
              path: "/multilineFieldsFormat/Microsoft.VSTS.TCM.ReproSteps",
              value: item.format,
            });
          }

          return {
            method: "PATCH",
            uri: `/${encodeURIComponent(resolvedProject)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=${batchApiVersion}`,
            headers: {
              "Content-Type": "application/json-patch+json",
            },
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

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating child work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.link_work_item_to_pull_request,
    "Link a single work item to an existing pull request.",
    {
      projectId: requiredProjectWith("Must be the project ID; a name is not accepted here."),
      repositoryId: z.string().describe("The ID of the repository containing the pull request. Do not use the repository name here, use the ID instead."),
      pullRequestId: z.coerce.number().min(1).describe("The ID of the pull request to link to."),
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to link to the pull request."),
      pullRequestProjectId: z.string().optional().describe("The project ID containing the pull request. If not provided, defaults to the work item's project ID (for same-project linking)."),
    },
    async ({ projectId, repositoryId, pullRequestId, workItemId, pullRequestProjectId }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        // Create artifact link relation using vstfs format
        // Format: vstfs:///Git/PullRequestId/{project}/{repositoryId}/{pullRequestId}
        const artifactProjectId = pullRequestProjectId && pullRequestProjectId.trim() !== "" ? pullRequestProjectId : projectId;
        const artifactPathValue = `${artifactProjectId}/${repositoryId}/${pullRequestId}`;
        const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

        // Use the PATCH document format for adding a relation
        const patchDocument = [
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "ArtifactLink",
              url: vstfsUrl,
              attributes: {
                name: "Pull Request",
              },
            },
          },
        ];

        // Use the WorkItem API to update the work item with the new relation
        const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, projectId);

        if (!workItem) {
          return { content: [{ type: "text", text: "Work item update failed" }], isError: true };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  workItemId,
                  pullRequestId,
                  success: true,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error linking work item to pull request: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_work_items_for_iteration,
    "Retrieve a list of work items for a specified iteration. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID of the iteration to retrieve work items for."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for iteration.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();

        //get the work items for the current iteration
        const workItems = await workApi.getIterationWorkItems({ project: resolvedProject, team }, iterationId);

        return {
          content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work items for iteration: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.update_work_item,
    "Update a work item by ID with specified fields.",
    {
      id: z.coerce.number().min(1).describe("The ID of the work item to update."),
      updates: z
        .array(
          z.object({
            op: z
              .string()
              .transform((val) => val.toLowerCase())
              .pipe(z.enum(["add", "replace", "remove"]))
              .default("add")
              .describe("The operation to perform on the field."),
            path: z.string().describe("The path of the field to update, e.g., '/fields/System.Title'."),
            value: z.string().describe("The new value for the field. This is required for 'Add' and 'Replace' operations, and should be omitted for 'Remove' operations."),
          })
        )
        .describe("An array of field updates to apply to the work item."),
    },
    async ({ id, updates }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        // Convert operation names to lowercase for API
        const apiUpdates = updates.map((update) => ({
          ...update,
          op: update.op,
        }));

        const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id);

        return {
          content: [{ type: "text", text: JSON.stringify(updatedWorkItem, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error updating work item: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_work_item_type,
    "Get a specific work item type. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemType: z.string().describe("The name of the work item type to retrieve."),
    },
    async ({ project, workItemType }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item type from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();

        const workItemTypeInfo = await workItemApi.getWorkItemType(resolvedProject, workItemType);

        return {
          content: [{ type: "text", text: JSON.stringify(workItemTypeInfo, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work item type: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.create_work_item,
    "Create a new work item in a specified project and work item type. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      workItemType: z.string().describe("The type of work item to create, e.g., 'Task', 'Bug', etc."),
      fields: z
        .array(
          z.object({
            name: z.string().describe("The name of the field, e.g., 'System.Title'."),
            value: z.string().describe("The value of the field."),
            format: z.enum(["Html", "Markdown"]).optional().describe("the format of the field value, e.g., 'Html', 'Markdown'. Optional, defaults to 'Markdown'."),
          })
        )
        .describe("A record of field names and values to set on the new work item. Each fild is the field name and each value is the corresponding value to set for that field."),
    },
    async ({ project, workItemType, fields }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
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

        // Check if any field has format === "Markdown" and add the multilineFieldsFormat operation
        // this should only happen for large text fields, but since we dont't know by field name, lets assume if the users
        // passes a value longer than 100 characters, then we can set the format to Markdown
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

        return {
          content: [{ type: "text", text: JSON.stringify(newWorkItem, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating work item: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_query,
    "Get a query by its ID or path. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      query: z.string().describe("The ID or path of the query to retrieve."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("Optional expand parameter to include additional details in the response. Defaults to 'None'."),
      depth: z.coerce.number().default(0).describe("Optional depth parameter to specify how deep to expand the query. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Whether to include deleted items in the query results. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Whether to use ISO date format in the response. Defaults to false."),
    },
    async ({ project, query, expand, depth, includeDeleted, useIsoDateFormat }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the query from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();

        const queryDetails = await workItemApi.getQuery(resolvedProject, query, safeEnumConvert(QueryExpand, expand), depth, includeDeleted, useIsoDateFormat);

        return {
          content: [{ type: "text", text: JSON.stringify(queryDetails, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving query: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_query_results_by_id,
    "Retrieve the results of a work item query given the query ID. Supports full or IDs-only response types.",
    {
      id: z.string().describe("The ID of the query to retrieve results for."),
      project: optionalProject,
      team: optionalTeam,
      timePrecision: z.boolean().optional().describe("Whether to include time precision in the results. Defaults to false."),
      top: z.coerce.number().default(50).describe("The maximum number of results to return. Defaults to 50."),
      responseType: z.enum(["full", "ids"]).default("full").describe("Response type: 'full' returns complete query results (default), 'ids' returns only work item IDs for reduced payload size."),
    },
    async ({ id, project, team, timePrecision, top, responseType }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const teamContext = { project, team };
        const queryResult = await workItemApi.queryById(id, teamContext, timePrecision, top);

        // If ids mode, extract and return only the IDs
        if (responseType === "ids") {
          const ids = queryResult.workItems?.map((workItem) => workItem.id).filter((id): id is number => id !== undefined) || [];
          return {
            content: [{ type: "text", text: JSON.stringify({ ids, count: ids.length }, null, 2) }],
          };
        }

        // Default: return full query results
        return {
          content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving query results: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.update_work_items_batch,
    "Update work items in batch",
    {
      updates: z
        .array(
          z.object({
            op: z.enum(["Add", "Replace", "Remove"]).default("Add").describe("The operation to perform on the field."),
            id: z.coerce.number().min(1).describe("The ID of the work item to update."),
            path: z.string().describe("The path of the field to update, e.g., '/fields/System.Title'."),
            value: z.string().describe("The new value for the field. This is required for 'add' and 'replace' operations, and should be omitted for 'remove' operations."),
            format: z
              .enum(["Html", "Markdown"])
              .optional()
              .describe("The format of the field value. Only to be used for large text fields. e.g., 'Html', 'Markdown'. Optional, defaults to 'Markdown'."),
          })
        )
        .describe("An array of updates to apply to work items. Each update should include the operation (op), work item ID (id), field path (path), and new value (value)."),
    },
    async ({ updates }) => {
      try {
        const connection = await connectionProvider();
        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        // Extract unique IDs from the updates array
        const uniqueIds = Array.from(new Set(updates.map((update) => update.id)));

        const body = uniqueIds.map((id) => {
          const workItemUpdates = updates.filter((update) => update.id === id);
          const operations = workItemUpdates.map(({ op, path, value, format }) => ({
            op: op,
            path: path,
            value: encodeFormattedValue(value, format),
          }));

          // Add format operations for Markdown fields
          workItemUpdates.forEach(({ path, value, format }) => {
            if (format === "Markdown" && value && value.length > 100) {
              operations.push({
                op: "Add",
                path: `/multilineFieldsFormat${path.replace("/fields", "")}`,
                value: "Markdown",
              });
            }
          });

          return {
            method: "PATCH",
            uri: `/_apis/wit/workitems/${id}?api-version=${batchApiVersion}`,
            headers: {
              "Content-Type": "application/json-patch+json",
            },
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

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error updating work items in batch: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.work_items_link,
    "Link work items together in batch. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      updates: z
        .array(
          z.object({
            id: z.coerce.number().min(1).describe("The ID of the work item to update."),
            linkToId: z.coerce.number().min(1).describe("The ID of the work item to link to."),
            type: z
              .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by"])
              .or(z.string())
              .default("related")
              .describe(
                "Type of link to create between the work items. Options include 'parent', 'child', 'duplicate', 'duplicate of', 'related', 'successor', 'predecessor', 'tested by', 'tests', 'affects', and 'affected by'. A link type reference name such as 'System.LinkTypes.Hierarchy-Forward' is also accepted — use wit_list_relation_types to find custom ones. Defaults to 'related'."
              ),
            comment: z.string().optional().describe("Optional comment to include with the link. This can be used to provide additional context for the link being created."),
          })
        )
        .describe(""),
    },
    async ({ project, updates }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to link work items in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        // Extract unique IDs from the updates array
        const uniqueIds = Array.from(new Set(updates.map((update) => update.id)));

        const body = uniqueIds.map((id) => ({
          method: "PATCH",
          uri: `/_apis/wit/workitems/${id}?api-version=${batchApiVersion}`,
          headers: {
            "Content-Type": "application/json-patch+json",
          },
          body: updates
            .filter((update) => update.id === id)
            .map(({ linkToId, type, comment }) => ({
              op: "add",
              path: "/relations/-",
              value: {
                rel: `${getLinkTypeFromName(type)}`,
                url: `${orgUrl}/${resolvedProject}/_apis/wit/workItems/${linkToId}`,
                attributes: {
                  comment: comment || "",
                },
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

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error linking work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.work_item_unlink,
    "Remove one or many links from a single work item. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.coerce.number().min(1).describe("The ID of the work item to remove the links from."),
      type: z
        .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by", "artifact"])
        .or(z.string())
        .default("related")
        .describe(
          "Type of link to remove. Options include 'parent', 'child', 'duplicate', 'duplicate of', 'related', 'successor', 'predecessor', 'tested by', 'tests', 'affects', 'affected by', and 'artifact'. A link type reference name such as 'System.LinkTypes.Hierarchy-Reverse' is also accepted — use wit_list_relation_types to find custom ones. Defaults to 'related'."
        ),
      url: z.string().optional().describe("Optional URL to match for the link to remove. If not provided, all links of the specified type will be removed."),
    },
    async ({ project, id, type, url }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to unlink work items in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItem = await workItemApi.getWorkItem(id, undefined, undefined, WorkItemExpand.Relations, resolvedProject);
        const relations: WorkItemRelation[] = workItem.relations ?? [];
        const linkType = getLinkTypeFromName(type);

        let relationIndexes: number[] = [];

        if (url && url.trim().length > 0) {
          // If url is provided, find relations matching both rel type and url
          relationIndexes = relations.map((relation, idx) => (relation.rel === linkType && relation.url === url ? idx : -1)).filter((idx) => idx !== -1);
        } else {
          // If url is not provided, find all relations matching rel type
          relationIndexes = relations.map((relation, idx) => (relation.rel === linkType ? idx : -1)).filter((idx) => idx !== -1);
        }

        if (relationIndexes.length === 0) {
          return {
            content: [{ type: "text", text: `No matching relations found for link type '${type}'${url ? ` and URL '${url}'` : ""}.\n${JSON.stringify(relations, null, 2)}` }],
            isError: true,
          };
        }

        // Get the relations that will be removed for logging
        const removedRelations = relationIndexes.map((idx) => relations[idx]);

        // Sort indexes in descending order to avoid index shifting when removing
        relationIndexes.sort((a, b) => b - a);

        const apiUpdates = relationIndexes.map((idx) => ({
          op: "remove",
          path: `/relations/${idx}`,
        }));

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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error unlinking work item: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.add_artifact_link,
    "Add artifact links (repository, branch, commit, builds) to work items. You can either provide the full vstfs URI or the individual components to build it automatically. If a project is not specified, you will be prompted to select one.",
    {
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to add the artifact link to."),
      project: optionalProject,

      // Option 1: Provide full URI directly
      artifactUri: z.string().optional().describe("The complete VSTFS URI of the artifact to link. If provided, individual component parameters are ignored."),

      // Option 2: Provide individual components to build URI automatically based on linkType
      projectId: z.string().optional().describe("The project ID (GUID) containing the artifact. Required for Git artifacts when artifactUri is not provided."),
      repositoryId: z.string().optional().describe("The repository ID (GUID) containing the artifact. Required for Git artifacts when artifactUri is not provided."),
      branchName: z.string().optional().describe("The branch name (e.g., 'main'). Required when linkType is 'Branch'."),
      commitId: z.string().optional().describe("The commit SHA hash. Required when linkType is 'Fixed in Commit'."),
      pullRequestId: z.coerce.number().min(1).optional().describe("The pull request ID. Required when linkType is 'Pull Request'."),
      buildId: z.coerce.number().min(1).optional().describe("The build ID. Required when linkType is 'Build', 'Found in build', or 'Integrated in build'."),

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
        .default("Branch")
        .describe("Type of artifact link, defaults to 'Branch'. This determines both the link type and how to build the VSTFS URI from individual components."),
      comment: z.string().optional().describe("Comment to include with the artifact link."),
    },
    async ({ workItemId, project, artifactUri, projectId, repositoryId, branchName, commitId, pullRequestId, buildId, linkType, comment }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to add the artifact link in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        let finalArtifactUri: string;

        if (artifactUri) {
          // Use the provided full URI
          finalArtifactUri = artifactUri;
        } else {
          // Build the URI from individual components based on linkType
          switch (linkType) {
            case "Branch":
              if (!projectId || !repositoryId || !branchName) {
                return {
                  content: [{ type: "text", text: "For 'Branch' links, 'projectId', 'repositoryId', and 'branchName' are required." }],
                  isError: true,
                };
              }
              finalArtifactUri = `vstfs:///Git/Ref/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2FGB${encodeURIComponent(branchName)}`;
              break;

            case "Fixed in Commit":
              if (!projectId || !repositoryId || !commitId) {
                return {
                  content: [{ type: "text", text: "For 'Fixed in Commit' links, 'projectId', 'repositoryId', and 'commitId' are required." }],
                  isError: true,
                };
              }
              finalArtifactUri = `vstfs:///Git/Commit/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(commitId)}`;
              break;

            case "Pull Request":
              if (!projectId || !repositoryId || pullRequestId === undefined) {
                return {
                  content: [{ type: "text", text: "For 'Pull Request' links, 'projectId', 'repositoryId', and 'pullRequestId' are required." }],
                  isError: true,
                };
              }
              finalArtifactUri = `vstfs:///Git/PullRequestId/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(pullRequestId.toString())}`;
              break;

            case "Build":
            case "Found in build":
            case "Integrated in build":
              if (buildId === undefined) {
                return {
                  content: [{ type: "text", text: `For '${linkType}' links, 'buildId' is required.` }],
                  isError: true,
                };
              }
              finalArtifactUri = `vstfs:///Build/Build/${encodeURIComponent(buildId.toString())}`;
              break;

            default:
              return {
                content: [{ type: "text", text: `URI building from components is not supported for link type '${linkType}'. Please provide the full 'artifactUri' instead.` }],
                isError: true,
              };
          }
        }

        // Create the patch document for adding an artifact link relation
        const patchDocument = [
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "ArtifactLink",
              url: finalArtifactUri,
              attributes: {
                name: linkType,
                ...(comment && { comment }),
              },
            },
          },
        ];

        // Use the WorkItem API to update the work item with the new relation
        const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, resolvedProject);

        if (!workItem) {
          return { content: [{ type: "text", text: "Work item update failed" }], isError: true };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  workItemId,
                  artifactUri: finalArtifactUri,
                  linkType,
                  comment: comment || null,
                  success: true,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error adding artifact link to work item: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.query_by_wiql,
    "Execute a WIQL (Work Item Query Language) query and return the matching work items. If a project is not specified, you will be prompted to select one.",
    {
      wiql: z
        .string()
        .max(32768)
        .describe(
          'The WIQL query string to execute, e.g., "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = @project". ' +
            "IMPORTANT: always constrain the query to the intended project with an explicit [System.TeamProject] = @project clause in the WHERE block. " +
            "The team context passed alongside the query does NOT reliably scope results: flat (FROM WorkItems) queries can be silently filtered, and recursive (FROM WorkItemLinks ... MODE (Recursive)) queries ignore it entirely and return work items from the whole organization."
        ),
      project: optionalProject,
      team: optionalTeam,
      timePrecision: z.boolean().optional().describe("Whether to include time precision in date fields. Defaults to false."),
      top: z.coerce.number().default(50).describe("The maximum number of results to return. Defaults to 50."),
    },
    async ({ wiql, project, team, timePrecision, top }) => {
      try {
        const connection = await connectionProvider();
        let resolvedProject = project;

        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to run the WIQL query against.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const teamContext = { project: resolvedProject, team };
        const queryResult = await workItemApi.queryByWiql({ query: wiql }, teamContext, timePrecision, top);

        const response = createExternalContentResponse(queryResult, "wiql query results");

        // The team context alone does not reliably scope results: flat queries can be silently
        // filtered and recursive (WorkItemLinks) queries return work items from the entire
        // organization. When the query omits an explicit [System.TeamProject] filter, surface a
        // warning so the scoping behavior is not silent.
        if (!/\[?\s*system\.teamproject\s*\]?/i.test(wiql)) {
          const isRecursive = /mode\s*\(\s*recursive/i.test(wiql);
          const warning = isRecursive
            ? `Warning: this recursive WIQL query has no [System.TeamProject] filter. Recursive (WorkItemLinks) queries ignore the project/team context and return work items from the entire organization. Add "[System.TeamProject] = @project" to the WHERE clause to scope results to "${resolvedProject}".`
            : `Warning: this WIQL query has no [System.TeamProject] filter, so results may be silently filtered or span multiple projects. Add "[System.TeamProject] = @project" to the WHERE clause to scope results to "${resolvedProject}".`;
          response.content.unshift({ type: "text", text: warning });
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error executing WIQL query: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.create_attachment,
    "Upload a file as a work item attachment, optionally attaching it to a work item in the same call. Pass the file content inline: plain text as-is, or binary (images, archives, PDFs) base64-encoded with contentIsBase64 set. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      fileName: z.string().describe("The file name to store the attachment under, e.g. 'repro-steps.md' or 'screenshot.png'. The extension determines how Azure DevOps renders it."),
      content: z.string().describe("The file content. Plain text by default; base64-encoded when contentIsBase64 is true."),
      contentIsBase64: z.boolean().default(false).describe("Set to true when 'content' is base64-encoded, which is required for binary files."),
      workItemId: z.coerce.number().min(1).optional().describe("If provided, the uploaded file is also attached to this work item. Omit to only upload and get an attachment URL back."),
      comment: z.string().optional().describe("Comment stored on the attachment link. Only used when workItemId is provided."),
      areaPath: z.string().optional().describe("Area path to associate the upload with. Rarely needed."),
    },
    async ({ project, fileName, content, contentIsBase64, workItemId, comment, areaPath }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to upload the attachment to.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const buffer = Buffer.from(content, contentIsBase64 ? "base64" : "utf8");
        // Wrap the buffer in an array: Readable.from(buffer) would iterate the
        // Buffer byte by byte and upload a stream of individual numbers.
        const attachment = await workItemTrackingApi.createAttachment({}, Readable.from([buffer]), fileName, "simple", resolvedProject, areaPath);

        if (!attachment?.url) {
          return { content: [{ type: "text", text: "Attachment upload did not return a URL." }], isError: true };
        }

        if (!workItemId) {
          return { content: [{ type: "text", text: JSON.stringify(attachment, null, 2) }] };
        }

        const patchDocument = [
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "AttachedFile",
              url: attachment.url,
              attributes: comment ? { comment } : {},
            },
          },
        ];

        const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify({ attachment, workItem: { id: workItem?.id, rev: workItem?.rev } }, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating work item attachment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_work_item_attachment,
    "Download a work item attachment by its ID. By default returns the content as a base64-encoded resource. If savePath is provided, saves the file locally to that directory and returns the file path instead. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
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

  // Resolves the project the same way every tool here does: an explicit value
  // wins, otherwise the user is asked to pick one.
  async function resolveProject(connection: WebApi, project: string | undefined, message: string) {
    if (project) return { project };
    const result = await elicitProject(server, connection, message);
    if ("response" in result) return result;
    return { project: result.resolved };
  }

  registerTool(
    server,
    WORKITEM_TOOLS.delete_work_item,
    "Move a work item to the project's recycle bin. It stops appearing in queries and boards but can be restored with wit_restore_work_item. To erase it permanently instead, use wit_destroy_work_item.",
    {
      id: z.coerce.number().min(1).describe("The ID of the work item to delete."),
      project: optionalProject,
    },
    async ({ id, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the work item belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const deleted = await workItemTrackingApi.deleteWorkItem(id, ctx.project, false);

        return { content: [{ type: "text", text: JSON.stringify(deleted, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting work item: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_deleted_work_items,
    "List the work items in the project's recycle bin. Without ids it returns every deleted work item as a shallow reference; with ids it returns the details (type, title, who deleted it and when) of those specific ones.",
    {
      project: optionalProject,
      ids: z.array(z.coerce.number().min(1)).optional().describe("Only return these work item IDs, with full recycle bin details."),
    },
    async ({ project, ids }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project whose recycle bin to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const deleted = ids?.length ? await workItemTrackingApi.getDeletedWorkItems(ids, ctx.project) : await workItemTrackingApi.getDeletedWorkItemShallowReferences(ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(deleted, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing deleted work items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.restore_work_item,
    "Restore a work item from the project's recycle bin, putting it back in queries and boards with its original ID.",
    {
      id: z.coerce.number().min(1).describe("The ID of the deleted work item to restore."),
      project: optionalProject,
    },
    async ({ id, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the work item belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const restored = await workItemTrackingApi.restoreWorkItem({ isDeleted: false }, id, ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(restored, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error restoring work item: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.destroy_work_item,
    "Permanently erase a work item from the recycle bin. This cannot be undone and the work item cannot be restored afterwards — use wit_delete_work_item unless the caller explicitly asked for permanent removal.",
    {
      id: z.coerce.number().min(1).describe("The ID of the work item to destroy permanently."),
      project: optionalProject,
    },
    async ({ id, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the work item belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        await workItemTrackingApi.destroyWorkItem(id, ctx.project);

        return { content: [{ type: "text", text: `Work item ${id} was permanently destroyed.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error destroying work item: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_tags,
    "List the work item tags defined in a project, with their IDs. Use it to find the exact spelling of a tag before filtering by it, or to spot near-duplicate tags.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project whose tags to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const tags = await workItemTrackingApi.getTags(ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing tags: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_tag,
    "Get a single work item tag by its name or ID.",
    {
      tag: z.string().describe("The name or ID (GUID) of the tag."),
      project: optionalProject,
    },
    async ({ tag, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the tag belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const found = await workItemTrackingApi.getTag(ctx.project, tag);

        if (!found) {
          return { content: [{ type: "text", text: `Tag '${tag}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching tag: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.update_tag,
    "Rename a work item tag across the project. Every work item carrying the tag is updated, so this is the way to fix a typo or merge two spellings without touching work items one by one.",
    {
      tag: z.string().describe("The name or ID (GUID) of the tag to rename."),
      name: z.string().describe("The new name of the tag."),
      project: optionalProject,
    },
    async ({ tag, name, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the tag belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const updated = await workItemTrackingApi.updateTag({ name }, ctx.project, tag);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating tag: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.delete_tag,
    "Delete a work item tag from the project. The tag is removed from every work item that carries it; the work items themselves are untouched.",
    {
      tag: z.string().describe("The name or ID (GUID) of the tag to delete."),
      project: optionalProject,
    },
    async ({ tag, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the tag belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        await workItemTrackingApi.deleteTag(ctx.project, tag);

        return { content: [{ type: "text", text: `Tag '${tag}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting tag: ${errorMessage}` }], isError: true };
      }
    }
  );

  // Templates are team-scoped, so they need both a project and a team.
  async function resolveTeamContext(connection: WebApi, project: string | undefined, team: string | undefined, message: string) {
    const projectCtx = await resolveProject(connection, project, message);
    if ("response" in projectCtx) return projectCtx;

    if (team) return { teamContext: { project: projectCtx.project, team } };

    const result = await elicitTeam(server, connection, projectCtx.project, "Select the Azure DevOps team that owns the templates.");
    if ("response" in result) return result;
    return { teamContext: { project: projectCtx.project, team: result.resolved } };
  }

  registerTool(
    server,
    WORKITEM_TOOLS.list_templates,
    "List a team's work item templates: the preset field values a team applies when creating recurring work. Returns shallow references without the field values; use wit_get_template for those.",
    {
      project: optionalProject,
      team: optionalTeamWith("The team that owns the templates."),
      workItemType: z.string().optional().describe("Only return templates for this work item type, e.g. 'Bug'."),
    },
    async ({ project, team, workItemType }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team, "Select the Azure DevOps project whose templates to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const templates = await workItemTrackingApi.getTemplates(ctx.teamContext, workItemType);

        return { content: [{ type: "text", text: JSON.stringify(templates, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing work item templates: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_template,
    "Get a work item template with the field values it presets.",
    {
      templateId: z.string().describe("The ID (GUID) of the template."),
      project: optionalProject,
      team: optionalTeamWith("The team that owns the template."),
    },
    async ({ templateId, project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team, "Select the Azure DevOps project the template belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const template = await workItemTrackingApi.getTemplate(ctx.teamContext, templateId);

        if (!template) {
          return { content: [{ type: "text", text: `Template '${templateId}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(template, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item template: ${errorMessage}` }], isError: true };
      }
    }
  );

  const templateFieldsSchema = z
    .record(z.string())
    .describe('Field values the template presets, keyed by reference name, e.g. { "System.Title": "Release checklist", "System.AreaPath": "Contoso\\\\Team" }.');

  registerTool(
    server,
    WORKITEM_TOOLS.create_template,
    "Create a work item template for a team, so recurring work can be raised with its fields already filled in.",
    {
      name: z.string().describe("The name of the template as shown to the team."),
      workItemTypeName: z.string().describe("The work item type the template applies to, e.g. 'Task'."),
      fields: templateFieldsSchema,
      description: z.string().optional().describe("What the template is for."),
      project: optionalProject,
      team: optionalTeamWith("The team that owns the template."),
    },
    async ({ name, workItemTypeName, fields, description, project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team, "Select the Azure DevOps project to create the template in.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const created = await workItemTrackingApi.createTemplate({ name, workItemTypeName, fields, description }, ctx.teamContext);

        return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating work item template: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.replace_template,
    "Replace a work item template. The whole template is overwritten, so pass every field it should keep — omitted fields are dropped, not merged.",
    {
      templateId: z.string().describe("The ID (GUID) of the template to replace."),
      name: z.string().describe("The name of the template."),
      workItemTypeName: z.string().describe("The work item type the template applies to, e.g. 'Task'."),
      fields: templateFieldsSchema,
      description: z.string().optional().describe("What the template is for."),
      project: optionalProject,
      team: optionalTeamWith("The team that owns the template."),
    },
    async ({ templateId, name, workItemTypeName, fields, description, project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team, "Select the Azure DevOps project the template belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const replaced = await workItemTrackingApi.replaceTemplate({ id: templateId, name, workItemTypeName, fields, description }, ctx.teamContext, templateId);

        return { content: [{ type: "text", text: JSON.stringify(replaced, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error replacing work item template: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.delete_template,
    "Delete a team's work item template. Work items already created from it are untouched.",
    {
      templateId: z.string().describe("The ID (GUID) of the template to delete."),
      project: optionalProject,
      team: optionalTeamWith("The team that owns the template."),
    },
    async ({ templateId, project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team, "Select the Azure DevOps project the template belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        await workItemTrackingApi.deleteTemplate(ctx.teamContext, templateId);

        return { content: [{ type: "text", text: `Template '${templateId}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting work item template: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_queries,
    "List the saved query tree of a project: the 'My Queries' and 'Shared Queries' folders and what is inside them. Use it to find a query's ID or path before running it with wit_get_query_results_by_id.",
    {
      project: optionalProject,
      depth: z.coerce.number().min(0).max(2).optional().describe("How many levels of the folder tree to return. 0 returns only the root folders."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("How much detail to include for each query, e.g. 'wiql' to get the query text."),
      includeDeleted: z.boolean().optional().describe("Also return queries sitting in the query recycle bin."),
    },
    async ({ project, depth, expand, includeDeleted }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project whose queries to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const queries = await workItemTrackingApi.getQueries(ctx.project, safeEnumConvert(QueryExpand, expand), depth, includeDeleted);

        return { content: [{ type: "text", text: JSON.stringify(queries, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing queries: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.create_query,
    "Create a saved query or a query folder. Queries are saved under a parent folder path such as 'Shared Queries' or 'My Queries'.",
    {
      parentPath: z.string().describe("Folder the item is created in, e.g. 'Shared Queries' or 'Shared Queries/Release'."),
      name: z.string().describe("Name of the query or folder."),
      wiql: z.string().optional().describe("The WIQL text of the query. Required for a query, omitted for a folder."),
      isFolder: z.boolean().default(false).describe("Create a folder instead of a query."),
      project: optionalProject,
      validateWiqlOnly: z.boolean().optional().describe("Only validate the WIQL without saving anything."),
    },
    async ({ parentPath, name, wiql, isFolder, project, validateWiqlOnly }) => {
      try {
        if (!isFolder && !wiql) {
          return { content: [{ type: "text", text: "A query needs 'wiql'; pass isFolder: true to create a folder instead." }], isError: true };
        }

        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project to create the query in.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const created = await workItemTrackingApi.createQuery({ name, wiql, isFolder }, ctx.project, parentPath, validateWiqlOnly);

        return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating query: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.update_query,
    "Update a saved query: rename it, change its WIQL, or move it by setting a new parent path. Only the properties you pass are changed.",
    {
      query: z.string().describe("ID (GUID) or path of the query to update, e.g. 'Shared Queries/Active bugs'."),
      name: z.string().optional().describe("New name for the query."),
      wiql: z.string().optional().describe("New WIQL text for the query."),
      project: optionalProject,
      undeleteDescendants: z.boolean().optional().describe("When restoring a folder from the query recycle bin, also restore what was inside it."),
    },
    async ({ query, name, wiql, project, undeleteDescendants }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the query belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const update: { name?: string; wiql?: string } = {};
        if (name !== undefined) update.name = name;
        if (wiql !== undefined) update.wiql = wiql;

        const updated = await workItemTrackingApi.updateQuery(update, ctx.project, query, undeleteDescendants);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating query: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.delete_query,
    "Delete a saved query or query folder. Deleting a folder deletes the queries inside it; both go to the query recycle bin and can be restored with wit_update_query.",
    {
      query: z.string().describe("ID (GUID) or path of the query or folder to delete, e.g. 'Shared Queries/Old'."),
      project: optionalProject,
    },
    async ({ query, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the query belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        await workItemTrackingApi.deleteQuery(ctx.project, query);

        return { content: [{ type: "text", text: `Query '${query}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting query: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_work_item_types,
    "List the work item types available in a project, as the project's process actually defines them. Use it before creating a work item to learn which types exist, including any custom ones.",
    {
      project: optionalProject,
      namesOnly: z.boolean().default(true).describe("Return just the type names. The full definitions include every field and state of every type and are large, so ask for them only when needed."),
    },
    async ({ project, namesOnly }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project whose work item types to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const types = await workItemTrackingApi.getWorkItemTypes(ctx.project);
        const result = namesOnly ? (types ?? []).map((type) => ({ name: type.name, referenceName: type.referenceName, description: type.description })) : types;

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing work item types: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_type_categories,
    "List the work item type categories of a project: which types play the role of requirement, bug, task, epic and so on. This is how to find out what a project calls its backlog items when the process is customized.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project whose type categories to list.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const categories = await workItemTrackingApi.getWorkItemTypeCategories(ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing work item type categories: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_type_category,
    "Get one work item type category, e.g. 'Microsoft.RequirementCategory', with the types it contains and the default type used when creating work items in it.",
    {
      category: z.string().describe("Reference name of the category, e.g. 'Microsoft.BugCategory' or 'Microsoft.RequirementCategory'."),
      project: optionalProject,
    },
    async ({ category, project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project, "Select the Azure DevOps project the category belongs to.");
        if ("response" in ctx) return ctx.response;

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const found = await workItemTrackingApi.getWorkItemTypeCategory(ctx.project, category);

        if (!found) {
          return { content: [{ type: "text", text: `Work item type category '${category}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item type category: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_relation_types,
    "List the work item link types the organization supports, with their reference names. The friendly names accepted by wit_work_items_link ('parent', 'related', ...) cover the standard types only; use this to discover custom ones, then pass the reference name directly.",
    {},
    async () => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const relationTypes = await workItemTrackingApi.getRelationTypes();

        return { content: [{ type: "text", text: JSON.stringify(relationTypes, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing work item relation types: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.list_fields,
    "List work item fields with their reference names and types. Pass a project to get the fields available there, or omit it for every field in the organization. Use it to find the exact reference name of a field before querying or updating it.",
    {
      project: z.string().optional().describe("Limit the list to fields available in this project. Omit to list every field in the organization."),
      expand: z
        .enum(getEnumKeys(GetFieldsExpand) as [string, ...string[]])
        .optional()
        .describe("'ExtensionFields' also returns fields added by extensions; 'IncludeDeleted' also returns deleted fields."),
      nameFilter: z
        .string()
        .optional()
        .describe("Case-insensitive substring matched against the field name and reference name. Organizations have hundreds of fields, so filtering is usually what you want."),
    },
    async ({ project, expand, nameFilter }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const fields = await workItemTrackingApi.getFields(project, safeEnumConvert(GetFieldsExpand, expand));

        const filter = nameFilter?.toLowerCase();
        const result = filter ? (fields ?? []).filter((field) => field.name?.toLowerCase().includes(filter) || field.referenceName?.toLowerCase().includes(filter)) : fields;

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing work item fields: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORKITEM_TOOLS.get_field,
    "Get a single work item field by name or reference name, e.g. 'System.Title' or 'Story Points', with its type, whether it is read-only and where it is picked from.",
    {
      field: z.string().describe("Name or reference name of the field, e.g. 'System.Tags'."),
      project: z.string().optional().describe("Resolve the field in this project's context. Omit for the organization-wide definition."),
    },
    async ({ field, project }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const found = await workItemTrackingApi.getField(field, project);

        if (!found) {
          return { content: [{ type: "text", text: `Field '${field}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item field: ${errorMessage}` }], isError: true };
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
