// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { searchIdentities } from "./auth.js";

import type { ProjectInfo } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { IdentityBase } from "azure-devops-node-api/interfaces/IdentitiesInterfaces.js";

const CORE_TOOLS = {
  list_project_teams: "core_list_project_teams",
  list_projects: "core_list_projects",
  get_identity_ids: "core_get_identity_ids",
};

function filterProjectsByName(projects: ProjectInfo[], projectNameFilter: string): ProjectInfo[] {
  const lowerCaseFilter = projectNameFilter.toLowerCase();
  return projects.filter((project) => project.name?.toLowerCase().includes(lowerCaseFilter));
}

function configureCoreTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
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
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();
        const teams = await coreApi.getTeams(project, mine, top, skip, false);

        if (!teams) {
          return { content: [{ type: "text", text: "No teams found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(teams, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching project teams: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    CORE_TOOLS.list_projects,
    "Retrieve a list of projects in your Azure DevOps organization.",
    {
      stateFilter: z.enum(["all", "wellFormed", "createPending", "deleted"]).default("wellFormed").describe("Filter projects by their state. Defaults to 'wellFormed'."),
      top: z.number().optional().describe("The maximum number of projects to return. Defaults to 100."),
      skip: z.number().optional().describe("The number of projects to skip for pagination. Defaults to 0."),
      continuationToken: z.number().optional().describe("Continuation token for pagination. Used to fetch the next set of results if available."),
      projectNameFilter: z.string().optional().describe("Filter projects by name. Supports partial matches."),
    },
    async ({ stateFilter, top, skip, continuationToken, projectNameFilter }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();
        const projects = await coreApi.getProjects(stateFilter, top, skip, continuationToken, false);

        if (!projects) {
          return { content: [{ type: "text", text: "No projects found" }], isError: true };
        }

        const filteredProject = projectNameFilter ? filterProjectsByName(projects, projectNameFilter) : projects;

        return {
          content: [{ type: "text", text: JSON.stringify(filteredProject, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching projects: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    CORE_TOOLS.get_identity_ids,
    "Retrieve Azure DevOps identity IDs for a provided search filter.",
    {
      searchFilter: z.string().describe("Search filter (unique name, display name, email) to retrieve identity IDs for."),
    },
    async ({ searchFilter }) => {
      try {
        const identities = await searchIdentities(searchFilter, tokenProvider, connectionProvider, userAgentProvider);

        if (!identities || identities.value?.length === 0) {
          return { content: [{ type: "text", text: "No identities found" }], isError: true };
        }

        const identitiesTrimmed = identities.value?.map((identity: IdentityBase) => {
          return {
            id: identity.id,
            displayName: identity.providerDisplayName,
            descriptor: identity.descriptor,
          };
        });

        return {
          content: [{ type: "text", text: JSON.stringify(identitiesTrimmed, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching identities: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

export { CORE_TOOLS, configureCoreTools };
