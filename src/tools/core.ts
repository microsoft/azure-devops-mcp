// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const CORE_TOOLS = {
  list_project_teams: "core_list_project_teams",
  list_all_projects: "core_list_projects",  
  search_projects: "core_search_projects",
};

function configureCoreTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  
  server.tool(
    CORE_TOOLS.list_project_teams,
    "Retrieve a list of teams for the specified Azure DevOps project.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      mine: z.boolean().optional().describe("If true, only return teams that the authenticated user is a member of."),
      top: z.number().optional().describe("The maximum number of teams to return. Defaults to 100."),
      skip: z.number().optional().describe("The number of teams to skip for pagination. Defaults to 0."),     
    },
    async ({ project, mine, top, skip }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getCoreApi();
      const teams = await coreApi.getTeams(
        project,
        mine,
        top,
        skip,
        false
      );

      return {
        content: [{ type: "text", text: JSON.stringify(teams, null, 2) }],
      };
    }
  );
 
  server.tool(
    CORE_TOOLS.list_all_projects,
    "Retrieve a list of projects in your Azure DevOps organization.",
    {
      stateFilter: z.enum(["all", "wellFormed", "createPending", "deleted"]).default("wellFormed").describe("Filter projects by their state. Defaults to 'wellFormed'."),
      top: z.number().optional().describe("The maximum number of projects to return. Defaults to 100."),
      skip: z.number().optional().describe("The number of projects to skip for pagination. Defaults to 0."),
      continuationToken: z.number().optional().describe("Continuation token for pagination. Used to fetch the next set of results if available."),      
    },
    async ({ stateFilter, top, skip, continuationToken }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getCoreApi();
      const projects = await coreApi.getProjects(
        stateFilter,
        top,
        skip,
        continuationToken,
        false
      );

      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    }
  ); 
  
  server.tool(
    CORE_TOOLS.search_projects,
    "Search and retrieve a list of projects in your Azure DevOps organization filtered by name or description.",
    {
      searchText: z.string().describe("The search text to filter projects by name or description. Case-insensitive partial matching."),
      stateFilter: z.enum(["all", "wellFormed", "createPending", "deleted"]).default("wellFormed").describe("Filter projects by their state. Defaults to 'wellFormed'."),
      top: z.number().optional().describe("The maximum number of projects to return. Defaults to 100."),
      skip: z.number().optional().describe("The number of projects to skip for pagination. Defaults to 0."),
      continuationToken: z.number().optional().describe("Continuation token for pagination. Used to fetch the next set of results if available."),      
    },
    async ({ searchText, stateFilter, top, skip, continuationToken }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getCoreApi();
      const projects = await coreApi.getProjects(
        stateFilter,
        top,
        skip,
        continuationToken,
        false
      );

      // Filter projects by name or description using case-insensitive search
      const filteredProjects = projects?.filter((project) => {
        const nameMatch = project.name?.toLowerCase().includes(searchText.toLowerCase());
        const descriptionMatch = project.description?.toLowerCase().includes(searchText.toLowerCase());
        return nameMatch || descriptionMatch;
      });

      return {
        content: [{ type: "text", text: JSON.stringify(filteredProjects, null, 2) }],
      };
    }
  ); 
}

export { CORE_TOOLS, configureCoreTools };
