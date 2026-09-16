// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeStructureGroup, TreeNodeStructureType, WorkItemClassificationNode } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import {
  CreatePlan,
  UpdatePlan,
  PlanType,
  TeamFieldValuesPatch,
  TeamSettingsDaysOffPatch,
  BoardColumn,
  BoardRow,
  BoardCardSettings,
  BoardCardRuleSettings,
  BoardChart,
  ReorderOperation,
  UpdateTaskboardColumn,
  UpdateTaskboardWorkItemColumn,
  TeamMemberCapacityIdentityRef,
  TeamAutomationRulesSettingsRequestModel,
} from "azure-devops-node-api/interfaces/WorkInterfaces.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";
import { optionalProject, optionalTeam, requiredProject, requiredTeam } from "../shared/common-params.js";

// Maps the TreeStructureGroup enum to the string segment used in the
// classification-nodes REST route (.../wit/classificationNodes/{areas|iterations}/...).
const STRUCTURE_GROUP_SEGMENT: Record<TreeStructureGroup, string> = {
  [TreeStructureGroup.Areas]: "areas",
  [TreeStructureGroup.Iterations]: "iterations",
};

// Builds a classification-node REST URL using the connection's resolver.
//
// We deliberately bypass workItemTrackingApi.{createOrUpdate,update,delete}ClassificationNode
// for AREA paths. The SDK's VsoClient.replaceRouteValues treats a route value of 0 as missing
// (`if (routeValues[paramName])`), and TreeStructureGroup.Areas === 0, so the `{structureGroup}`
// URL segment is silently dropped and the request lands on an endpoint that rejects the verb
// ("The requested resource does not support http method 'POST'"). Constructing the URL ourselves
// with the documented string structure group avoids the bug. TreeStructureGroup.Iterations === 1
// is truthy and unaffected, so the iteration tools keep using the SDK directly.
function classificationNodeUrl(connection: WebApi, project: string, structureGroup: TreeStructureGroup, path?: string, query?: Record<string, string | number>): string {
  const segments = [encodeURIComponent(project), "_apis", "wit", "classificationNodes", STRUCTURE_GROUP_SEGMENT[structureGroup]];
  for (const part of (path ?? "").split("/")) {
    if (part) {
      segments.push(encodeURIComponent(part));
    }
  }
  let relativeUrl = `/${segments.join("/")}?api-version=7.1`;
  for (const [key, value] of Object.entries(query ?? {})) {
    relativeUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
  }
  return connection.vsoClient.resolveUrl(relativeUrl);
}

const WORK_TOOLS = {
  list_team_iterations: "work_list_team_iterations",
  list_iterations: "work_list_iterations",
  create_iterations: "work_create_iterations",
  assign_iterations: "work_assign_iterations",
  get_team_capacity: "work_get_team_capacity",
  update_team_capacity: "work_update_team_capacity",
  get_iteration_capacities: "work_get_iteration_capacities",
  get_team_settings: "work_get_team_settings",
  list_plans: "work_list_plans",
  get_plan: "work_get_plan",
  create_plan: "work_create_plan",
  update_plan: "work_update_plan",
  delete_plan: "work_delete_plan",
  list_areas: "work_list_areas",
  create_area: "work_create_area",
  update_area: "work_update_area",
  delete_area: "work_delete_area",
  update_iteration: "work_update_iteration",
  delete_iteration: "work_delete_iteration",
  set_team_area_paths: "work_set_team_area_paths",
  list_boards: "work_list_boards",
  get_board_columns: "work_get_board_columns",
  get_board_rows: "work_get_board_rows",
  get_backlog_configuration: "work_get_backlog_configuration",
  get_team_days_off: "work_get_team_days_off",
  set_team_days_off: "work_set_team_days_off",
  update_board_columns: "work_update_board_columns",
  update_board_rows: "work_update_board_rows",
  get_board_card_settings: "work_get_board_card_settings",
  update_board_card_settings: "work_update_board_card_settings",
  get_board_card_rule_settings: "work_get_board_card_rule_settings",
  update_board_card_rule_settings: "work_update_board_card_rule_settings",
  list_board_charts: "work_list_board_charts",
  get_board_chart: "work_get_board_chart",
  update_board_chart: "work_update_board_chart",
  list_backlogs: "work_list_backlogs",
  get_backlog: "work_get_backlog",
  get_backlog_work_items: "work_get_backlog_work_items",
  get_iteration_work_items: "work_get_iteration_work_items",
  remove_team_iteration: "work_remove_team_iteration",
  reorder_iteration_work_items: "work_reorder_iteration_work_items",
  reorder_backlog_work_items: "work_reorder_backlog_work_items",
  get_board: "work_get_board",
  get_board_user_settings: "work_get_board_user_settings",
  get_delivery_timeline: "work_get_delivery_timeline",
  get_process_configuration: "work_get_process_configuration",
  list_predefined_queries: "work_list_predefined_queries",
  get_predefined_query_results: "work_get_predefined_query_results",
  get_taskboard_columns: "work_get_taskboard_columns",
  update_taskboard_columns: "work_update_taskboard_columns",
  get_taskboard_work_item_columns: "work_get_taskboard_work_item_columns",
  update_taskboard_work_item_column: "work_update_taskboard_work_item_column",
  update_taskboard_card_settings: "work_update_taskboard_card_settings",
  update_taskboard_card_rule_settings: "work_update_taskboard_card_rule_settings",
  get_column_suggested_values: "work_get_column_suggested_values",
  get_row_suggested_values: "work_get_row_suggested_values",
  get_board_mapping_parent_items: "work_get_board_mapping_parent_items",
  get_team_member_capacity: "work_get_team_member_capacity",
  replace_team_capacities: "work_replace_team_capacities",
  update_automation_rule: "work_update_automation_rule",
};

function configureWorkTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  registerTool(
    server,
    WORK_TOOLS.list_team_iterations,
    "Retrieve a list of iterations for a specific team in a project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      timeframe: z.enum(["current"]).optional().describe("The timeframe for which to retrieve iterations. Currently, only 'current' is supported."),
    },
    async ({ project, team, timeframe }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list team iterations for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list iterations for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const iterations = await workApi.getTeamIterations({ project: resolvedProject, team: resolvedTeam }, timeframe);

        if (!iterations) {
          return { content: [{ type: "text", text: "No iterations found" }], isError: true };
        }

        return {
          content: [
            { type: "text", text: `Project: ${resolvedProject}, Team: ${resolvedTeam}` },
            { type: "text", text: JSON.stringify(iterations, null, 2) },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching team iterations: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.create_iterations,
    "Create new iterations in a specified Azure DevOps project.",
    {
      project: requiredProject,
      iterations: z
        .array(
          z.object({
            iterationName: z.string().describe("The name of the iteration to create."),
            startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z'). Optional."),
            finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z'). Optional."),
          })
        )
        .describe("An array of iterations to create. Each iteration must have a name and can optionally have start and finish dates in ISO format."),
    },
    async ({ project, iterations }) => {
      try {
        const connection = await connectionProvider();
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const results = [];

        for (const { iterationName, startDate, finishDate } of iterations) {
          // Step 1: Create the iteration
          const iteration = await workItemTrackingApi.createOrUpdateClassificationNode(
            {
              name: iterationName,
              attributes: {
                startDate: startDate ? new Date(startDate) : undefined,
                finishDate: finishDate ? new Date(finishDate) : undefined,
              },
            },
            project,
            TreeStructureGroup.Iterations
          );

          if (iteration) {
            results.push(iteration);
          }
        }

        if (results.length === 0) {
          return { content: [{ type: "text", text: "No iterations were created" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating iterations: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_iterations,
    "List all iterations in a specified Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      depth: z.coerce.number().default(2).describe("Depth of children to fetch."),
      excludedIds: z.array(z.coerce.number().min(1)).optional().describe("An optional array of iteration IDs, and thier children, that should not be returned."),
    },
    async ({ project, depth, excludedIds: ids }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list iterations for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        let results = [];

        if (depth === undefined) {
          depth = 1;
        }

        results = await workItemTrackingApi.getClassificationNodes(resolvedProject, [], depth);

        // Handle null or undefined results
        if (!results) {
          return { content: [{ type: "text", text: "No iterations were found" }], isError: true };
        }

        // Filter out items with structureType=0 (Area nodes), only keep structureType=1 (Iteration nodes)
        let filteredResults = results.filter((node) => node.structureType === TreeNodeStructureType.Iteration);

        // If specific IDs are provided, filter them out recursively (exclude matching nodes and their children)
        if (ids && ids.length > 0) {
          const filterOutIds = (nodes: WorkItemClassificationNode[]): WorkItemClassificationNode[] => {
            return nodes
              .filter((node) => !node.id || !ids.includes(node.id))
              .map((node) => {
                if (node.children && node.children.length > 0) {
                  return {
                    ...node,
                    children: filterOutIds(node.children),
                  };
                }
                return node;
              });
          };

          filteredResults = filterOutIds(filteredResults);
        }

        if (filteredResults.length === 0) {
          return { content: [{ type: "text", text: "No iterations were found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(filteredResults, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching iterations: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.assign_iterations,
    "Assign existing iterations to a specific team in a project.",
    {
      project: requiredProject,
      team: requiredTeam,
      iterations: z
        .array(
          z.object({
            identifier: z.string().describe("The identifier of the iteration to assign."),
            path: z.string().describe("The path of the iteration to assign, e.g., 'Project/Iteration'."),
          })
        )
        .describe("An array of iterations to assign. Each iteration must have an identifier and a path."),
    },
    async ({ project, team, iterations }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();
        const teamContext = { project, team };
        const results = [];

        for (const { identifier, path } of iterations) {
          const assignment = await workApi.postTeamIteration({ path: path, id: identifier }, teamContext);

          if (assignment) {
            results.push(assignment);
          }
        }

        if (results.length === 0) {
          return { content: [{ type: "text", text: "No iterations were assigned to the team" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error assigning iterations: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_team_capacity,
    "Get the team capacity of a specific team and iteration in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or Id of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().describe("The name or Id of the Azure DevOps team. Reuse from prior context if already known."),
      iterationId: z.string().describe("The Iteration Id to get capacity for."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get team capacity for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team };

        const rawResults = await workApi.getCapacitiesWithIdentityRefAndTotals(teamContext, iterationId);

        if (!rawResults || rawResults.teamMembers?.length === 0) {
          return { content: [{ type: "text", text: "No team capacity assigned to the team" }], isError: true };
        }

        // Remove unwanted fields from teamMember and url
        const simplifiedResults = {
          ...rawResults,
          teamMembers: (rawResults.teamMembers || []).map((member) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { url, ...rest } = member;
            return {
              ...rest,
              teamMember: member.teamMember
                ? {
                    displayName: member.teamMember.displayName,
                    id: member.teamMember.id,
                    uniqueName: member.teamMember.uniqueName,
                  }
                : undefined,
            };
          }),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(simplifiedResults, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error getting team capacity: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_team_capacity,
    "Update the team capacity of a team member for a specific iteration in a project.",
    {
      project: z.string().describe("The name or Id of the Azure DevOps project."),
      team: z.string().describe("The name or Id of the Azure DevOps team."),
      teamMemberId: z.string().describe("The team member Id for the specific team member."),
      iterationId: z.string().describe("The Iteration Id to update the capacity for."),
      activities: z
        .array(
          z.object({
            name: z.string().describe("The name of the activity (e.g., 'Development')."),
            capacityPerDay: z.number().describe("The capacity per day for this activity."),
          })
        )
        .describe("Array of activities and their daily capacities for the team member."),
      daysOff: z
        .array(
          z.object({
            start: z.string().describe("Start date of the day off in ISO format."),
            end: z.string().describe("End date of the day off in ISO format."),
          })
        )
        .optional()
        .describe("Array of days off for the team member, each with a start and end date in ISO format."),
    },
    async ({ project, team, teamMemberId, iterationId, activities, daysOff }) => {
      try {
        const connection = await connectionProvider();
        const workApi = await connection.getWorkApi();
        const teamContext = { project, team };

        // Define interface for capacity patch
        interface CapacityPatch {
          activities: { name: string; capacityPerDay: number }[];
          daysOff?: { start: Date; end: Date }[];
        }

        // Prepare the capacity update object
        const capacityPatch: CapacityPatch = {
          activities: activities.map((a) => ({
            name: a.name,
            capacityPerDay: a.capacityPerDay,
          })),
          daysOff: (daysOff || []).map((d) => ({
            start: new Date(d.start),
            end: new Date(d.end),
          })),
        };

        // Update the team member's capacity
        const updatedCapacity = await workApi.updateCapacityWithIdentityRef(capacityPatch, teamContext, iterationId, teamMemberId);

        if (!updatedCapacity) {
          return { content: [{ type: "text", text: "Failed to update team member capacity" }], isError: true };
        }

        // Simplify output
        const simplifiedResult = {
          teamMember: updatedCapacity.teamMember
            ? {
                displayName: updatedCapacity.teamMember.displayName,
                id: updatedCapacity.teamMember.id,
                uniqueName: updatedCapacity.teamMember.uniqueName,
              }
            : undefined,
          activities: updatedCapacity.activities,
          daysOff: updatedCapacity.daysOff,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(simplifiedResult, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error updating team capacity: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_iteration_capacities,
    "Get an iteration's capacity for all teams in iteration and project. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or Id of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      iterationId: z.string().describe("The Iteration Id to get capacity for."),
    },
    async ({ project, iterationId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get iteration capacities for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();

        const rawResults = await workApi.getTotalIterationCapacities(resolvedProject, iterationId);

        if (!rawResults || !rawResults.teams || rawResults.teams.length === 0) {
          return { content: [{ type: "text", text: "No iteration capacity assigned to the teams" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(rawResults, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error getting iteration capacities: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_team_settings,
    "Get team settings including default iteration, backlog iteration, and default area path for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get team settings for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to get settings for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };

        const teamSettings = await workApi.getTeamSettings(teamContext);

        if (!teamSettings) {
          return { content: [{ type: "text", text: "No team settings found" }], isError: true };
        }

        const teamFieldValues = await workApi.getTeamFieldValues(teamContext);

        const result = {
          backlogIteration: teamSettings.backlogIteration,
          defaultIteration: teamSettings.defaultIteration,
          defaultIterationMacro: teamSettings.defaultIterationMacro,
          backlogVisibilities: teamSettings.backlogVisibilities,
          bugsBehavior: teamSettings.bugsBehavior,
          workingDays: teamSettings.workingDays,
          defaultAreaPath: teamFieldValues?.defaultValue,
          areaPathField: teamFieldValues?.field,
          areaPaths: teamFieldValues?.values,
        };

        return {
          content: [
            { type: "text", text: `Project: ${resolvedProject}, Team: ${resolvedTeam}` },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching team settings: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_plans,
    "Retrieve a list of delivery plans for an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list delivery plans for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const plans = await workApi.getPlans(resolvedProject);

        if (!plans || plans.length === 0) {
          return { content: [{ type: "text", text: "No delivery plans found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(plans, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching delivery plans: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_plan,
    "Retrieve a single delivery plan by ID for an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.string().describe("The ID of the delivery plan to retrieve."),
    },
    async ({ project, id }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get the delivery plan from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const plan = await workApi.getPlan(resolvedProject, id);

        if (!plan) {
          return { content: [{ type: "text", text: `Delivery plan '${id}' not found` }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching delivery plan: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.create_plan,
    "Create a new delivery plan in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      name: z.string().describe("The name of the delivery plan to create."),
      description: z.string().optional().describe("The description of the delivery plan."),
      properties: z.record(z.unknown()).optional().describe("Optional delivery plan properties (e.g., team backlog mappings, criteria). Provided as an object."),
    },
    async ({ project, name, description, properties }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to create the delivery plan in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const postedPlan: CreatePlan = {
          name,
          description,
          type: PlanType.DeliveryTimelineView,
          properties,
        };

        const plan = await workApi.createPlan(postedPlan, resolvedProject);

        return {
          content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating delivery plan: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_plan,
    "Update an existing delivery plan in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.string().describe("The ID of the delivery plan to update."),
      revision: z.coerce.number().describe("The revision of the plan being updated. Must match the current revision returned by the server to avoid conflicts."),
      name: z.string().optional().describe("The new name of the delivery plan."),
      description: z.string().optional().describe("The new description of the delivery plan."),
      properties: z.record(z.unknown()).optional().describe("Optional delivery plan properties to update. Provided as an object."),
    },
    async ({ project, id, revision, name, description, properties }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the delivery plan.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();

        // updatePlan is a full replacement (PUT); merge the caller's changes onto the
        // existing plan so unspecified fields (e.g. properties/backlog mappings) are preserved.
        const existing = await workApi.getPlan(resolvedProject, id);
        if (!existing) {
          return { content: [{ type: "text", text: `Delivery plan '${id}' not found` }], isError: true };
        }

        const updatedPlan: UpdatePlan = {
          name: name ?? existing.name,
          description: description ?? existing.description,
          revision,
          type: existing.type ?? PlanType.DeliveryTimelineView,
          properties: properties ?? existing.properties,
        };

        const plan = await workApi.updatePlan(updatedPlan, resolvedProject, id);

        return {
          content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating delivery plan: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.delete_plan,
    "Permanently delete a delivery plan from an Azure DevOps project. This is a destructive operation. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.string().describe("The ID of the delivery plan to delete."),
    },
    async ({ project, id }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the delivery plan.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        await workApi.deletePlan(resolvedProject, id);

        return {
          content: [{ type: "text", text: `Delivery plan '${id}' deleted from project '${resolvedProject}'.` }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error deleting delivery plan: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_areas,
    "List the area paths for an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      depth: z.coerce.number().default(2).describe("Depth of child area paths to fetch. Defaults to 2."),
    },
    async ({ project, depth }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list area paths for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const results = await workItemTrackingApi.getClassificationNodes(resolvedProject, [], depth);

        const areas = (results ?? []).filter((node) => node.structureType === TreeNodeStructureType.Area);

        if (areas.length === 0) {
          return { content: [{ type: "text", text: "No area paths found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(areas, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching area paths: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.create_area,
    "Create a new area path in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      name: z.string().describe("The name of the area path to create."),
      parentPath: z.string().optional().describe("The path of the parent area under which to create the new area (e.g. 'ParentArea/Child'). If omitted, the area is created at the project root."),
    },
    async ({ project, name, parentPath }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to create the area path in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const url = classificationNodeUrl(connection, resolvedProject, TreeStructureGroup.Areas, parentPath);
        const created = await connection.rest.create<WorkItemClassificationNode>(url, { name });

        return {
          content: [{ type: "text", text: JSON.stringify(created.result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating area path: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_area,
    "Rename an existing area path in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      path: z.string().describe("The current path of the area to rename (e.g. 'ParentArea/Child')."),
      name: z.string().describe("The new name for the area path."),
    },
    async ({ project, path, name }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the area path.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const url = classificationNodeUrl(connection, resolvedProject, TreeStructureGroup.Areas, path);
        const updated = await connection.rest.update<WorkItemClassificationNode>(url, { name });

        return {
          content: [{ type: "text", text: JSON.stringify(updated.result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating area path: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.delete_area,
    "Permanently delete an area path from an Azure DevOps project. This is a destructive operation: work items assigned to the deleted area are reclassified to the area identified by reclassifyId. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      path: z.string().describe("The path of the area to delete (e.g. 'ParentArea/Child')."),
      reclassifyId: z.coerce.number().describe("The ID of the area path to which work items (and child nodes) currently under the deleted area will be reclassified."),
    },
    async ({ project, path, reclassifyId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the area path.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const url = classificationNodeUrl(connection, resolvedProject, TreeStructureGroup.Areas, path, { $reclassifyId: reclassifyId });
        await connection.rest.del(url);

        return {
          content: [{ type: "text", text: `Area path '${path}' deleted from project '${resolvedProject}'. Work items reclassified to area ID ${reclassifyId}.` }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error deleting area path: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_iteration,
    "Update an existing iteration (rename and/or change its start/finish dates) in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      path: z.string().describe("The current path of the iteration to update (e.g. 'ParentIteration/Sprint 1')."),
      name: z.string().optional().describe("The new name for the iteration."),
      startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z')."),
      finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z')."),
    },
    async ({ project, path, name, startDate, finishDate }) => {
      try {
        if (name === undefined && startDate === undefined && finishDate === undefined) {
          return { content: [{ type: "text", text: "No updates provided. Specify at least one of: name, startDate, finishDate." }], isError: true };
        }

        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the iteration.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const node: WorkItemClassificationNode = { name };
        if (startDate !== undefined || finishDate !== undefined) {
          node.attributes = {
            startDate: startDate ? new Date(startDate) : undefined,
            finishDate: finishDate ? new Date(finishDate) : undefined,
          };
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        const iteration = await workItemTrackingApi.updateClassificationNode(node, resolvedProject, TreeStructureGroup.Iterations, path);

        return {
          content: [{ type: "text", text: JSON.stringify(iteration, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating iteration: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.delete_iteration,
    "Permanently delete an iteration from an Azure DevOps project. This is a destructive operation: work items assigned to the deleted iteration are reclassified to the iteration identified by reclassifyId. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      path: z.string().describe("The path of the iteration to delete (e.g. 'ParentIteration/Sprint 1')."),
      reclassifyId: z.coerce.number().describe("The ID of the iteration to which work items currently under the deleted iteration will be reclassified."),
    },
    async ({ project, path, reclassifyId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the iteration.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemTrackingApi = await connection.getWorkItemTrackingApi();
        await workItemTrackingApi.deleteClassificationNode(resolvedProject, TreeStructureGroup.Iterations, path, reclassifyId);

        return {
          content: [{ type: "text", text: `Iteration '${path}' deleted from project '${resolvedProject}'. Work items reclassified to iteration ID ${reclassifyId}.` }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error deleting iteration: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.set_team_area_paths,
    "Set the area paths owned by a team in an Azure DevOps project (the default area path and/or the full list of area paths). If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      defaultAreaPath: z.string().optional().describe("The team's default area path (new work items are assigned here). Must be one of the team's area paths."),
      areaPaths: z
        .array(
          z.object({
            path: z.string().describe("An area path owned by the team (e.g. 'Project\\\\Area\\\\SubArea')."),
            includeChildren: z.boolean().optional().describe("Whether work items under child area paths also belong to the team. Defaults to false."),
          })
        )
        .optional()
        .describe("The full set of area paths owned by the team. Replaces the existing set."),
    },
    async ({ project, team, defaultAreaPath, areaPaths }) => {
      try {
        if (defaultAreaPath === undefined && areaPaths === undefined) {
          return { content: [{ type: "text", text: "No updates provided. Specify at least one of: defaultAreaPath, areaPaths." }], isError: true };
        }

        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the team.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to set area paths for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const patch: TeamFieldValuesPatch = {
          defaultValue: defaultAreaPath,
          values: areaPaths?.map((a) => ({ value: a.path, includeChildren: a.includeChildren ?? false })),
        };

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateTeamFieldValues(patch, { project: resolvedProject, team: resolvedTeam });

        return {
          content: [
            { type: "text", text: `Project: ${resolvedProject}, Team: ${resolvedTeam}` },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error setting team area paths: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_boards,
    "List the boards for a team in an Azure DevOps project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list boards for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list boards for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const boards = await workApi.getBoards({ project: resolvedProject, team: resolvedTeam });

        if (!boards || boards.length === 0) {
          return { content: [{ type: "text", text: "No boards found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(boards, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching boards: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_columns,
    "Get the columns of a board for a team in an Azure DevOps project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board (e.g. 'Stories', 'Features')."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const columns = await workApi.getBoardColumns({ project: resolvedProject, team: resolvedTeam }, board);

        if (!columns || columns.length === 0) {
          return { content: [{ type: "text", text: "No board columns found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(columns, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching board columns: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_rows,
    "Get the rows (swimlanes) of a board for a team in an Azure DevOps project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board (e.g. 'Stories', 'Features')."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const rows = await workApi.getBoardRows({ project: resolvedProject, team: resolvedTeam }, board);

        if (!rows || rows.length === 0) {
          return { content: [{ type: "text", text: "No board rows found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching board rows: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_backlog_configuration,
    "Get the backlog configuration (portfolio/requirement/task backlogs and their work item types) for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const config = await workApi.getBacklogConfigurations({ project: resolvedProject, team: resolvedTeam });

        return {
          content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching backlog configuration: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_team_days_off,
    "Get a team's days off for a specific iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID of the iteration to get days off for."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const daysOff = await workApi.getTeamDaysOff({ project: resolvedProject, team: resolvedTeam }, iterationId);

        return {
          content: [{ type: "text", text: JSON.stringify(daysOff, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching team days off: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.set_team_days_off,
    "Set a team's days off for a specific iteration (replaces the existing set). If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID of the iteration to set days off for."),
      daysOff: z
        .array(
          z.object({
            start: z.string().describe("Start date in ISO format (e.g. '2023-01-02T00:00:00Z')."),
            end: z.string().describe("End date in ISO format (e.g. '2023-01-03T00:00:00Z')."),
          })
        )
        .describe("The full set of day-off ranges for the team in this iteration. Replaces the existing set; pass an empty array to clear."),
    },
    async ({ project, team, iterationId, daysOff }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const patch: TeamSettingsDaysOffPatch = {
          daysOff: daysOff.map((d) => ({ start: new Date(d.start), end: new Date(d.end) })),
        };

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateTeamDaysOff(patch, { project: resolvedProject, team: resolvedTeam }, iterationId);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error setting team days off: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // Resolve project + team (eliciting if not supplied) for the board write tools.
  const resolveTeamContext = async (connection: WebApi, project: string | undefined, team: string | undefined) => {
    let resolvedProject = project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
      if ("response" in result) return result;
      resolvedProject = result.resolved;
    }
    let resolvedTeam = team;
    if (!resolvedTeam) {
      const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team.");
      if ("response" in result) return result;
      resolvedTeam = result.resolved;
    }
    return { teamContext: { project: resolvedProject, team: resolvedTeam } };
  };

  registerTool(
    server,
    WORK_TOOLS.update_board_columns,
    "Replace the columns of a board. Obtain the current columns via work_get_board_columns, modify them, and pass back the full set.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      columns: z.array(z.record(z.unknown())).describe("The full ordered set of board columns (as returned by work_get_board_columns, with edits applied)."),
    },
    async ({ project, team, board, columns }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateBoardColumns(columns as unknown as BoardColumn[], ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating board columns: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_board_rows,
    "Replace the rows (swimlanes) of a board. Obtain the current rows via work_get_board_rows, modify them, and pass back the full set.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      rows: z.array(z.record(z.unknown())).describe("The full ordered set of board rows (as returned by work_get_board_rows, with edits applied)."),
    },
    async ({ project, team, board, rows }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateBoardRows(rows as unknown as BoardRow[], ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating board rows: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_card_settings,
    "Get the card field settings of a board. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const settings = await workApi.getBoardCardSettings(ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(settings, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board card settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_board_card_settings,
    "Update the card field settings of a board. Obtain the current settings via work_get_board_card_settings, modify them, and pass back the full object.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      cardSettings: z.record(z.unknown()).describe("The full card settings object (as returned by work_get_board_card_settings, with edits applied)."),
    },
    async ({ project, team, board, cardSettings }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateBoardCardSettings(cardSettings as unknown as BoardCardSettings, ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating board card settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_card_rule_settings,
    "Get the card style/rule settings of a board. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const settings = await workApi.getBoardCardRuleSettings(ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(settings, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board card rule settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_board_card_rule_settings,
    "Update the card style/rule settings of a board. Obtain the current settings via work_get_board_card_rule_settings, modify them, and pass back the full object.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      ruleSettings: z.record(z.unknown()).describe("The full card rule settings object (as returned by work_get_board_card_rule_settings, with edits applied)."),
    },
    async ({ project, team, board, ruleSettings }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateBoardCardRuleSettings(ruleSettings as unknown as BoardCardRuleSettings, ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating board card rule settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_board_charts,
    "List the charts available on a board. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const charts = await workApi.getBoardCharts(ctx.teamContext, board);

        if (!charts || charts.length === 0) {
          return { content: [{ type: "text", text: "No board charts found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(charts, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board charts: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_chart,
    "Get a specific chart of a board by name. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      name: z.string().describe("The name of the chart (e.g. 'CumulativeFlow')."),
    },
    async ({ project, team, board, name }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const chart = await workApi.getBoardChart(ctx.teamContext, board, name);

        return { content: [{ type: "text", text: JSON.stringify(chart, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board chart: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_board_chart,
    "Update a board chart by name. Obtain the current chart via work_get_board_chart, modify it, and pass back the full object.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
      name: z.string().describe("The name of the chart to update."),
      chart: z.record(z.unknown()).describe("The full chart object (as returned by work_get_board_chart, with edits applied)."),
    },
    async ({ project, team, board, name, chart }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateBoardChart(chart as unknown as BoardChart, ctx.teamContext, board, name);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating board chart: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_backlogs,
    "List the backlog levels (e.g. Epics, Features, Stories) configured for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const backlogs = await workApi.getBacklogs(ctx.teamContext);

        if (!backlogs || backlogs.length === 0) {
          return { content: [{ type: "text", text: "No backlogs found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching backlogs: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_backlog,
    "Get the configuration of a specific backlog level for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      id: z.string().describe("The ID of the backlog level (e.g. 'Microsoft.EpicCategory'). Use work_list_backlogs to discover valid IDs."),
    },
    async ({ project, team, id }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const backlog = await workApi.getBacklog(ctx.teamContext, id);

        return { content: [{ type: "text", text: JSON.stringify(backlog, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching backlog: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_backlog_work_items,
    "Get the work items belonging to a specific backlog level for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      backlogId: z.string().describe("The ID of the backlog level (e.g. 'Microsoft.RequirementCategory'). Use work_list_backlogs to discover valid IDs."),
    },
    async ({ project, team, backlogId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const workItems = await workApi.getBacklogLevelWorkItems(ctx.teamContext, backlogId);

        return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching backlog work items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_iteration_work_items,
    "Get the work items assigned to a specific iteration for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration. Use work_list_team_iterations to discover iteration IDs."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const workItems = await workApi.getIterationWorkItems(ctx.teamContext, iterationId);

        return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching iteration work items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.remove_team_iteration,
    "Remove (unassign) an iteration from a team. This does not delete the iteration from the project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      id: z.string().describe("The ID (GUID) of the team iteration to remove."),
    },
    async ({ project, team, id }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        await workApi.deleteTeamIteration(ctx.teamContext, id);

        return { content: [{ type: "text", text: `Iteration ${id} removed from team` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error removing team iteration: ${errorMessage}` }], isError: true };
      }
    }
  );

  const reorderOperationShape = {
    ids: z.array(z.number()).describe("IDs of the work items to reorder, in the desired order. Must be valid work item IDs."),
    previousId: z.number().optional().describe("ID of the work item that should be before the reordered items. Use 0 for the beginning of the list."),
    nextId: z.number().optional().describe("ID of the work item that should be after the reordered items. Use 0 for the end of the list."),
    parentId: z.number().optional().describe("Parent ID for all of the work items involved. Use 0 if the items have no parent."),
    iterationPath: z.string().optional().describe("Iteration path for the reorder operation (only used when reordering from the iteration backlog)."),
  };

  registerTool(
    server,
    WORK_TOOLS.reorder_backlog_work_items,
    "Reorder work items on a team's backlog. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      ...reorderOperationShape,
    },
    async ({ project, team, ids, previousId, nextId, parentId, iterationPath }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const operation: ReorderOperation = { ids, previousId, nextId, parentId, iterationPath };
        const workApi = await connection.getWorkApi();
        const result = await workApi.reorderBacklogWorkItems(operation, ctx.teamContext);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error reordering backlog work items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.reorder_iteration_work_items,
    "Reorder work items within a team's iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration whose work items are being reordered."),
      ...reorderOperationShape,
    },
    async ({ project, team, iterationId, ids, previousId, nextId, parentId, iterationPath }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const operation: ReorderOperation = { ids, previousId, nextId, parentId, iterationPath };
        const workApi = await connection.getWorkApi();
        const result = await workApi.reorderIterationWorkItems(operation, ctx.teamContext, iterationId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error reordering iteration work items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board,
    "Get a board (including its columns, rows and allowed mappings) for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      id: z.string().describe("The name or ID of the board (e.g. 'Stories'). Use work_list_boards to discover valid boards."),
    },
    async ({ project, team, id }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const board = await workApi.getBoard(ctx.teamContext, id);

        return { content: [{ type: "text", text: JSON.stringify(board, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_user_settings,
    "Get the current user's settings for a board (e.g. which swimlanes are collapsed). If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      board: z.string().describe("The name or ID of the board."),
    },
    async ({ project, team, board }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const settings = await workApi.getBoardUserSettings(ctx.teamContext, board);

        return { content: [{ type: "text", text: JSON.stringify(settings, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board user settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_delivery_timeline,
    "Get the delivery timeline (delivery plan) data for a plan. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.string().describe("The ID (GUID) of the delivery plan. Use work_list_plans to discover plan IDs."),
      revision: z.coerce.number().optional().describe("Optional revision of the plan to retrieve."),
      startDate: z.string().optional().describe("Optional start date filter in ISO format (e.g. '2024-01-01T00:00:00Z')."),
      endDate: z.string().optional().describe("Optional end date filter in ISO format (e.g. '2024-03-31T23:59:59Z')."),
    },
    async ({ project, id, revision, startDate, endDate }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get the delivery timeline for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const timeline = await workApi.getDeliveryTimelineData(resolvedProject, id, revision, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);

        return { content: [{ type: "text", text: JSON.stringify(timeline, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching delivery timeline: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_process_configuration,
    "Get the process configuration (backlog levels, fields and work item types) for a project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get the process configuration for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const config = await workApi.getProcessConfiguration(resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching process configuration: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.list_predefined_queries,
    "List the predefined queries (e.g. unparented work, work without target date) available for a project's portfolio backlogs. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list predefined queries for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const queries = await workApi.getPredefinedQueries(resolvedProject);

        if (!queries || queries.length === 0) {
          return { content: [{ type: "text", text: "No predefined queries found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(queries, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching predefined queries: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_predefined_query_results,
    "Get the results of a predefined query for a project's portfolio backlogs. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      id: z.string().describe("The ID of the predefined query. Use work_list_predefined_queries to discover valid IDs."),
      top: z.coerce.number().optional().describe("Optional maximum number of results to return."),
      includeCompleted: z.boolean().optional().describe("Whether to include completed work items in the results. Defaults to false."),
    },
    async ({ project, id, top, includeCompleted }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get predefined query results for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const results = await workApi.getPredefinedQueryResults(resolvedProject, id, top, includeCompleted);

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching predefined query results: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_taskboard_columns,
    "Get the taskboard (sprint board) columns for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const columns = await workApi.getColumns(ctx.teamContext);

        return { content: [{ type: "text", text: JSON.stringify(columns, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching taskboard columns: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_taskboard_columns,
    "Replace the taskboard (sprint board) columns for a team. Obtain the current columns via work_get_taskboard_columns, modify them, and pass back the full set.",
    {
      project: optionalProject,
      team: optionalTeam,
      columns: z
        .array(
          z.object({
            id: z.string().optional().describe("Column ID. Leave empty for a new column."),
            name: z.string().describe("Column name (required)."),
            order: z.number().optional().describe("Column position relative to other columns."),
            mappings: z
              .array(
                z.object({
                  state: z.string().optional().describe("State of the work item type mapped to this column."),
                  workItemType: z.string().optional().describe("Work item type whose state is mapped to this column."),
                })
              )
              .optional()
              .describe("Work item type states mapped to this column for auto state updates."),
          })
        )
        .describe("The full ordered set of taskboard columns."),
    },
    async ({ project, team, columns }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const result = await workApi.updateColumns(columns as UpdateTaskboardColumn[], ctx.teamContext);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating taskboard columns: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_taskboard_work_item_columns,
    "Get the taskboard column assignment for each work item in an iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration. Use work_list_team_iterations to discover iteration IDs."),
    },
    async ({ project, team, iterationId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const columns = await workApi.getWorkItemColumns(ctx.teamContext, iterationId);

        return { content: [{ type: "text", text: JSON.stringify(columns, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching taskboard work item columns: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_taskboard_work_item_column,
    "Move a work item to a different taskboard column within an iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration containing the work item."),
      workItemId: z.number().describe("The ID of the work item to move."),
      newColumn: z.string().describe("The name of the taskboard column to move the work item into."),
    },
    async ({ project, team, iterationId, workItemId, newColumn }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const update: UpdateTaskboardWorkItemColumn = { newColumn };
        const workApi = await connection.getWorkApi();
        await workApi.updateWorkItemColumn(update, ctx.teamContext, iterationId, workItemId);

        return { content: [{ type: "text", text: `Work item ${workItemId} moved to taskboard column '${newColumn}'` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating taskboard work item column: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_taskboard_card_settings,
    "Update the taskboard card field settings for a team. Obtain a card settings shape via work_get_board_card_settings, modify it, and pass back the full object.",
    {
      project: optionalProject,
      team: optionalTeam,
      cardSettings: z.record(z.unknown()).describe("The full card settings object."),
    },
    async ({ project, team, cardSettings }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        await workApi.updateTaskboardCardSettings(cardSettings as unknown as BoardCardSettings, ctx.teamContext);

        return { content: [{ type: "text", text: "Taskboard card settings updated" }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating taskboard card settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_taskboard_card_rule_settings,
    "Update the taskboard card style/rule settings for a team. Obtain a rule settings shape via work_get_board_card_rule_settings, modify it, and pass back the full object.",
    {
      project: optionalProject,
      team: optionalTeam,
      ruleSettings: z.record(z.unknown()).describe("The full card rule settings object."),
    },
    async ({ project, team, ruleSettings }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        await workApi.updateTaskboardCardRuleSettings(ruleSettings as unknown as BoardCardRuleSettings, ctx.teamContext);

        return { content: [{ type: "text", text: "Taskboard card rule settings updated" }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating taskboard card rule settings: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_column_suggested_values,
    "Get the suggested values that can be used for board columns in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get column suggested values for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const values = await workApi.getColumnSuggestedValues(resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(values, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching column suggested values: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_row_suggested_values,
    "Get the suggested values that can be used for board rows (swimlanes) in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get row suggested values for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const values = await workApi.getRowSuggestedValues(resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(values, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching row suggested values: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_board_mapping_parent_items,
    "Get the parent work items mapped to a set of child work items for a board. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      childBacklogContextCategoryRefName: z.string().describe("The category reference name of the child backlog level (e.g. 'Microsoft.RequirementCategory')."),
      workItemIds: z.array(z.number()).describe("The IDs of the child work items to find parents for."),
    },
    async ({ project, team, childBacklogContextCategoryRefName, workItemIds }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const mappings = await workApi.getBoardMappingParentItems(ctx.teamContext, childBacklogContextCategoryRefName, workItemIds);

        return { content: [{ type: "text", text: JSON.stringify(mappings, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching board mapping parent items: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.get_team_member_capacity,
    "Get the capacity of a specific team member for an iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration."),
      teamMemberId: z.string().describe("The ID of the team member whose capacity to retrieve."),
    },
    async ({ project, team, iterationId, teamMemberId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const workApi = await connection.getWorkApi();
        const capacity = await workApi.getCapacityWithIdentityRef(ctx.teamContext, iterationId, teamMemberId);

        return { content: [{ type: "text", text: JSON.stringify(capacity, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching team member capacity: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.replace_team_capacities,
    "Replace the capacities of all team members for an iteration. This overwrites the entire capacity set for the iteration. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      iterationId: z.string().describe("The ID (GUID) of the iteration."),
      capacities: z
        .array(
          z.object({
            teamMemberId: z.string().describe("The ID of the team member."),
            activities: z
              .array(
                z.object({
                  name: z.string().describe("The name of the activity (e.g., 'Development')."),
                  capacityPerDay: z.number().describe("The capacity per day for this activity."),
                })
              )
              .describe("Activities and their daily capacities for this team member."),
            daysOff: z
              .array(
                z.object({
                  start: z.string().describe("Start date of the day off in ISO format."),
                  end: z.string().describe("End date of the day off in ISO format."),
                })
              )
              .optional()
              .describe("Days off for this team member, each with a start and end date in ISO format."),
          })
        )
        .describe("The full set of team member capacities for the iteration."),
    },
    async ({ project, team, iterationId, capacities }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const payload: TeamMemberCapacityIdentityRef[] = capacities.map((c) => ({
          teamMember: { id: c.teamMemberId },
          activities: c.activities.map((a) => ({ name: a.name, capacityPerDay: a.capacityPerDay })),
          daysOff: (c.daysOff || []).map((d) => ({ start: new Date(d.start), end: new Date(d.end) })),
        }));

        const workApi = await connection.getWorkApi();
        const result = await workApi.replaceCapacitiesWithIdentityRef(payload, ctx.teamContext, iterationId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error replacing team capacities: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WORK_TOOLS.update_automation_rule,
    "Enable or disable a team's backlog automation rules (e.g. auto state updates) for a backlog level. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      backlogLevelName: z.string().optional().describe("The name of the backlog level the rules apply to (e.g. 'Stories')."),
      rulesStates: z.record(z.boolean()).describe("Map of automation rule name to enabled/disabled state."),
    },
    async ({ project, team, backlogLevelName, rulesStates }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveTeamContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const ruleRequestModel: TeamAutomationRulesSettingsRequestModel = { backlogLevelName, rulesStates };
        const workApi = await connection.getWorkApi();
        await workApi.updateAutomationRule(ruleRequestModel, ctx.teamContext);

        return { content: [{ type: "text", text: "Automation rules updated" }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating automation rule: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { WORK_TOOLS, configureWorkTools };
