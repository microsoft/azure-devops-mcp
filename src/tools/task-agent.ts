// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { VariableGroupParameters, VariableGroupProjectReference, EnvironmentCreateParameter, EnvironmentUpdateParameter } from "azure-devops-node-api/interfaces/TaskAgentInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { optionalProject } from "../shared/common-params.js";

const TASKAGENT_TOOLS = {
  list_variable_groups: "taskagent_list_variable_groups",
  get_variable_group: "taskagent_get_variable_group",
  add_variable_group: "taskagent_add_variable_group",
  update_variable_group: "taskagent_update_variable_group",
  delete_variable_group: "taskagent_delete_variable_group",
  share_variable_group: "taskagent_share_variable_group",
  list_agent_pools: "taskagent_list_agent_pools",
  list_agent_queues: "taskagent_list_agent_queues",
  list_environments: "taskagent_list_environments",
  get_environment: "taskagent_get_environment",
  add_environment: "taskagent_add_environment",
  update_environment: "taskagent_update_environment",
  delete_environment: "taskagent_delete_environment",
};

function configureTaskAgentTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // Resolve the project (eliciting if not supplied).
  const resolveProject = async (connection: WebApi, project: string | undefined) => {
    if (project) return { project };
    const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
    if ("response" in result) return result;
    return { project: result.resolved };
  };

  const projectField = optionalProject;

  registerTool(
    server,
    TASKAGENT_TOOLS.list_variable_groups,
    "List the variable groups in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      groupName: z.string().optional().describe("Optional name filter (supports wildcards) for the variable groups."),
      top: z.coerce.number().optional().describe("Optional maximum number of variable groups to return."),
    },
    async ({ project, groupName, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const groups = await taskAgentApi.getVariableGroups(ctx.project, groupName, undefined, top);

        if (!groups || groups.length === 0) {
          return { content: [{ type: "text", text: "No variable groups found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching variable groups: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.get_variable_group,
    "Get a specific variable group by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      groupId: z.number().describe("The ID of the variable group."),
    },
    async ({ project, groupId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const group = await taskAgentApi.getVariableGroup(ctx.project, groupId);

        return { content: [{ type: "text", text: JSON.stringify(group, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching variable group: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.add_variable_group,
    "Create a new variable group. The parameters must include 'variableGroupProjectReferences' specifying the target project(s).",
    {
      variableGroup: z
        .record(z.unknown())
        .describe(
          "The variable group parameters (e.g. { name, description, type: 'Vsts', variables: { KEY: { value, isSecret } }, variableGroupProjectReferences: [{ name, projectReference: { name } }] })."
        ),
    },
    async ({ variableGroup }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const result = await taskAgentApi.addVariableGroup(variableGroup as unknown as VariableGroupParameters);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating variable group: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.update_variable_group,
    "Update an existing variable group. Obtain the current group via taskagent_get_variable_group, build the parameters, and pass them back.",
    {
      groupId: z.number().describe("The ID of the variable group to update."),
      variableGroup: z.record(z.unknown()).describe("The full variable group parameters (name, description, type, variables, variableGroupProjectReferences)."),
    },
    async ({ groupId, variableGroup }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const result = await taskAgentApi.updateVariableGroup(variableGroup as unknown as VariableGroupParameters, groupId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating variable group: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.delete_variable_group,
    "Delete a variable group from the specified project(s).",
    {
      groupId: z.number().describe("The ID of the variable group to delete."),
      projectIds: z.array(z.string()).describe("The IDs of the projects to delete the variable group from."),
    },
    async ({ groupId, projectIds }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.deleteVariableGroup(groupId, projectIds);

        return { content: [{ type: "text", text: `Variable group ${groupId} deleted` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting variable group: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.share_variable_group,
    "Share a variable group with additional projects.",
    {
      variableGroupId: z.number().describe("The ID of the variable group to share."),
      projectReferences: z.array(z.record(z.unknown())).describe("The project references to share the variable group with (e.g. [{ name, projectReference: { name } }])."),
    },
    async ({ variableGroupId, projectReferences }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.shareVariableGroup(projectReferences as unknown as VariableGroupProjectReference[], variableGroupId);

        return { content: [{ type: "text", text: `Variable group ${variableGroupId} shared` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error sharing variable group: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.list_agent_pools,
    "List the agent pools in the organization, optionally filtered by name.",
    {
      poolName: z.string().optional().describe("Optional name filter for the agent pools."),
    },
    async ({ poolName }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const pools = await taskAgentApi.getAgentPools(poolName);

        if (!pools || pools.length === 0) {
          return { content: [{ type: "text", text: "No agent pools found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(pools, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching agent pools: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.list_agent_queues,
    "List the agent queues in a project, optionally filtered by name. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      queueName: z.string().optional().describe("Optional name filter for the agent queues."),
    },
    async ({ project, queueName }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const queues = await taskAgentApi.getAgentQueues(ctx.project, queueName);

        if (!queues || queues.length === 0) {
          return { content: [{ type: "text", text: "No agent queues found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(queues, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching agent queues: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.list_environments,
    "List the environments (deployment targets) in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      name: z.string().optional().describe("Optional name filter for the environments."),
      top: z.coerce.number().optional().describe("Optional maximum number of environments to return."),
    },
    async ({ project, name, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const environments = await taskAgentApi.getEnvironments(ctx.project, name, undefined, top);

        if (!environments || environments.length === 0) {
          return { content: [{ type: "text", text: "No environments found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(environments, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching environments: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.get_environment,
    "Get a specific environment by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      environmentId: z.number().describe("The ID of the environment."),
    },
    async ({ project, environmentId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const environment = await taskAgentApi.getEnvironmentById(ctx.project, environmentId);

        return { content: [{ type: "text", text: JSON.stringify(environment, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching environment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.add_environment,
    "Create a new environment (deployment target) in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      name: z.string().describe("The name of the environment."),
      description: z.string().optional().describe("An optional description of the environment."),
    },
    async ({ project, name, description }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const parameter: EnvironmentCreateParameter = { name, description };
        const taskAgentApi = await connection.getTaskAgentApi();
        const environment = await taskAgentApi.addEnvironment(parameter, ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(environment, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating environment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.update_environment,
    "Update an existing environment's name or description. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      environmentId: z.number().describe("The ID of the environment to update."),
      name: z.string().optional().describe("The new name of the environment."),
      description: z.string().optional().describe("The new description of the environment."),
    },
    async ({ project, environmentId, name, description }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const parameter: EnvironmentUpdateParameter = { name, description };
        const taskAgentApi = await connection.getTaskAgentApi();
        const environment = await taskAgentApi.updateEnvironment(parameter, ctx.project, environmentId);

        return { content: [{ type: "text", text: JSON.stringify(environment, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating environment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.delete_environment,
    "Delete an environment by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      environmentId: z.number().describe("The ID of the environment to delete."),
    },
    async ({ project, environmentId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.deleteEnvironment(ctx.project, environmentId);

        return { content: [{ type: "text", text: `Environment ${environmentId} deleted` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting environment: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { TASKAGENT_TOOLS, configureTaskAgentTools };
