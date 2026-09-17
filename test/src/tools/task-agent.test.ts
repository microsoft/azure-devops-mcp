// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTaskAgentTools } from "../../../src/tools/task-agent";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface TaskAgentApiMock {
  getVariableGroups: jest.Mock;
  getVariableGroup: jest.Mock;
  addVariableGroup: jest.Mock;
  updateVariableGroup: jest.Mock;
  deleteVariableGroup: jest.Mock;
  shareVariableGroup: jest.Mock;
  getAgentPools: jest.Mock;
  getAgentQueues: jest.Mock;
  getEnvironments: jest.Mock;
  getEnvironmentById: jest.Mock;
  addEnvironment: jest.Mock;
  updateEnvironment: jest.Mock;
  deleteEnvironment: jest.Mock;
  getAgents: jest.Mock;
  getAgent: jest.Mock;
  deleteAgent: jest.Mock;
  getAgentRequestsForAgent: jest.Mock;
  getTaskGroups: jest.Mock;
  getTaskGroup: jest.Mock;
  deleteTaskGroup: jest.Mock;
  undeleteTaskGroup: jest.Mock;
  getSecureFiles: jest.Mock;
  getSecureFile: jest.Mock;
  updateSecureFile: jest.Mock;
  deleteSecureFile: jest.Mock;
}

