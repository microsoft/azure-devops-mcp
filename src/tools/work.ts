// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";

const WORK_TOOLS = {
  list_team_iterations: "work_list_team_iterations",
  create_iterations: "work_create_iterations",
  assign_iterations: "work_assign_iterations",
};

function configureWorkTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>, isReadOnlyMode: boolean) {
  const registeredTools: RegisteredTool[] = [
    server.tool(
      WORK_TOOLS.list_team_iterations,
      "Retrieve a list of iterations for a specific team in a project.",
      {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        team: z.string().describe("The name or ID of the Azure DevOps team."),
        timeframe: z.enum(["current"]).optional().describe("The timeframe for which to retrieve iterations. Currently, only 'current' is supported."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, team, timeframe }) => {
        try {
          const connection = await connectionProvider();
          const workApi = await connection.getWorkApi();
          const iterations = await workApi.getTeamIterations({ project, team }, timeframe);

          if (!iterations) {
            return { content: [{ type: "text", text: "No iterations found" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(iterations, null, 2) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

          return {
            content: [{ type: "text", text: `Error fetching team iterations: ${errorMessage}` }],
            isError: true,
          };
        }
      }
    ),

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
      {
        readOnlyHint: false,
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
    ),

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
      {
        readOnlyHint: false,
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
    ),
  ];

  if (isReadOnlyMode) {
    for (const tool of registeredTools) {
      if (!tool.annotations?.readOnlyHint) {
        tool.remove();
      }
    }
  }
}

export { WORK_TOOLS, configureWorkTools };
