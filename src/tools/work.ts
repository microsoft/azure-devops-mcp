// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeStructureGroup, TreeNodeStructureType, WorkItemClassificationNode } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";

const WORK_TOOLS = {
  list_team_iterations: "work_list_team_iterations",
  list_iterations: "work_list_iterations",
  create_iterations: "work_create_iterations",
  assign_iterations: "work_assign_iterations",
  get_team_capacity: "work_get_team_capacity",
  update_team_capacity: "work_update_team_capacity",
  get_iteration_capacities: "work_get_iteration_capacities",
  get_team_settings: "work_get_team_settings",
};

function configureWorkTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    WORK_TOOLS.list_team_iterations,
    "Retrieve a list of iterations for a specific team in a project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Reuse from prior context if already known. If not provided, a team selection prompt will be shown."),
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

  server.tool(
    WORK_TOOLS.create_iterations,
    "Create new iterations in a specified Azure DevOps project.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
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

  server.tool(
    WORK_TOOLS.list_iterations,
    "List all iterations in a specified Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      depth: z.number().default(2).describe("Depth of children to fetch."),
      excludedIds: z.array(z.number()).optional().describe("An optional array of iteration IDs, and thier children, that should not be returned."),
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

  server.tool(
    WORK_TOOLS.assign_iterations,
    "Assign existing iterations to a specific team in a project.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      team: z.string().describe("The name or ID of the Azure DevOps team."),
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
    WORK_TOOLS.get_team_settings,
    "Get team settings including default iteration, backlog iteration, and default area path for a team. If a project or team is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Reuse from prior context if already known. If not provided, a team selection prompt will be shown."),
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
}

export { WORK_TOOLS, configureWorkTools };
