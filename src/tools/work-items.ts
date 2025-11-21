// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { WorkItemExpand, WorkItemRelation } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { batchApiVersion, markdownCommentsApiVersion, getEnumKeys, safeEnumConvert, encodeFormattedValue } from "../utils.js";

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
  add_child_work_items: "wit_add_child_work_items",
  link_work_item_to_pull_request: "wit_link_work_item_to_pull_request",
  get_work_item_type: "wit_get_work_item_type",
  get_query: "wit_get_query",
  get_query_results_by_id: "wit_get_query_results_by_id",
  update_work_items_batch: "wit_update_work_items_batch",
  work_items_link: "wit_work_items_link",
  work_item_unlink: "wit_work_item_unlink",
  add_artifact_link: "wit_add_artifact_link",
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

function configureWorkItemTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    WORKITEM_TOOLS.list_backlogs,
    "Receive a list of backlogs for a given project and team.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();
        const teamContext = { project, team };
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

  server.tool(
    WORKITEM_TOOLS.list_backlog_work_items,
    "Retrieve a list of backlogs of for a given project, team, and backlog category",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
      backlogId: z.string().describe("The ID of the backlog category to retrieve work items from."),
    },
    async ({ project, team, backlogId }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();
        const teamContext = { project, team };

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

  server.tool(
    WORKITEM_TOOLS.my_work_items,
    "Retrieve a list of work items relevent to the authenticated user.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      type: z.enum(["assignedtome", "myactivity"]).default("assignedtome").describe("The type of work items to retrieve. Defaults to 'assignedtome'."),
      top: z.number().default(50).describe("The maximum number of work items to return. Defaults to 50."),
      includeCompleted: z.boolean().default(false).describe("Whether to include completed work items. Defaults to false."),
    },
    async ({ project, type, top, includeCompleted }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();

        const workItems = await workApi.getPredefinedQueryResults(project, type, top, includeCompleted);

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

  server.tool(
    WORKITEM_TOOLS.get_work_items_batch_by_ids,
    "Retrieve list of work items by IDs in batch.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      ids: z.array(z.number()).describe("The IDs of the work items to retrieve."),
      fields: z.array(z.string()).optional().describe("Optional list of fields to include in the response. If not provided, a hardcoded default set of fields will be used."),
    },
    async ({ project, ids, fields }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];

        // If no fields are provided, use the default set of fields
        const fieldsToUse = !fields || fields.length === 0 ? defaultFields : fields;

        const workitems = await workItemApi.getWorkItemsBatch({ ids, fields: fieldsToUse }, project);

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

  server.tool(
    WORKITEM_TOOLS.get_work_item,
    "Get a single work item by ID.",
    {
      id: z.number().describe("The ID of the work item to retrieve."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      fields: z.array(z.string()).optional().describe("Optional list of fields to include in the response. If not provided, all fields will be returned."),
      asOf: z.coerce.date().optional().describe("Optional date string to retrieve the work item as of a specific time. If not provided, the current state will be returned."),
      expand: z
        .enum(["all", "fields", "links", "none", "relations"])
        .describe("Optional expand parameter to include additional details in the response.")
        .optional()
        .describe("Expand options include 'all', 'fields', 'links', 'none', and 'relations'. Relations can be used to get child workitems. Defaults to 'none'."),
    },
    async ({ id, project, fields, asOf, expand }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItem = await workItemApi.getWorkItem(id, fields, asOf, expand as unknown as WorkItemExpand, project);

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

  server.tool(
    WORKITEM_TOOLS.list_work_item_comments,
    "Retrieve list of comments for a work item by ID.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemId: z.number().describe("The ID of the work item to retrieve comments for."),
      top: z.number().default(50).describe("Optional number of comments to retrieve. Defaults to all comments."),
    },
    async ({ project, workItemId, top }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const comments = await workItemApi.getComments(project, workItemId, top);

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

  server.tool(
    WORKITEM_TOOLS.add_work_item_comment,
    "Add comment to a work item by ID.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemId: z.number().describe("The ID of the work item to add a comment to."),
      comment: z.string().describe("The text of the comment to add to the work item."),
      format: z.enum(["markdown", "html"]).optional().default("html"),
    },
    async ({ project, workItemId, comment, format }) => {
      try {
        const connection = await connectionProvider();
        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        const body = {
          text: comment,
        };

        const formatParameter = format === "markdown" ? 0 : 1;
        const response = await fetch(`${orgUrl}/${project}/_apis/wit/workItems/${workItemId}/comments?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify(body),
        });

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

  server.tool(
    WORKITEM_TOOLS.list_work_item_revisions,
    "Retrieve list of revisions for a work item by ID.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemId: z.number().describe("The ID of the work item to retrieve revisions for."),
      top: z.number().default(50).describe("Optional number of revisions to retrieve. If not provided, all revisions will be returned."),
      skip: z.number().optional().describe("Optional number of revisions to skip for pagination. Defaults to 0."),
      expand: z
        .enum(getEnumKeys(WorkItemExpand) as [string, ...string[]])
        .default("None")
        .optional()
        .describe("Optional expand parameter to include additional details. Defaults to 'None'."),
    },
    async ({ project, workItemId, top, skip, expand }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const revisions = await workItemApi.getRevisions(workItemId, top, skip, safeEnumConvert(WorkItemExpand, expand), project);

        // Dynamically clean up identity objects in revision fields
        // Identity objects typically have properties like displayName, url, _links, id, uniqueName, imageUrl, descriptor
        if (revisions && Array.isArray(revisions)) {
          revisions.forEach((revision) => {
            if (revision.fields) {
              Object.keys(revision.fields).forEach((fieldName) => {
                const fieldValue = revision.fields ? revision.fields[fieldName] : undefined;
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

  server.tool(
    WORKITEM_TOOLS.add_child_work_items,
    "Create one or many child work items from a parent by work item type and parent id.",
    {
      parentId: z.number().describe("The ID of the parent work item to create a child work item under."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemType: z.string().describe("The type of the child work item to create."),
      items: z.array(
        z.object({
          title: z.string().describe("The title of the child work item."),
          description: z.string().describe("The description of the child work item."),
          format: z.enum(["Markdown", "Html"]).default("Html").describe("Format for the description on the child work item, e.g., 'Markdown', 'Html'. Defaults to 'Html'."),
          areaPath: z.string().optional().describe("Optional area path for the child work item."),
          iterationPath: z.string().optional().describe("Optional iteration path for the child work item."),
        })
      ),
    },
    async ({ parentId, project, workItemType, items }) => {
      try {
        const connection = await connectionProvider();
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
                url: `${connection.serverUrl}/${project}/_apis/wit/workItems/${parentId}`,
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
            uri: `/${project}/_apis/wit/workitems/$${workItemType}?api-version=${batchApiVersion}`,
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

  server.tool(
    WORKITEM_TOOLS.link_work_item_to_pull_request,
    "Link a single work item to an existing pull request.",
    {
      projectId: z.string().describe("The project ID of the Azure DevOps project (note: project name is not valid)."),
      repositoryId: z.string().describe("The ID of the repository containing the pull request. Do not use the repository name here, use the ID instead."),
      pullRequestId: z.number().describe("The ID of the pull request to link to."),
      workItemId: z.number().describe("The ID of the work item to link to the pull request."),
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

  server.tool(
    WORKITEM_TOOLS.get_work_items_for_iteration,
    "Retrieve a list of work items for a specified iteration.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. If not provided, the default team will be used."),
      iterationId: z.string().describe("The ID of the iteration to retrieve work items for."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();

        //get the work items for the current iteration
        const workItems = await workApi.getIterationWorkItems({ project, team }, iterationId);

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

  server.tool(
    WORKITEM_TOOLS.update_work_item,
    "Update a work item by ID with specified fields.",
    {
      id: z.number().describe("The ID of the work item to update."),
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

  server.tool(
    WORKITEM_TOOLS.get_work_item_type,
    "Get a specific work item type.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemType: z.string().describe("The name of the work item type to retrieve."),
    },
    async ({ project, workItemType }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        const workItemTypeInfo = await workItemApi.getWorkItemType(project, workItemType);

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

  server.tool(
    WORKITEM_TOOLS.create_work_item,
    "Create a new work item in a specified project and work item type.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemType: z.string().describe("The type of work item to create, e.g., 'Task', 'Bug', etc."),
      fields: z
        .array(
          z.object({
            name: z.string().describe("The name of the field, e.g., 'System.Title'."),
            value: z.string().describe("The value of the field."),
            format: z.enum(["Html", "Markdown"]).optional().describe("the format of the field value, e.g., 'Html', 'Markdown'. Optional, defaults to 'Html'."),
          })
        )
        .describe("A record of field names and values to set on the new work item. Each fild is the field name and each value is the corresponding value to set for that field."),
    },
    async ({ project, workItemType, fields }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        const document = fields.map(({ name, value, format }) => ({
          op: "add",
          path: `/fields/${name}`,
          value: encodeFormattedValue(value, format),
        }));

        // Check if any field has format === "Markdown" and add the multilineFieldsFormat operation
        // this should only happen for large text fields, but since we dont't know by field name, lets assume if the users
        // passes a value longer than 50 characters, then we can set the format to Markdown
        fields.forEach(({ name, value, format }) => {
          if (value.length > 50 && format === "Markdown") {
            document.push({
              op: "add",
              path: `/multilineFieldsFormat/${name}`,
              value: "Markdown",
            });
          }
        });

        const newWorkItem = await workItemApi.createWorkItem(null, document, project, workItemType);

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

  server.tool(
    WORKITEM_TOOLS.get_query,
    "Get a query by its ID or path.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      query: z.string().describe("The ID or path of the query to retrieve."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("Optional expand parameter to include additional details in the response. Defaults to 'None'."),
      depth: z.number().default(0).describe("Optional depth parameter to specify how deep to expand the query. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Whether to include deleted items in the query results. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Whether to use ISO date format in the response. Defaults to false."),
    },
    async ({ project, query, expand, depth, includeDeleted, useIsoDateFormat }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        const queryDetails = await workItemApi.getQuery(project, query, safeEnumConvert(QueryExpand, expand), depth, includeDeleted, useIsoDateFormat);

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

  server.tool(
    WORKITEM_TOOLS.get_query_results_by_id,
    "Retrieve the results of a work item query given the query ID. Supports full or IDs-only response types.",
    {
      id: z.string().describe("The ID of the query to retrieve results for."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. If not provided, the default project will be used."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. If not provided, the default team will be used."),
      timePrecision: z.boolean().optional().describe("Whether to include time precision in the results. Defaults to false."),
      top: z.number().default(50).describe("The maximum number of results to return. Defaults to 50."),
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

  server.tool(
    WORKITEM_TOOLS.update_work_items_batch,
    "Update work items in batch",
    {
      updates: z
        .array(
          z.object({
            op: z.enum(["Add", "Replace", "Remove"]).default("Add").describe("The operation to perform on the field."),
            id: z.number().describe("The ID of the work item to update."),
            path: z.string().describe("The path of the field to update, e.g., '/fields/System.Title'."),
            value: z.string().describe("The new value for the field. This is required for 'add' and 'replace' operations, and should be omitted for 'remove' operations."),
            format: z.enum(["Html", "Markdown"]).optional().describe("The format of the field value. Only to be used for large text fields. e.g., 'Html', 'Markdown'. Optional, defaults to 'Html'."),
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
            if (format === "Markdown" && value && value.length > 50) {
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

  server.tool(
    WORKITEM_TOOLS.work_items_link,
    "Link work items together in batch.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      updates: z
        .array(
          z.object({
            id: z.number().describe("The ID of the work item to update."),
            linkToId: z.number().describe("The ID of the work item to link to."),
            type: z
              .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by"])
              .default("related")
              .describe(
                "Type of link to create between the work items. Options include 'parent', 'child', 'duplicate', 'duplicate of', 'related', 'successor', 'predecessor', 'tested by', 'tests', 'affects', and 'affected by'. Defaults to 'related'."
              ),
            comment: z.string().optional().describe("Optional comment to include with the link. This can be used to provide additional context for the link being created."),
          })
        )
        .describe(""),
    },
    async ({ project, updates }) => {
      try {
        const connection = await connectionProvider();
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
                url: `${orgUrl}/${project}/_apis/wit/workItems/${linkToId}`,
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

  server.tool(
    WORKITEM_TOOLS.work_item_unlink,
    "Remove one or many links from a single work item",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      id: z.number().describe("The ID of the work item to remove the links from."),
      type: z
        .enum(["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by", "artifact"])
        .default("related")
        .describe(
          "Type of link to remove. Options include 'parent', 'child', 'duplicate', 'duplicate of', 'related', 'successor', 'predecessor', 'tested by', 'tests', 'affects', 'affected by', and 'artifact'. Defaults to 'related'."
        ),
      url: z.string().optional().describe("Optional URL to match for the link to remove. If not provided, all links of the specified type will be removed."),
    },
    async ({ project, id, type, url }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItem = await workItemApi.getWorkItem(id, undefined, undefined, WorkItemExpand.Relations, project);
        const relations: WorkItemRelation[] = workItem.relations ?? [];
        const linkType = getLinkTypeFromName(type);

        let relationIndexes: number[] = [];

        if (url && url.trim().length > 0) {
          // If url is provided, find relations matching both rel type and url
          relationIndexes = relations.map((relation, idx) => (relation.url === url ? idx : -1)).filter((idx) => idx !== -1);
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

        const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id, project);

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

  server.tool(
    WORKITEM_TOOLS.add_artifact_link,
    "Add artifact links (repository, branch, commit, builds) to work items. You can either provide the full vstfs URI or the individual components to build it automatically.",
    {
      workItemId: z.number().describe("The ID of the work item to add the artifact link to."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),

      // Option 1: Provide full URI directly
      artifactUri: z.string().optional().describe("The complete VSTFS URI of the artifact to link. If provided, individual component parameters are ignored."),

      // Option 2: Provide individual components to build URI automatically based on linkType
      projectId: z.string().optional().describe("The project ID (GUID) containing the artifact. Required for Git artifacts when artifactUri is not provided."),
      repositoryId: z.string().optional().describe("The repository ID (GUID) containing the artifact. Required for Git artifacts when artifactUri is not provided."),
      branchName: z.string().optional().describe("The branch name (e.g., 'main'). Required when linkType is 'Branch'."),
      commitId: z.string().optional().describe("The commit SHA hash. Required when linkType is 'Fixed in Commit'."),
      pullRequestId: z.number().optional().describe("The pull request ID. Required when linkType is 'Pull Request'."),
      buildId: z.number().optional().describe("The build ID. Required when linkType is 'Build', 'Found in build', or 'Integrated in build'."),

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
        const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, project);

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
}

export { WORKITEM_TOOLS, configureWorkItemTools };