describe("configureTaskAgentTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getTaskAgentApi: jest.Mock };
  let mockTaskAgentApi: TaskAgentApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockTaskAgentApi = {
      getVariableGroups: jest.fn(),
      getVariableGroup: jest.fn(),
      addVariableGroup: jest.fn(),
      updateVariableGroup: jest.fn(),
      deleteVariableGroup: jest.fn(),
      shareVariableGroup: jest.fn(),
      getAgentPools: jest.fn(),
      getAgentQueues: jest.fn(),
      getEnvironments: jest.fn(),
      getEnvironmentById: jest.fn(),
      addEnvironment: jest.fn(),
      updateEnvironment: jest.fn(),
      deleteEnvironment: jest.fn(),
      getAgents: jest.fn(),
      getAgent: jest.fn(),
      deleteAgent: jest.fn(),
      getAgentRequestsForAgent: jest.fn(),
      getTaskGroups: jest.fn(),
      getTaskGroup: jest.fn(),
      deleteTaskGroup: jest.fn(),
      undeleteTaskGroup: jest.fn(),
      getSecureFiles: jest.fn(),
      getSecureFile: jest.fn(),
      updateSecureFile: jest.fn(),
      deleteSecureFile: jest.fn(),
    };
    mockConnection = {
      getTaskAgentApi: jest.fn().mockResolvedValue(mockTaskAgentApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureTaskAgentTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers task agent tools on the server", () => {
      configureTaskAgentTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_variable_groups passes the name filter and top", async () => {
    const handler = getHandler("taskagent_list_variable_groups");
    mockTaskAgentApi.getVariableGroups.mockResolvedValue([{ id: 1, name: "shared" }]);

    const result = await handler({ project: "Proj", groupName: "shared", top: 10 });

    expect(mockTaskAgentApi.getVariableGroups).toHaveBeenCalledWith("Proj", "shared", undefined, 10);
    expect(result.content[0].text).toContain("shared");
  });

  it("list_variable_groups reports when none found", async () => {
    const handler = getHandler("taskagent_list_variable_groups");
    mockTaskAgentApi.getVariableGroups.mockResolvedValue([]);

    const result = await handler({ project: "Proj" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No variable groups found");
  });

  it("get_variable_group passes the group id", async () => {
    const handler = getHandler("taskagent_get_variable_group");
    mockTaskAgentApi.getVariableGroup.mockResolvedValue({ id: 5 });

    const result = await handler({ project: "Proj", groupId: 5 });

    expect(mockTaskAgentApi.getVariableGroup).toHaveBeenCalledWith("Proj", 5);
    expect(result.content[0].text).toContain('"id": 5');
  });

  it("add_variable_group passes the parameters", async () => {
    const handler = getHandler("taskagent_add_variable_group");
    mockTaskAgentApi.addVariableGroup.mockResolvedValue({ id: 9 });

    const variableGroup = { name: "shared", variables: { KEY: { value: "v" } }, variableGroupProjectReferences: [{ name: "shared", projectReference: { name: "Proj" } }] };
    const result = await handler({ variableGroup });

    expect(mockTaskAgentApi.addVariableGroup).toHaveBeenCalledWith(variableGroup);
    expect(result.content[0].text).toContain('"id": 9');
  });

  it("update_variable_group passes parameters and id", async () => {
    const handler = getHandler("taskagent_update_variable_group");
    mockTaskAgentApi.updateVariableGroup.mockResolvedValue({ id: 9, name: "updated" });

    const variableGroup = { name: "updated" };
    const result = await handler({ groupId: 9, variableGroup });

    expect(mockTaskAgentApi.updateVariableGroup).toHaveBeenCalledWith(variableGroup, 9);
    expect(result.content[0].text).toContain("updated");
  });

  it("delete_variable_group passes group id and project ids", async () => {
    const handler = getHandler("taskagent_delete_variable_group");
    mockTaskAgentApi.deleteVariableGroup.mockResolvedValue(undefined);

    const result = await handler({ groupId: 9, projectIds: ["p1", "p2"] });

    expect(mockTaskAgentApi.deleteVariableGroup).toHaveBeenCalledWith(9, ["p1", "p2"]);
    expect(result.content[0].text).toContain("Variable group 9 deleted");
  });

  it("share_variable_group passes references and id", async () => {
    const handler = getHandler("taskagent_share_variable_group");
    mockTaskAgentApi.shareVariableGroup.mockResolvedValue(undefined);

    const projectReferences = [{ name: "shared", projectReference: { name: "Other" } }];
    const result = await handler({ variableGroupId: 9, projectReferences });

    expect(mockTaskAgentApi.shareVariableGroup).toHaveBeenCalledWith(projectReferences, 9);
    expect(result.content[0].text).toContain("Variable group 9 shared");
  });

  it("list_agent_pools passes the name filter", async () => {
    const handler = getHandler("taskagent_list_agent_pools");
    mockTaskAgentApi.getAgentPools.mockResolvedValue([{ id: 1, name: "Default" }]);

    const result = await handler({ poolName: "Default" });

    expect(mockTaskAgentApi.getAgentPools).toHaveBeenCalledWith("Default");
    expect(result.content[0].text).toContain("Default");
  });

  it("list_agent_queues passes project and name", async () => {
    const handler = getHandler("taskagent_list_agent_queues");
    mockTaskAgentApi.getAgentQueues.mockResolvedValue([{ id: 1, name: "Queue" }]);

    const result = await handler({ project: "Proj", queueName: "Queue" });

    expect(mockTaskAgentApi.getAgentQueues).toHaveBeenCalledWith("Proj", "Queue");
    expect(result.content[0].text).toContain("Queue");
  });

  it("list_environments passes the name filter and top", async () => {
    const handler = getHandler("taskagent_list_environments");
    mockTaskAgentApi.getEnvironments.mockResolvedValue([{ id: 1, name: "prod" }]);

    const result = await handler({ project: "Proj", name: "prod", top: 5 });

    expect(mockTaskAgentApi.getEnvironments).toHaveBeenCalledWith("Proj", "prod", undefined, 5);
    expect(result.content[0].text).toContain("prod");
  });

  it("get_environment passes the environment id", async () => {
    const handler = getHandler("taskagent_get_environment");
    mockTaskAgentApi.getEnvironmentById.mockResolvedValue({ id: 3 });

    const result = await handler({ project: "Proj", environmentId: 3 });

    expect(mockTaskAgentApi.getEnvironmentById).toHaveBeenCalledWith("Proj", 3);
    expect(result.content[0].text).toContain('"id": 3');
  });

  it("add_environment builds the create parameter", async () => {
    const handler = getHandler("taskagent_add_environment");
    mockTaskAgentApi.addEnvironment.mockResolvedValue({ id: 4, name: "staging" });

    const result = await handler({ project: "Proj", name: "staging", description: "Staging env" });

    expect(mockTaskAgentApi.addEnvironment).toHaveBeenCalledWith({ name: "staging", description: "Staging env" }, "Proj");
    expect(result.content[0].text).toContain("staging");
  });

  it("update_environment builds the update parameter", async () => {
    const handler = getHandler("taskagent_update_environment");
    mockTaskAgentApi.updateEnvironment.mockResolvedValue({ id: 4, name: "renamed" });

    const result = await handler({ project: "Proj", environmentId: 4, name: "renamed" });

    expect(mockTaskAgentApi.updateEnvironment).toHaveBeenCalledWith({ name: "renamed", description: undefined }, "Proj", 4);
    expect(result.content[0].text).toContain("renamed");
  });

  it("delete_environment deletes by id", async () => {
    const handler = getHandler("taskagent_delete_environment");
    mockTaskAgentApi.deleteEnvironment.mockResolvedValue(undefined);

    const result = await handler({ project: "Proj", environmentId: 4 });

    expect(mockTaskAgentApi.deleteEnvironment).toHaveBeenCalledWith("Proj", 4);
    expect(result.content[0].text).toContain("Environment 4 deleted");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("taskagent_get_variable_group");
    mockTaskAgentApi.getVariableGroup.mockRejectedValue(new Error("boom"));

    const result = await handler({ project: "Proj", groupId: 1 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching variable group: boom");
  });
  describe("agents in a pool", () => {
    it("list_agents passes the name filter and the verbose flags", async () => {
      const handler = getHandler("taskagent_list_agents");
      mockTaskAgentApi.getAgents.mockResolvedValue([{ id: 7, name: "build-01", status: 2 }]);

      const result = await handler({ poolId: 3, agentName: "build-01", includeCapabilities: true, includeAssignedRequest: false });

      expect(mockTaskAgentApi.getAgents).toHaveBeenCalledWith(3, "build-01", true, false);
      expect(result.content[0].text).toContain("build-01");
    });

    it("get_agent asks for the last completed request when requested", async () => {
      const handler = getHandler("taskagent_get_agent");
      mockTaskAgentApi.getAgent.mockResolvedValue({ id: 7 });

      await handler({ poolId: 3, agentId: 7, includeCapabilities: false, includeAssignedRequest: true, includeLastCompletedRequest: true });

      expect(mockTaskAgentApi.getAgent).toHaveBeenCalledWith(3, 7, false, true, true);
    });

    it("delete_agent removes the agent from the pool", async () => {
      const handler = getHandler("taskagent_delete_agent");
      mockTaskAgentApi.deleteAgent.mockResolvedValue(undefined);

      const result = await handler({ poolId: 3, agentId: 7 });

      expect(mockTaskAgentApi.deleteAgent).toHaveBeenCalledWith(3, 7);
      expect(JSON.parse(result.content[0].text)).toEqual({ removed: 7, poolId: 3 });
    });

    it("list_agent_requests passes the completed count", async () => {
      const handler = getHandler("taskagent_list_agent_requests");
      mockTaskAgentApi.getAgentRequestsForAgent.mockResolvedValue([{ requestId: 99 }]);

      await handler({ poolId: 3, agentId: 7, completedRequestCount: 5 });

      expect(mockTaskAgentApi.getAgentRequestsForAgent).toHaveBeenCalledWith(3, 7, 5);
    });

    it("surfaces a pool that does not exist", async () => {
      const handler = getHandler("taskagent_list_agents");
      mockTaskAgentApi.getAgents.mockRejectedValue(new Error("pool not found"));

      const result = await handler({ poolId: 999, includeCapabilities: false, includeAssignedRequest: false });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("pool not found");
    });
  });

  describe("task groups", () => {
    it("list_task_groups maps expanded and deleted onto the right positions", async () => {
      const handler = getHandler("taskagent_list_task_groups");
      mockTaskAgentApi.getTaskGroups.mockResolvedValue([{ id: "g1" }]);

      await handler({ project: "Proj", expanded: true, deleted: false, top: 20 });

      expect(mockTaskAgentApi.getTaskGroups).toHaveBeenCalledWith("Proj", undefined, true, undefined, false, 20);
    });

    it("list_task_groups can read the recycle bin", async () => {
      const handler = getHandler("taskagent_list_task_groups");
      mockTaskAgentApi.getTaskGroups.mockResolvedValue([]);

      await handler({ project: "Proj", expanded: false, deleted: true });

      expect(mockTaskAgentApi.getTaskGroups).toHaveBeenCalledWith("Proj", undefined, false, undefined, true, undefined);
    });

    // The typed client has no optional version spec; "*" is the latest.
    it("get_task_group defaults the version spec to the latest", async () => {
      const handler = getHandler("taskagent_get_task_group");
      mockTaskAgentApi.getTaskGroup.mockResolvedValue({ id: "g1" });

      await handler({ project: "Proj", taskGroupId: "g1" });

      expect(mockTaskAgentApi.getTaskGroup).toHaveBeenCalledWith("Proj", "g1", "*");
    });

    it("get_task_group honours an explicit version spec", async () => {
      const handler = getHandler("taskagent_get_task_group");
      mockTaskAgentApi.getTaskGroup.mockResolvedValue({ id: "g1" });

      await handler({ project: "Proj", taskGroupId: "g1", versionSpec: "2.*" });

      expect(mockTaskAgentApi.getTaskGroup).toHaveBeenCalledWith("Proj", "g1", "2.*");
    });

    it("delete_task_group records the comment and says it is recoverable", async () => {
      const handler = getHandler("taskagent_delete_task_group");
      mockTaskAgentApi.deleteTaskGroup.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", taskGroupId: "g1", comment: "unused" });

      expect(mockTaskAgentApi.deleteTaskGroup).toHaveBeenCalledWith("Proj", "g1", "unused");
      expect(result.content[0].text).toContain("undelete_task_group");
    });

    it("undelete_task_group restores by id", async () => {
      const handler = getHandler("taskagent_undelete_task_group");
      mockTaskAgentApi.undeleteTaskGroup.mockResolvedValue([{ id: "g1" }]);

      const result = await handler({ project: "Proj", taskGroupId: "g1" });

      expect(mockTaskAgentApi.undeleteTaskGroup).toHaveBeenCalledWith({ id: "g1" }, "Proj");
      expect(result.content[0].text).toContain("g1");
    });
  });

  describe("secure files", () => {
    // These are certificates and signing keys: a download ticket is a
    // credential, so the tools must never ask the API for one.
    it("list_secure_files never requests download tickets", async () => {
      const handler = getHandler("taskagent_list_secure_files");
      mockTaskAgentApi.getSecureFiles.mockResolvedValue([{ id: "f1", name: "signing.p12" }]);

      const result = await handler({ project: "Proj", namePattern: "signing" });

      expect(mockTaskAgentApi.getSecureFiles).toHaveBeenCalledWith("Proj", "signing", false);
      expect(result.content[0].text).not.toContain("ticket");
    });

    it("get_secure_file never requests a download ticket", async () => {
      const handler = getHandler("taskagent_get_secure_file");
      mockTaskAgentApi.getSecureFile.mockResolvedValue({ id: "f1" });

      await handler({ project: "Proj", secureFileId: "f1" });

      expect(mockTaskAgentApi.getSecureFile).toHaveBeenCalledWith("Proj", "f1", false);
    });

    it("update_secure_file renames without touching the content", async () => {
      const handler = getHandler("taskagent_update_secure_file");
      mockTaskAgentApi.updateSecureFile.mockResolvedValue({ id: "f1", name: "renamed.p12" });

      await handler({ project: "Proj", secureFileId: "f1", name: "renamed.p12" });

      expect(mockTaskAgentApi.updateSecureFile).toHaveBeenCalledWith({ id: "f1", name: "renamed.p12" }, "Proj", "f1");
    });

    it("delete_secure_file warns that there is no recycle bin", async () => {
      const handler = getHandler("taskagent_delete_secure_file");
      mockTaskAgentApi.deleteSecureFile.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", secureFileId: "f1" });

      expect(mockTaskAgentApi.deleteSecureFile).toHaveBeenCalledWith("Proj", "f1");
      expect(result.content[0].text).toContain("no recycle bin");
    });

    it("surfaces a refused deletion", async () => {
      const handler = getHandler("taskagent_delete_secure_file");
      mockTaskAgentApi.deleteSecureFile.mockRejectedValue(new Error("in use by a pipeline"));

      const result = await handler({ project: "Proj", secureFileId: "f1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("in use by a pipeline");
    });
  });
});
