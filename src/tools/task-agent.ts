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
  list_agents: "taskagent_list_agents",
  get_agent: "taskagent_get_agent",
  delete_agent: "taskagent_delete_agent",
  list_agent_requests: "taskagent_list_agent_requests",
  list_task_groups: "taskagent_list_task_groups",
  get_task_group: "taskagent_get_task_group",
  delete_task_group: "taskagent_delete_task_group",
  undelete_task_group: "taskagent_undelete_task_group",
  list_secure_files: "taskagent_list_secure_files",
  get_secure_file: "taskagent_get_secure_file",
  update_secure_file: "taskagent_update_secure_file",
  delete_secure_file: "taskagent_delete_secure_file",
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

  const failed = (action: string, error: unknown) => ({
    content: [{ type: "text" as const, text: `Error ${action}: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });
  const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

  // ---- Agents in a pool (organization-scoped, so no project) ----

  registerTool(
    server,
    TASKAGENT_TOOLS.list_agents,
    "List the agents registered in an agent pool, with their status and version. Use taskagent_list_agent_pools to find the pool id.",
    {
      poolId: z.number().describe("The ID of the agent pool."),
      agentName: z.string().optional().describe("Return only the agent with this name."),
      includeCapabilities: z.boolean().default(false).describe("Include the agent's system and user capabilities. Verbose — ask for it only when matching demands."),
      includeAssignedRequest: z.boolean().default(false).describe("Include the job each agent is running right now."),
    },
    async ({ poolId, agentName, includeCapabilities, includeAssignedRequest }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const agents = await taskAgentApi.getAgents(poolId, agentName, includeCapabilities, includeAssignedRequest);
        return ok(agents);
      } catch (error) {
        return failed(`listing agents in pool ${poolId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.get_agent,
    "Get one agent in a pool.",
    {
      poolId: z.number().describe("The ID of the agent pool."),
      agentId: z.number().describe("The ID of the agent."),
      includeCapabilities: z.boolean().default(false).describe("Include the agent's system and user capabilities."),
      includeAssignedRequest: z.boolean().default(false).describe("Include the job the agent is running right now."),
      includeLastCompletedRequest: z.boolean().default(false).describe("Include the last job the agent finished."),
    },
    async ({ poolId, agentId, includeCapabilities, includeAssignedRequest, includeLastCompletedRequest }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const agent = await taskAgentApi.getAgent(poolId, agentId, includeCapabilities, includeAssignedRequest, includeLastCompletedRequest);
        return ok(agent);
      } catch (error) {
        return failed(`getting agent ${agentId} in pool ${poolId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.delete_agent,
    "Remove an agent from a pool. The machine keeps running; it just stops being offered jobs until it re-registers.",
    {
      poolId: z.number().describe("The ID of the agent pool."),
      agentId: z.number().describe("The ID of the agent to remove."),
    },
    async ({ poolId, agentId }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.deleteAgent(poolId, agentId);
        return ok({ removed: agentId, poolId });
      } catch (error) {
        return failed(`removing agent ${agentId} from pool ${poolId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.list_agent_requests,
    "List the job requests an agent has served — what it is running now and what it ran before. Use this to see why an agent looks busy or idle.",
    {
      poolId: z.number().describe("The ID of the agent pool."),
      agentId: z.number().describe("The ID of the agent."),
      completedRequestCount: z.number().optional().describe("How many finished jobs to include alongside the in-flight one."),
    },
    async ({ poolId, agentId, completedRequestCount }) => {
      try {
        const connection = await connectionProvider();
        const taskAgentApi = await connection.getTaskAgentApi();
        const requests = await taskAgentApi.getAgentRequestsForAgent(poolId, agentId, completedRequestCount);
        return ok(requests);
      } catch (error) {
        return failed(`listing job requests for agent ${agentId}`, error);
      }
    }
  );

  // ---- Task groups ----

  registerTool(
    server,
    TASKAGENT_TOOLS.list_task_groups,
    "List the task groups of a project — the reusable sequences of pipeline steps. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      expanded: z.boolean().default(false).describe("Include the tasks inside each group. Verbose; omit when you only need names and ids."),
      deleted: z.boolean().default(false).describe("List the deleted task groups in the recycle bin instead of the live ones."),
      top: z.number().optional().describe("Maximum number of task groups to return."),
    },
    async ({ project, expanded, deleted, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const groups = await taskAgentApi.getTaskGroups(ctx.project, undefined, expanded, undefined, deleted, top);
        return ok(groups);
      } catch (error) {
        return failed("listing task groups", error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.get_task_group,
    "Get one task group, including the tasks it runs. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      taskGroupId: z.string().describe("The GUID of the task group."),
      versionSpec: z.string().optional().describe("Which version to read, e.g. '1' or '1.*'. Omit for the latest."),
    },
    async ({ project, taskGroupId, versionSpec }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        // The typed client requires a version spec; "*" means the latest.
        const group = await taskAgentApi.getTaskGroup(ctx.project, taskGroupId, versionSpec ?? "*");
        return ok(group);
      } catch (error) {
        return failed(`getting task group ${taskGroupId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.delete_task_group,
    "Delete a task group. Every pipeline that still references it will fail to run until it is restored with taskagent_undelete_task_group or the reference is removed.",
    {
      project: projectField,
      taskGroupId: z.string().describe("The GUID of the task group to delete."),
      comment: z.string().optional().describe("Reason recorded against the deletion."),
    },
    async ({ project, taskGroupId, comment }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.deleteTaskGroup(ctx.project, taskGroupId, comment);
        return ok({ deleted: taskGroupId, note: "Recoverable with taskagent_undelete_task_group." });
      } catch (error) {
        return failed(`deleting task group ${taskGroupId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.undelete_task_group,
    "Restore a deleted task group from the recycle bin. List candidates with taskagent_list_task_groups and deleted=true.",
    {
      project: projectField,
      taskGroupId: z.string().describe("The GUID of the deleted task group to restore."),
    },
    async ({ project, taskGroupId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const restored = await taskAgentApi.undeleteTaskGroup({ id: taskGroupId }, ctx.project);
        return ok(restored);
      } catch (error) {
        return failed(`restoring task group ${taskGroupId}`, error);
      }
    }
  );

  // ---- Secure files ----
  //
  // Metadata only. The API can also hand out a download ticket and the file
  // content, but secure files are certificates, signing keys and keystores:
  // putting their bytes into the model's context would turn any prompt
  // injection into a key exfiltration. includeDownloadTickets stays false.

  registerTool(
    server,
    TASKAGENT_TOOLS.list_secure_files,
    "List the secure files of a project — their names, ids and properties. File contents are never returned: these are certificates and keys, so only metadata is exposed.",
    {
      project: projectField,
      namePattern: z.string().optional().describe("Return only files whose name matches this pattern."),
    },
    async ({ project, namePattern }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const files = await taskAgentApi.getSecureFiles(ctx.project, namePattern, false);
        return ok(files);
      } catch (error) {
        return failed("listing secure files", error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.get_secure_file,
    "Get one secure file's metadata. The file content is never returned.",
    {
      project: projectField,
      secureFileId: z.string().describe("The GUID of the secure file."),
    },
    async ({ project, secureFileId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const file = await taskAgentApi.getSecureFile(ctx.project, secureFileId, false);
        return ok(file);
      } catch (error) {
        return failed(`getting secure file ${secureFileId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.update_secure_file,
    "Rename a secure file. The stored content is not touched.",
    {
      project: projectField,
      secureFileId: z.string().describe("The GUID of the secure file."),
      name: z.string().describe("The new name for the file."),
    },
    async ({ project, secureFileId, name }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        const updated = await taskAgentApi.updateSecureFile({ id: secureFileId, name }, ctx.project, secureFileId);
        return ok(updated);
      } catch (error) {
        return failed(`renaming secure file ${secureFileId}`, error);
      }
    }
  );

  registerTool(
    server,
    TASKAGENT_TOOLS.delete_secure_file,
    "Delete a secure file permanently. There is no recycle bin for these, and any pipeline that consumes the file starts failing.",
    {
      project: projectField,
      secureFileId: z.string().describe("The GUID of the secure file to delete."),
    },
    async ({ project, secureFileId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const taskAgentApi = await connection.getTaskAgentApi();
        await taskAgentApi.deleteSecureFile(ctx.project, secureFileId);
        return ok({ deleted: secureFileId, note: "Permanent — secure files have no recycle bin." });
      } catch (error) {
        return failed(`deleting secure file ${secureFileId}`, error);
      }
    }
  );
}

export { TASKAGENT_TOOLS, configureTaskAgentTools };
