// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { searchIdentities } from "./auth.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";

import type { ProjectInfo, TeamProject, WebApiTeam } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { ProjectVisibility } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import { IdentityBase } from "azure-devops-node-api/interfaces/IdentitiesInterfaces.js";
import { optionalProject, optionalProjectWith, optionalTeam } from "../shared/common-params.js";

const CORE_TOOLS = {
  list_project_teams: "core_list_project_teams",
  list_projects: "core_list_projects",
  get_identity_ids: "core_get_identity_ids",
  create_project: "core_create_project",
  update_project: "core_update_project",
  delete_project: "core_delete_project",
  create_team: "core_create_team",
  update_team: "core_update_team",
  delete_team: "core_delete_team",
  list_processes: "core_list_processes",
  list_team_members: "core_list_team_members",
  get_project_properties: "core_get_project_properties",
  set_project_properties: "core_set_project_properties",
};

const projectVisibilityMap: Record<string, ProjectVisibility> = {
  private: ProjectVisibility.Private,
  public: ProjectVisibility.Public,
  organization: ProjectVisibility.Organization,
};

function filterProjectsByName(projects: ProjectInfo[], projectNameFilter: string): ProjectInfo[] {
  const lowerCaseFilter = projectNameFilter.toLowerCase();
  return projects.filter((project) => project.name?.toLowerCase().includes(lowerCaseFilter));
}

function configureCoreTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  registerTool(
    server,
    CORE_TOOLS.list_project_teams,
    "Retrieve a list of teams for an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      mine: z.boolean().optional().describe("If true, only return teams that the authenticated user is a member of."),
      top: z.coerce.number().optional().describe("The maximum number of teams to return. Defaults to 100."),
      skip: z.coerce.number().optional().describe("The number of teams to skip for pagination. Defaults to 0."),
    },
    async ({ project, mine, top, skip }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;

        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list teams for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const teams = await coreApi.getTeams(resolvedProject, mine, top, skip, false);

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

  registerTool(
    server,
    CORE_TOOLS.list_projects,
    "Retrieve a list of projects in your Azure DevOps organization.",
    {
      stateFilter: z.enum(["all", "wellFormed", "createPending", "deleted"]).default("wellFormed").describe("Filter projects by their state. Defaults to 'wellFormed'."),
      top: z.coerce.number().optional().describe("The maximum number of projects to return. Defaults to 100."),
      skip: z.coerce.number().optional().describe("The number of projects to skip for pagination. Defaults to 0."),
      continuationToken: z.coerce.number().optional().describe("Continuation token for pagination. Used to fetch the next set of results if available."),
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

  registerTool(
    server,
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

  registerTool(
    server,
    CORE_TOOLS.create_project,
    "Create a new project in your Azure DevOps organization. This queues an asynchronous operation and returns an operation reference.",
    {
      name: z.string().describe("The name of the project to create."),
      description: z.string().optional().describe("The description of the project."),
      visibility: z.enum(["private", "public", "organization"]).default("private").describe("The visibility of the project. Defaults to 'private'."),
      sourceControlType: z.enum(["Git", "Tfvc"]).default("Git").describe("The version control system for the project. Defaults to 'Git'."),
      processTemplate: z.string().optional().describe("The name or ID of the process template (e.g., 'Agile', 'Scrum', 'Basic', 'CMMI'). If not provided, the organization's default process is used."),
    },
    async ({ name, description, visibility, sourceControlType, processTemplate }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        const processes = await coreApi.getProcesses();
        if (!processes || processes.length === 0) {
          return { content: [{ type: "text", text: "No processes found to create a project with." }], isError: true };
        }

        const lowerProcess = processTemplate?.toLowerCase();
        const process = lowerProcess ? processes.find((p) => p.name?.toLowerCase() === lowerProcess || p.id?.toLowerCase() === lowerProcess) : (processes.find((p) => p.isDefault) ?? processes[0]);

        if (!process?.id) {
          const message = lowerProcess
            ? `Process template '${processTemplate}' not found. Available processes: ${processes.map((p) => p.name).join(", ")}`
            : "Could not determine a default process template for this organization. Specify 'processTemplate' explicitly.";
          return { content: [{ type: "text", text: message }], isError: true };
        }

        const projectToCreate: TeamProject = {
          name,
          description,
          visibility: projectVisibilityMap[visibility],
          capabilities: {
            versioncontrol: { sourceControlType },
            processTemplate: { templateTypeId: process.id },
          },
        };

        const operation = await coreApi.queueCreateProject(projectToCreate);

        return {
          content: [{ type: "text", text: JSON.stringify(operation, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating project: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.update_project,
    "Update an existing project in your Azure DevOps organization. This queues an asynchronous operation and returns an operation reference. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProjectWith("The project to update."),
      name: z.string().optional().describe("The new name of the project."),
      description: z.string().optional().describe("The new description of the project."),
      visibility: z.enum(["private", "public", "organization"]).optional().describe("The new visibility of the project."),
    },
    async ({ project, name, description, visibility }) => {
      try {
        if (name === undefined && description === undefined && visibility === undefined) {
          return { content: [{ type: "text", text: "No updates provided. Specify at least one of: name, description, visibility." }], isError: true };
        }

        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to update.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const existing = await coreApi.getProject(resolvedProject);
        if (!existing?.id) {
          return { content: [{ type: "text", text: `Project '${resolvedProject}' not found.` }], isError: true };
        }

        const projectUpdate: TeamProject = {
          name,
          description,
          visibility: visibility ? projectVisibilityMap[visibility] : undefined,
        };

        const operation = await coreApi.updateProject(projectUpdate, existing.id);

        return {
          content: [{ type: "text", text: JSON.stringify(operation, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating project: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.delete_project,
    "Permanently delete a project from your Azure DevOps organization. This is a destructive operation that queues an asynchronous delete and returns an operation reference. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProjectWith("The project to delete."),
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to delete.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const existing = await coreApi.getProject(resolvedProject);
        if (!existing?.id) {
          return { content: [{ type: "text", text: `Project '${resolvedProject}' not found.` }], isError: true };
        }

        const operation = await coreApi.queueDeleteProject(existing.id);

        return {
          content: [{ type: "text", text: JSON.stringify(operation, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error deleting project: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.create_team,
    "Create a new team in an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      name: z.string().describe("The name of the team to create."),
      description: z.string().optional().describe("The description of the team."),
    },
    async ({ project, name, description }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to create the team in.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const team: WebApiTeam = { name, description };
        const createdTeam = await coreApi.createTeam(team, resolvedProject);

        return {
          content: [{ type: "text", text: JSON.stringify(createdTeam, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating team: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.update_team,
    "Update an existing team in an Azure DevOps project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: z.string().describe("The name or ID of the team to update."),
      name: z.string().optional().describe("The new name of the team."),
      description: z.string().optional().describe("The new description of the team."),
    },
    async ({ project, team, name, description }) => {
      try {
        if (name === undefined && description === undefined) {
          return { content: [{ type: "text", text: "No updates provided. Specify at least one of: name, description." }], isError: true };
        }

        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the team.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const teamData: WebApiTeam = { name, description };
        const updatedTeam = await coreApi.updateTeam(teamData, resolvedProject, team);

        return {
          content: [{ type: "text", text: JSON.stringify(updatedTeam, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating team: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.delete_team,
    "Permanently delete a team from an Azure DevOps project. This is a destructive operation. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: z.string().describe("The name or ID of the team to delete."),
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project that contains the team.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        await coreApi.deleteTeam(resolvedProject, team);

        return {
          content: [{ type: "text", text: `Team '${team}' deleted from project '${resolvedProject}'.` }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error deleting team: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(server, CORE_TOOLS.list_processes, "List the process templates available in the Azure DevOps organization (e.g. Agile, Scrum, Basic, CMMI).", {}, async () => {
    try {
      const connection = await connectionProvider();
      const coreApi = await connection.getCoreApi();
      const processes = await coreApi.getProcesses();

      if (!processes || processes.length === 0) {
        return { content: [{ type: "text", text: "No processes found" }], isError: true };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(processes, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      return {
        content: [{ type: "text", text: `Error fetching processes: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  registerTool(
    server,
    CORE_TOOLS.list_team_members,
    "List the members of a team in an Azure DevOps project. If a project or team is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      team: optionalTeam,
      top: z.coerce.number().optional().describe("The maximum number of members to return."),
      skip: z.coerce.number().optional().describe("The number of members to skip for pagination."),
    },
    async ({ project, team, top, skip }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const result = await elicitTeam(server, connection, resolvedProject, "Select the Azure DevOps team to list members for.");
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const members = await coreApi.getTeamMembersWithExtendedProperties(resolvedProject, resolvedTeam, top, skip);

        if (!members || members.length === 0) {
          return { content: [{ type: "text", text: "No team members found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(members, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching team members: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.get_project_properties,
    "Get the properties of an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      keys: z.array(z.string()).optional().describe("Optional list of property keys to retrieve. If omitted, all properties are returned. Supports wildcards (e.g. 'System.*')."),
    },
    async ({ project, keys }) => {
      try {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to read properties from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const existing = await coreApi.getProject(resolvedProject);
        if (!existing?.id) {
          return { content: [{ type: "text", text: `Project '${resolvedProject}' not found.` }], isError: true };
        }

        const properties = await coreApi.getProjectProperties(existing.id, keys);

        return {
          content: [{ type: "text", text: JSON.stringify(properties ?? [], null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching project properties: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerTool(
    server,
    CORE_TOOLS.set_project_properties,
    "Set (create or update) properties on an Azure DevOps project. If a project is not specified, you will be prompted to select one.",
    {
      project: optionalProject,
      properties: z.record(z.string()).describe("Map of property name to value to set on the project."),
    },
    async ({ project, properties }) => {
      try {
        const entries = Object.entries(properties);
        if (entries.length === 0) {
          return { content: [{ type: "text", text: "No properties provided." }], isError: true };
        }

        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to set properties on.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const existing = await coreApi.getProject(resolvedProject);
        if (!existing?.id) {
          return { content: [{ type: "text", text: `Project '${resolvedProject}' not found.` }], isError: true };
        }

        const patchDocument = entries.map(([key, value]) => ({ op: "add", path: `/${key}`, value }));
        await coreApi.setProjectProperties(undefined, existing.id, patchDocument);

        return {
          content: [{ type: "text", text: `Set ${entries.length} propert${entries.length === 1 ? "y" : "ies"} on project '${resolvedProject}'.` }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error setting project properties: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

export { CORE_TOOLS, configureCoreTools };
