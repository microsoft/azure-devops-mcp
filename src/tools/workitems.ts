// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { WorkItemExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { batchApiVersion, userAgent } from "@utils";

const WORKITEM_TOOLS = {
  my_work_items: "ado_my_work_items",
  list_backlogs: "ado_list_backlogs",
  list_backlog_work_items: "ado_list_backlog_work_items",
  get_work_item: "ado_get_work_item",
  get_work_items_batch_by_ids: "ado_get_work_items_batch_by_ids",
  update_work_item: "ado_update_work_item",
  create_work_item: "ado_create_work_item",
  list_work_item_comments: "ado_list_work_item_comments",
  get_work_items_for_iteration: "ado_get_work_items_for_iteration",
  add_work_item_comment: "ado_add_work_item_comment",
  add_child_work_item: "ado_add_child_work_item",
<<<<<<< Updated upstream
=======
  update_work_item_assign: "ado_update_work_item_assign",
>>>>>>> Stashed changes
  link_work_item_to_pull_request: "ado_link_work_item_to_pull_request",
  get_work_item_type: "ado_get_work_item_type",
  get_query: "ado_get_query",
  get_query_results_by_id: "ado_get_query_results_by_id",
  update_work_items_batch: "ado_update_work_items_batch",
  close_and_link_workitem_duplicates: "ado_close_and_link_workitem_duplicates"
};

function configureWorkItemTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {

  server.tool(
    WORKITEM_TOOLS.list_backlogs,
    "Revieve a list of backlogs for a given project and team.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team.")
    },
    async ({ project, team }) => {
      const connection = await connectionProvider();
      const workApi = await connection.getWorkApi();
      const teamContext = { project, team };
      const backlogs = await workApi.getBacklogs(teamContext);

      return {
        content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.list_backlog_work_items,
    "Retrieve a list of backlogs of for a given project, team, and backlog category",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
      backlogId: z.string().describe("The ID of the backlog category to retrieve work items from.")
    },
    async ({ project, team, backlogId }) => {
      const connection = await connectionProvider();
      const workApi = await connection.getWorkApi();
      const teamContext = { project, team };

      const workItems = await workApi.getBacklogLevelWorkItems(
        teamContext,
        backlogId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.my_work_items,
    "Retrieve a list of work items relevent to the authenticated user.",
    {
      projectId: z.string(),
      type: z.enum(["assignedtome", "myactivity"]).default("assignedtome").describe("The type of work items to retrieve. Defaults to 'assignedtome'."),
      top: z.number().default(50).describe("The maximum number of work items to return. Defaults to 50."),
      includeCompleted: z.boolean().default(false).describe("Whether to include completed work items. Defaults to false."),
    },
    async ({ projectId, type, top, includeCompleted }) => {
      const connection = await connectionProvider();
      const workApi = await connection.getWorkApi();
      const workItemApi = await connection.getWorkItemTrackingApi();

      const query= await workApi.getPredefinedQueryResults(
        projectId,
        type,
        top,
        includeCompleted
      );
      const workItemIds = query.results?.map(item => item.id).filter(id => id !== undefined) || [];
      const workItems = await workItemApi.getWorkItemsBatch(
        { ids: workItemIds },
        projectId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.get_work_items_batch_by_ids,
    "Retrieve list of work items by IDs in batch.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      ids: z.array(z.number()).describe("The IDs of the work items to retrieve.")
    },
    async ({ project, ids }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const workitems = await workItemApi.getWorkItemsBatch({ ids }, project);

      return {
        content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.get_work_item,
    "Get a single work item by ID.",
    {
      id: z.number().describe("The ID of the work item to retrieve."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      fields: z.array(z.string()).optional().describe("Optional list of fields to include in the response. If not provided, all fields will be returned."),
      asOf: z.date().optional().describe("Optional date to retrieve the work item as of a specific time. If not provided, the current state will be returned."),
      expand: z
        .enum(["all", "fields", "links", "none", "relations"])
        .describe("Optional expand parameter to include additional details in the response.")
        .optional().describe("Expand options include 'all', 'fields', 'links', 'none', and 'relations'. Defaults to 'none'."),
    },
    async ({ id, project, fields, asOf, expand }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const workitems = await workItemApi.getWorkItem(
        id,
        fields,
        asOf,
        expand as unknown as WorkItemExpand,
        project
      );
      return {
        content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.list_work_item_comments,
    "Retrieve list of comments for a work item by ID.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemId: z.number().describe("The ID of the work item to retrieve comments for."),
      top: z.number().default(50).describe("Optional number of comments to retrieve. Defaults to all comments.")
    },
    async ({ project, workItemId, top }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const comments = await workItemApi.getComments(project, workItemId, top);

      return {
        content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.add_work_item_comment,
    "Add comment to a work item by ID.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemId: z.number().describe("The ID of the work item to add a comment to."),
      comment: z.string().describe("The text of the comment to add to the work item.")
    },
    async ({ project, workItemId, comment }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const commentCreate = { text: comment };
      const commentResponse = await workItemApi.addComment(
        commentCreate,
        project,
        workItemId
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(commentResponse, null, 2) },
        ],
      };
    }
  );


  server.tool(
      WORKITEM_TOOLS.add_child_work_item,
      "Create a child work item from a parent by ID.",
      {
        parentId: z.number().describe("The ID of the parent work item to create a child work item under."),
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        workItemType: z.string().describe("The type of the child work item to create."),
        title: z.string().describe("The title of the child work item."),
        description: z.string().describe("The description of the child work item."),
        areaPath: z.string().optional().describe("Optional area path for the child work item."),
        iterationPath: z.string().optional().describe("Optional iteration path for the child work item."),
      },
      async ({
        parentId,
        project,
        workItemType,
        title,
        description,
        areaPath,
        iterationPath,
      }) => {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        const document = [
          {
            op: "add",
            path: "/fields/System.Title",
            value: title
          },
          {
            op: "add",
            path: "/fields/System.Description",
            value: description
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

        if (areaPath && areaPath.trim().length > 0) {
          document.push({
            op: "add",
            path: "/fields/System.AreaPath",
            value: areaPath,
          });
        }

        if (iterationPath && iterationPath.trim().length > 0) {
          document.push({
            op: "add",
            path: "/fields/System.IterationPath",
            value: iterationPath,
          });
        }

        const childWorkItem = await workItemApi.createWorkItem(
          null,
          document,
          project,
          workItemType
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(childWorkItem, null, 2) },
          ],
        };
      }
    );

  server.tool(
    WORKITEM_TOOLS.link_work_item_to_pull_request,
    "Link a single work item to an existing pull request.",
    {
      project: z.string().describe,
      repositoryId: z.string().describe("The ID of the repository containing the pull request. Do not use the repository name here, use the ID instead."),
      pullRequestId: z.number().describe("The ID of the pull request to link to."),
      workItemId: z.number().describe("The ID of the work item to link to the pull request."),
    },
    async ({ project, repositoryId, pullRequestId, workItemId }) => {
      const connection = await connectionProvider();
      const workItemTrackingApi = await connection.getWorkItemTrackingApi();
      try {
        // Create artifact link relation using vstfs format
        // Format: vstfs:///Git/PullRequestId/{project}/{repositoryId}/{pullRequestId}
        const artifactPathValue = `${project}/${repositoryId}/${pullRequestId}`;
        const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(
          artifactPathValue
        )}`;

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
        await workItemTrackingApi.updateWorkItem(
          {},
          patchDocument,
          workItemId,
          project
        );

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
        console.error(
          `Error linking work item ${workItemId} to PR ${pullRequestId}:`,
          error
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  workItemId,
                  pullRequestId,
                  success: false,
                },
                null,
                2
              ),
            },
          ],
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
      const connection = await connectionProvider();
      const workApi = await connection.getWorkApi();

      //get the work items for the current iteration
      const workItems = await workApi.getIterationWorkItems(
        { project, team },
        iterationId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.update_work_item,
    "Update a work item by ID with specified fields.",
    {
      id: z.number().describe("The ID of the work item to update."),
      updates: z.array(
        z.object({
          op: z.enum(["add", "replace", "remove"]).default("add").describe("The operation to perform on the field."),
          path: z.string().describe("The path of the field to update, e.g., '/fields/System.Title'."),
          value: z.string().describe("The new value for the field. This is required for 'add' and 'replace' operations, and should be omitted for 'remove' operations."),
        })
      ).describe("An array of field updates to apply to the work item."),
    },
    async ({ id, updates }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const updatedWorkItem = await workItemApi.updateWorkItem(
        null,
        updates,
        id
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(updatedWorkItem, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "ado_get_work_item_type",
    "Get a specific work item type.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemType: z.string().describe("The name of the work item type to retrieve."),
    },
    async ({ project, workItemType }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();

      const workItemTypeInfo = await workItemApi.getWorkItemType(
        project,
        workItemType
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(workItemTypeInfo, null, 2) },
        ],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.create_work_item,
    "Create a new work item in a specified project and work item type.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      workItemType: z.string().describe("The type of work item to create, e.g., 'Task', 'Bug', etc."),
      fields: z.record(z.string(), z.string()).describe("A record of field names and values to set on the new work item. Each key is a field name, and each value is the corresponding value to set for that field."),
    },
    async ({ project, workItemType, fields }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();

      const document = Object.entries(fields).map(([key, value]) => ({
        op: "add",
        path: `/fields/${key}`,
        value,
      }));

      const newWorkItem = await workItemApi.createWorkItem(
        null,
        document,
        project,
        workItemType
      );

      return {
        content: [{ type: "text", text: JSON.stringify(newWorkItem, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.get_query,
    "Get a query by its ID or path.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      query: z.string().describe("The ID or path of the query to retrieve."),
      expand: z.enum(["all", "clauses", "minimal", "none", "wiql"]).optional().describe("Optional expand parameter to include additional details in the response. Defaults to 'none'."),
      depth: z.number().default(0).describe("Optional depth parameter to specify how deep to expand the query. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Whether to include deleted items in the query results. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Whether to use ISO date format in the response. Defaults to false."),
    },
    async ({
      project,
      query,
      expand,
      depth,
      includeDeleted,
      useIsoDateFormat,
    }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();

      const queryDetails = await workItemApi.getQuery(
        project,
        query,
        expand as unknown as QueryExpand,
        depth,
        includeDeleted,
        useIsoDateFormat
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(queryDetails, null, 2) },
        ],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.get_query_results_by_id,
    "Retrieve the results of a work item query given the query ID.",
    {
      id: z.string().describe("The ID of the query to retrieve results for."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. If not provided, the default project will be used."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. If not provided, the default team will be used."),
      timePrecision: z.boolean().optional().describe("Whether to include time precision in the results. Defaults to false."),
      top: z.number().default(50).describe("The maximum number of results to return. Defaults to 50."),
    },
    async ({ id, project, team, timePrecision, top }) => {
      const connection = await connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const teamContext = { project, team };
      const queryResult = await workItemApi.queryById(
        id,
        teamContext,
        timePrecision,
        top
      );

      return {
        content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }],
      };
    }
  );

  server.tool(
    WORKITEM_TOOLS.update_work_items_batch,
    "Update work items in batch",
    {
      updates: z.array(
        z.object({
          op: z.enum(["add", "replace", "remove"]).default("add").describe("The operation to perform on the field."),
          id: z.number().describe("The ID of the work item to update."),
          path: z.string().describe("The path of the field to update, e.g., '/fields/System.Title'."),
          value: z.string().describe("The new value for the field. This is required for 'add' and 'replace' operations, and should be omitted for 'remove' operations."),
        })
      ).describe("An array of updates to apply to work items. Each update should include the operation (op), work item ID (id), field path (path), and new value (value)."),
    },
    async ({ updates }) => {
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
        body: updates.filter((update) => update.id === id).map(({ op, path, value }) => ({
            op: op,
            path: path,
            value: value,
          })),
      }));

      const response = await fetch(
        `${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            "Content-Type": "application/json",
            "User-Agent": `${userAgent}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update work items in batch: ${response.statusText}`
        );
      }

      const result = await response.json();

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool (
    WORKITEM_TOOLS.close_and_link_workitem_duplicates,
    "Close duplicate work items by id.",
    {
      id: z.number().describe("The ID of the work item to close and link duplicates to."),
      duplicateIds: z.array(z.number()).describe("An array of IDs of the duplicate work items to close and link to the specified work item."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      state: z.string().default("Removed").describe("The state to set for the duplicate work items. Defaults to 'Removed'."),
    },
    async ({ id, duplicateIds, project, state }) => {
      const connection = await connectionProvider();

      const body = duplicateIds.map((duplicateId) => ({
        method: "PATCH",
        uri: `/_apis/wit/workitems/${duplicateId}?api-version=${batchApiVersion}`,
        headers: {
          "Content-Type": "application/json-patch+json",
        },
        body: [
          {
            op: "add",
            path: "/fields/System.State",
            value: `${state}`,
          },
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "System.LinkTypes.Duplicate-Reverse",
              url: `${connection.serverUrl}/${project}/_apis/wit/workItems/${id}`,
            },
          },
        ],
      }));

      const accessToken = await tokenProvider();

      const response = await fetch(
        `${connection.serverUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            "Content-Type": "application/json",
            "User-Agent": `${userAgent}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update work items in batch: ${response.statusText}`
        );
      }

      const result = await response.json();

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}

export { WORKITEM_TOOLS, configureWorkItemTools };
