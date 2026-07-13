// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeStructureGroup, TreeNodeStructureType, WorkItemClassificationNode } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";

const WORK_TOOLS = {
  work: "work",
  work_iteration_write: "work_iteration_write",
  work_capacity_write: "work_capacity_write",
};

function configureWorkTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    WORK_TOOLS.work,
    "Retrieve work-related data for a project or team. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list_iterations", "list_team_iterations", "get_team_settings", "get_team_capacity", "get_iteration_capacities"])
        .describe(
          "The action to perform. Options: list_iterations (list all iterations in a project), list_team_iterations (list iterations assigned to a team), get_team_settings (get team settings including default iteration and area path), get_team_capacity (get team capacity for an iteration), get_iteration_capacities (get capacity for all teams in an iteration)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z
        .string()
        .optional()
        .describe("The name or ID of the Azure DevOps team. Required for list_team_iterations, get_team_settings, and get_team_capacity. Reuse from prior context if already known."),
      iterationId: z.string().optional().describe("The Iteration ID. Required for get_team_capacity and get_iteration_capacities."),
      timeframe: z.enum(["current"]).optional().describe("The timeframe for list_team_iterations. Only 'current' is supported."),
      depth: z.coerce.number().default(2).describe("Depth of children to fetch. Used for list_iterations. Defaults to 2."),
      excludedIds: z.array(z.coerce.number().min(1)).optional().describe("An optional array of iteration IDs, and their children, to exclude from results. Used for list_iterations."),
    },
    async ({ action, project, team, iterationId, timeframe, depth, excludedIds }) => {
      try {
        const connection = await connectionProvider();
        let resolvedProject = project;

        if (action === "list_team_iterations") {
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
        }

        if (action === "list_iterations") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list iterations for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workItemTrackingApi = await connection.getWorkItemTrackingApi();
          const effectiveDepth = depth ?? 1;

          let results = await workItemTrackingApi.getClassificationNodes(resolvedProject, [], effectiveDepth);

          if (!results) {
            return { content: [{ type: "text", text: "No iterations were found" }], isError: true };
          }

          let filteredResults = results.filter((node) => node.structureType === TreeNodeStructureType.Iteration);

          if (excludedIds && excludedIds.length > 0) {
            const filterOutIds = (nodes: WorkItemClassificationNode[]): WorkItemClassificationNode[] => {
              return nodes
                .filter((node) => !node.id || !excludedIds.includes(node.id))
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
        }

        if (action === "get_team_settings") {
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

          const settingsResult = {
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
              { type: "text", text: JSON.stringify(settingsResult, null, 2) },
            ],
          };
        }

        if (action === "get_team_capacity") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to get team capacity for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workApi = await connection.getWorkApi();
          const teamContext = { project: resolvedProject, team: team! };

          const rawResults = await workApi.getCapacitiesWithIdentityRefAndTotals(teamContext, iterationId!);

          if (!rawResults || rawResults.teamMembers?.length === 0) {
            return { content: [{ type: "text", text: "No team capacity assigned to the team" }], isError: true };
          }

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
        }

        if (action === "get_iteration_capacities") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to get iteration capacities for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          const workApi = await connection.getWorkApi();
          const rawResults = await workApi.getTotalIterationCapacities(resolvedProject, iterationId!);

          if (!rawResults || !rawResults.teams || rawResults.teams.length === 0) {
            return { content: [{ type: "text", text: "No iteration capacity assigned to the teams" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(rawResults, null, 2) }],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const actionErrorMessages: Record<string, string> = {
          list_team_iterations: `Error fetching team iterations: ${errorMessage}`,
          list_iterations: `Error fetching iterations: ${errorMessage}`,
          get_team_settings: `Error fetching team settings: ${errorMessage}`,
          get_team_capacity: `Error getting team capacity: ${errorMessage}`,
          get_iteration_capacities: `Error getting iteration capacities: ${errorMessage}`,
        };

        return {
          content: [{ type: "text", text: actionErrorMessages[action] ?? `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    WORK_TOOLS.work_iteration_write,
    "Create or assign iterations in an Azure DevOps project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "assign"]).describe("The action to perform. 'create' creates new iterations in the project; 'assign' assigns existing iterations to a team."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Required for assign."),
      iterations: z
        .array(
          z.object({
            iterationName: z.string().optional().describe("The name of the iteration to create. Used for create."),
            startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z'). Used for create."),
            finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z'). Used for create."),
            identifier: z.string().optional().describe("The identifier of the iteration to assign. Used for assign."),
            path: z.string().optional().describe("The path of the iteration to assign, e.g., 'Project/Iteration'. Used for assign."),
          })
        )
        .describe("An array of iterations to process. For create: provide iterationName and optional dates. For assign: provide identifier and path."),
    },
    async ({ action, project, team, iterations }) => {
      try {
        const connection = await connectionProvider();

        if (action === "create") {
          const workItemTrackingApi = await connection.getWorkItemTrackingApi();
          const results = [];

          for (const { iterationName, startDate, finishDate } of iterations) {
            if (!iterationName) continue;

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
        }

        if (action === "assign") {
          const workApi = await connection.getWorkApi();
          const teamContext = { project, team: team! };
          const results = [];

          for (const { identifier, path } of iterations) {
            if (!identifier || !path) continue;

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
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const actionErrorMessages: Record<string, string> = {
          create: `Error creating iterations: ${errorMessage}`,
          assign: `Error assigning iterations: ${errorMessage}`,
        };

        return {
          content: [{ type: "text", text: actionErrorMessages[action] ?? `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    WORK_TOOLS.work_capacity_write,
    "Update the team capacity of a team member for a specific iteration in a project.",
    {
      action: z.literal("update").describe("The action to perform. Only 'update' is supported."),
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

        const updatedCapacity = await workApi.updateCapacityWithIdentityRef(capacityPatch, teamContext, iterationId, teamMemberId);

        if (!updatedCapacity) {
          return { content: [{ type: "text", text: "Failed to update team member capacity" }], isError: true };
        }

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
}

export { WORK_TOOLS, configureWorkTools };
