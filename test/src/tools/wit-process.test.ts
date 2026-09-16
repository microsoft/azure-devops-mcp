// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureWitProcessTools } from "../../../src/tools/wit-process";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface ProcessApiMock {
  getListOfProcesses: jest.Mock;
  getProcessByItsId: jest.Mock;
  getProcessWorkItemTypes: jest.Mock;
  getProcessWorkItemType: jest.Mock;
  getAllWorkItemTypeFields: jest.Mock;
  getStateDefinitions: jest.Mock;
  getStateDefinition: jest.Mock;
  getProcessBehaviors: jest.Mock;
  getProcessBehavior: jest.Mock;
  createNewProcess: jest.Mock;
  createProcessWorkItemType: jest.Mock;
  addFieldToWorkItemType: jest.Mock;
  createStateDefinition: jest.Mock;
  editProcess: jest.Mock;
  deleteProcessById: jest.Mock;
  updateProcessWorkItemType: jest.Mock;
  deleteProcessWorkItemType: jest.Mock;
  updateWorkItemTypeField: jest.Mock;
  removeWorkItemTypeField: jest.Mock;
  updateStateDefinition: jest.Mock;
  deleteStateDefinition: jest.Mock;
  hideStateDefinition: jest.Mock;
  createProcessBehavior: jest.Mock;
  updateProcessBehavior: jest.Mock;
  deleteProcessBehavior: jest.Mock;
  addBehaviorToWorkItemType: jest.Mock;
  removeBehaviorFromWorkItemType: jest.Mock;
  getProcessWorkItemTypeRules: jest.Mock;
  getProcessWorkItemTypeRule: jest.Mock;
  addProcessWorkItemTypeRule: jest.Mock;
  updateProcessWorkItemTypeRule: jest.Mock;
  deleteProcessWorkItemTypeRule: jest.Mock;
  getListsMetadata: jest.Mock;
  getList: jest.Mock;
  createList: jest.Mock;
  updateList: jest.Mock;
  deleteList: jest.Mock;
}

describe("configureWitProcessTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getWorkItemTrackingProcessApi: jest.Mock };
  let mockProcessApi: ProcessApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockProcessApi = {
      getListOfProcesses: jest.fn(),
      getProcessByItsId: jest.fn(),
      getProcessWorkItemTypes: jest.fn(),
      getProcessWorkItemType: jest.fn(),
      getAllWorkItemTypeFields: jest.fn(),
      getStateDefinitions: jest.fn(),
      getStateDefinition: jest.fn(),
      getProcessBehaviors: jest.fn(),
      getProcessBehavior: jest.fn(),
      createNewProcess: jest.fn(),
      createProcessWorkItemType: jest.fn(),
      addFieldToWorkItemType: jest.fn(),
      createStateDefinition: jest.fn(),
      editProcess: jest.fn(),
      deleteProcessById: jest.fn(),
      updateProcessWorkItemType: jest.fn(),
      deleteProcessWorkItemType: jest.fn(),
      updateWorkItemTypeField: jest.fn(),
      removeWorkItemTypeField: jest.fn(),
      updateStateDefinition: jest.fn(),
      deleteStateDefinition: jest.fn(),
      hideStateDefinition: jest.fn(),
      createProcessBehavior: jest.fn(),
      updateProcessBehavior: jest.fn(),
      deleteProcessBehavior: jest.fn(),
      addBehaviorToWorkItemType: jest.fn(),
      removeBehaviorFromWorkItemType: jest.fn(),
      getProcessWorkItemTypeRules: jest.fn(),
      getProcessWorkItemTypeRule: jest.fn(),
      addProcessWorkItemTypeRule: jest.fn(),
      updateProcessWorkItemTypeRule: jest.fn(),
      deleteProcessWorkItemTypeRule: jest.fn(),
      getListsMetadata: jest.fn(),
      getList: jest.fn(),
      createList: jest.fn(),
      updateList: jest.fn(),
      deleteList: jest.fn(),
    };
    mockConnection = {
      getWorkItemTrackingProcessApi: jest.fn().mockResolvedValue(mockProcessApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureWitProcessTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers wit process tools on the server", () => {
      configureWitProcessTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_processes maps includeProjects to the expand level (=> 1)", async () => {
    const handler = getHandler("witprocess_list_processes");
    mockProcessApi.getListOfProcesses.mockResolvedValue([{ typeId: "p1", name: "Agile" }]);

    const result = await handler({ includeProjects: true });

    expect(mockProcessApi.getListOfProcesses).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("Agile");
  });

  it("list_processes omits the expand level when includeProjects is not set", async () => {
    const handler = getHandler("witprocess_list_processes");
    mockProcessApi.getListOfProcesses.mockResolvedValue([{ typeId: "p1" }]);

    await handler({});

    expect(mockProcessApi.getListOfProcesses).toHaveBeenCalledWith(undefined);
  });

  it("list_processes reports when none found", async () => {
    const handler = getHandler("witprocess_list_processes");
    mockProcessApi.getListOfProcesses.mockResolvedValue([]);

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No processes found");
  });

  it("get_process passes the type id", async () => {
    const handler = getHandler("witprocess_get_process");
    mockProcessApi.getProcessByItsId.mockResolvedValue({ typeId: "p1" });

    const result = await handler({ processTypeId: "p1" });

    expect(mockProcessApi.getProcessByItsId).toHaveBeenCalledWith("p1", undefined);
    expect(result.content[0].text).toContain("p1");
  });

  it("list_work_item_types maps the expand (states => 1)", async () => {
    const handler = getHandler("witprocess_list_work_item_types");
    mockProcessApi.getProcessWorkItemTypes.mockResolvedValue([{ referenceName: "Agile.UserStory" }]);

    const result = await handler({ processId: "p1", expand: "states" });

    expect(mockProcessApi.getProcessWorkItemTypes).toHaveBeenCalledWith("p1", 1);
    expect(result.content[0].text).toContain("Agile.UserStory");
  });

  it("get_work_item_type maps the expand (layout => 4)", async () => {
    const handler = getHandler("witprocess_get_work_item_type");
    mockProcessApi.getProcessWorkItemType.mockResolvedValue({ referenceName: "Agile.Bug" });

    const result = await handler({ processId: "p1", witRefName: "Agile.Bug", expand: "layout" });

    expect(mockProcessApi.getProcessWorkItemType).toHaveBeenCalledWith("p1", "Agile.Bug", 4);
    expect(result.content[0].text).toContain("Agile.Bug");
  });

  it("list_work_item_type_fields passes process and wit", async () => {
    const handler = getHandler("witprocess_list_work_item_type_fields");
    mockProcessApi.getAllWorkItemTypeFields.mockResolvedValue([{ referenceName: "System.Title" }]);

    const result = await handler({ processId: "p1", witRefName: "Agile.UserStory" });

    expect(mockProcessApi.getAllWorkItemTypeFields).toHaveBeenCalledWith("p1", "Agile.UserStory");
    expect(result.content[0].text).toContain("System.Title");
  });

  it("list_states passes process and wit", async () => {
    const handler = getHandler("witprocess_list_states");
    mockProcessApi.getStateDefinitions.mockResolvedValue([{ name: "Active" }]);

    const result = await handler({ processId: "p1", witRefName: "Agile.UserStory" });

    expect(mockProcessApi.getStateDefinitions).toHaveBeenCalledWith("p1", "Agile.UserStory");
    expect(result.content[0].text).toContain("Active");
  });

  it("get_state passes the state id", async () => {
    const handler = getHandler("witprocess_get_state");
    mockProcessApi.getStateDefinition.mockResolvedValue({ id: "s1", name: "Done" });

    const result = await handler({ processId: "p1", witRefName: "Agile.UserStory", stateId: "s1" });

    expect(mockProcessApi.getStateDefinition).toHaveBeenCalledWith("p1", "Agile.UserStory", "s1");
    expect(result.content[0].text).toContain("Done");
  });

  it("list_behaviors passes the process id", async () => {
    const handler = getHandler("witprocess_list_behaviors");
    mockProcessApi.getProcessBehaviors.mockResolvedValue([{ referenceName: "System.PortfolioBehavior" }]);

    const result = await handler({ processId: "p1" });

    expect(mockProcessApi.getProcessBehaviors).toHaveBeenCalledWith("p1");
    expect(result.content[0].text).toContain("System.PortfolioBehavior");
  });

  it("get_behavior passes the behavior ref name", async () => {
    const handler = getHandler("witprocess_get_behavior");
    mockProcessApi.getProcessBehavior.mockResolvedValue({ referenceName: "System.PortfolioBehavior" });

    const result = await handler({ processId: "p1", behaviorRefName: "System.PortfolioBehavior" });

    expect(mockProcessApi.getProcessBehavior).toHaveBeenCalledWith("p1", "System.PortfolioBehavior");
    expect(result.content[0].text).toContain("System.PortfolioBehavior");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("witprocess_get_process");
    mockProcessApi.getProcessByItsId.mockRejectedValue(new Error("boom"));

    const result = await handler({ processTypeId: "p1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching process: boom");
  });

  describe("process write tools", () => {
    it("create_process creates an inherited process", async () => {
      const handler = getHandler("witprocess_create_process");
      mockProcessApi.createNewProcess.mockResolvedValue({ typeId: "new" });

      await handler({ name: "My Agile", parentProcessTypeId: "adcc42ab-9882-485e-a3ed-7678f01f66bc", description: "d" });

      expect(mockProcessApi.createNewProcess).toHaveBeenCalledWith({ name: "My Agile", parentProcessTypeId: "adcc42ab-9882-485e-a3ed-7678f01f66bc", description: "d", referenceName: undefined });
    });

    it("create_work_item_type creates a WIT in a process", async () => {
      const handler = getHandler("witprocess_create_work_item_type");
      mockProcessApi.createProcessWorkItemType.mockResolvedValue({ referenceName: "My.Bug" });

      await handler({ processId: "proc-1", name: "Bug", inheritsFrom: "Microsoft.VSTS.WorkItemTypes.Bug" });

      expect(mockProcessApi.createProcessWorkItemType).toHaveBeenCalledWith(
        { name: "Bug", description: undefined, color: undefined, icon: undefined, inheritsFrom: "Microsoft.VSTS.WorkItemTypes.Bug", isDisabled: undefined },
        "proc-1"
      );
    });

    it("add_field_to_work_item_type adds a field", async () => {
      const handler = getHandler("witprocess_add_field_to_work_item_type");
      mockProcessApi.addFieldToWorkItemType.mockResolvedValue({ referenceName: "Custom.X" });

      await handler({ processId: "proc-1", witRefName: "My.Bug", referenceName: "Custom.X", required: true });

      expect(mockProcessApi.addFieldToWorkItemType).toHaveBeenCalledWith(
        { referenceName: "Custom.X", required: true, readOnly: undefined, allowGroups: undefined, defaultValue: undefined, allowedValues: undefined },
        "proc-1",
        "My.Bug"
      );
    });

    it("create_state creates a workflow state", async () => {
      const handler = getHandler("witprocess_create_state");
      mockProcessApi.createStateDefinition.mockResolvedValue({ id: "s1" });

      await handler({ processId: "proc-1", witRefName: "My.Bug", name: "Triaged", stateCategory: "InProgress", color: "b2b2b2" });

      expect(mockProcessApi.createStateDefinition).toHaveBeenCalledWith({ name: "Triaged", stateCategory: "InProgress", color: "b2b2b2", order: undefined }, "proc-1", "My.Bug");
    });

    it("create_process surfaces errors", async () => {
      const handler = getHandler("witprocess_create_process");
      mockProcessApi.createNewProcess.mockRejectedValue(new Error("denied"));

      const result = await handler({ name: "x", parentProcessTypeId: "p" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating process: denied");
    });
  });

  describe("process customization writes", () => {
    it("update_process sends only the process fields", async () => {
      const handler = getHandler("witprocess_update_process");
      mockProcessApi.editProcess.mockResolvedValue({ typeId: "p1", name: "Renamed" });

      const result = await handler({ processId: "p1", name: "Renamed", isDefault: true });

      expect(mockProcessApi.editProcess).toHaveBeenCalledWith({ name: "Renamed", description: undefined, isEnabled: undefined, isDefault: true }, "p1");
      expect(result.content[0].text).toContain("Renamed");
    });

    it("delete_process confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_process");
      mockProcessApi.deleteProcessById.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1" });

      expect(mockProcessApi.deleteProcessById).toHaveBeenCalledWith("p1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("update_work_item_type passes the type properties", async () => {
      const handler = getHandler("witprocess_update_work_item_type");
      mockProcessApi.updateProcessWorkItemType.mockResolvedValue({ referenceName: "MyProcess.Bug" });

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", isDisabled: true, color: "f6546a" });

      expect(mockProcessApi.updateProcessWorkItemType).toHaveBeenCalledWith({ description: undefined, color: "f6546a", icon: undefined, isDisabled: true }, "p1", "MyProcess.Bug");
    });

    it("delete_work_item_type confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_work_item_type");
      mockProcessApi.deleteProcessWorkItemType.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug" });

      expect(mockProcessApi.deleteProcessWorkItemType).toHaveBeenCalledWith("p1", "MyProcess.Bug");
      expect(result.content[0].text).toContain("deleted");
    });

    it("update_work_item_type_field sends the field constraints", async () => {
      const handler = getHandler("witprocess_update_work_item_type_field");
      mockProcessApi.updateWorkItemTypeField.mockResolvedValue({ referenceName: "Custom.Severity" });

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", fieldRefName: "Custom.Severity", required: true, allowedValues: ["High", "Low"] });

      expect(mockProcessApi.updateWorkItemTypeField).toHaveBeenCalledWith(
        { required: true, readOnly: undefined, defaultValue: undefined, allowedValues: ["High", "Low"], allowGroups: undefined },
        "p1",
        "MyProcess.Bug",
        "Custom.Severity"
      );
    });

    it("remove_work_item_type_field confirms the removal", async () => {
      const handler = getHandler("witprocess_remove_work_item_type_field");
      mockProcessApi.removeWorkItemTypeField.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug", fieldRefName: "Custom.Severity" });

      expect(mockProcessApi.removeWorkItemTypeField).toHaveBeenCalledWith("p1", "MyProcess.Bug", "Custom.Severity");
      expect(result.content[0].text).toContain("removed");
    });

    it("update_state passes the state model", async () => {
      const handler = getHandler("witprocess_update_state");
      mockProcessApi.updateStateDefinition.mockResolvedValue({ id: "s1" });

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", stateId: "s1", name: "Triaged", stateCategory: "InProgress" });

      expect(mockProcessApi.updateStateDefinition).toHaveBeenCalledWith({ name: "Triaged", color: undefined, stateCategory: "InProgress", order: undefined }, "p1", "MyProcess.Bug", "s1");
    });

    it("delete_state confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_state");
      mockProcessApi.deleteStateDefinition.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug", stateId: "s1" });

      expect(mockProcessApi.deleteStateDefinition).toHaveBeenCalledWith("p1", "MyProcess.Bug", "s1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("hide_state hides by default and can unhide", async () => {
      const handler = getHandler("witprocess_hide_state");
      mockProcessApi.hideStateDefinition.mockResolvedValue({ id: "s1", hidden: true });

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", stateId: "s1", hidden: true });
      expect(mockProcessApi.hideStateDefinition).toHaveBeenCalledWith({ hidden: true }, "p1", "MyProcess.Bug", "s1");

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", stateId: "s1", hidden: false });
      expect(mockProcessApi.hideStateDefinition).toHaveBeenLastCalledWith({ hidden: false }, "p1", "MyProcess.Bug", "s1");
    });

    it("create_behavior sends the behavior definition", async () => {
      const handler = getHandler("witprocess_create_behavior");
      mockProcessApi.createProcessBehavior.mockResolvedValue({ referenceName: "Custom.Backlog" });

      await handler({ processId: "p1", name: "Custom backlog", inherits: "System.RequirementBacklogBehavior" });

      expect(mockProcessApi.createProcessBehavior).toHaveBeenCalledWith({ name: "Custom backlog", referenceName: undefined, inherits: "System.RequirementBacklogBehavior", color: undefined }, "p1");
    });

    it("update_behavior sends name and colour only", async () => {
      const handler = getHandler("witprocess_update_behavior");
      mockProcessApi.updateProcessBehavior.mockResolvedValue({ referenceName: "Custom.Backlog" });

      await handler({ processId: "p1", behaviorRefName: "Custom.Backlog", name: "Renamed" });

      expect(mockProcessApi.updateProcessBehavior).toHaveBeenCalledWith({ name: "Renamed", color: undefined }, "p1", "Custom.Backlog");
    });

    it("delete_behavior confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_behavior");
      mockProcessApi.deleteProcessBehavior.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", behaviorRefName: "Custom.Backlog" });

      expect(mockProcessApi.deleteProcessBehavior).toHaveBeenCalledWith("p1", "Custom.Backlog");
      expect(result.content[0].text).toContain("deleted");
    });

    it("add_behavior_to_work_item_type wraps the reference name as a behavior reference", async () => {
      const handler = getHandler("witprocess_add_behavior_to_work_item_type");
      mockProcessApi.addBehaviorToWorkItemType.mockResolvedValue({ behavior: { id: "Custom.Backlog" } });

      await handler({ processId: "p1", witRefName: "MyProcess.Bug", behaviorRefName: "Custom.Backlog", isDefault: true });

      expect(mockProcessApi.addBehaviorToWorkItemType).toHaveBeenCalledWith({ behavior: { id: "Custom.Backlog" }, isDefault: true }, "p1", "MyProcess.Bug");
    });

    it("remove_behavior_from_wit confirms the removal", async () => {
      const handler = getHandler("witprocess_remove_behavior_from_wit");
      mockProcessApi.removeBehaviorFromWorkItemType.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug", behaviorRefName: "Custom.Backlog" });

      expect(mockProcessApi.removeBehaviorFromWorkItemType).toHaveBeenCalledWith("p1", "MyProcess.Bug", "Custom.Backlog");
      expect(result.content[0].text).toContain("removed");
    });

    it("list_rules returns the rules of a type", async () => {
      const handler = getHandler("witprocess_list_rules");
      mockProcessApi.getProcessWorkItemTypeRules.mockResolvedValue([{ id: "r1", name: "Require resolution" }]);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug" });

      expect(mockProcessApi.getProcessWorkItemTypeRules).toHaveBeenCalledWith("p1", "MyProcess.Bug");
      expect(result.content[0].text).toContain("Require resolution");
    });

    it("get_rule reports a missing rule as an error", async () => {
      const handler = getHandler("witprocess_get_rule");
      mockProcessApi.getProcessWorkItemTypeRule.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug", ruleId: "nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("create_rule converts condition and action keywords to the SDK enums", async () => {
      const handler = getHandler("witprocess_create_rule");
      mockProcessApi.addProcessWorkItemTypeRule.mockResolvedValue({ id: "r1" });

      await handler({
        processId: "p1",
        witRefName: "MyProcess.Bug",
        name: "Require resolution when closed",
        conditions: [{ conditionType: "When", field: "System.State", value: "Closed" }],
        actions: [{ actionType: "MakeRequired", targetField: "Custom.Resolution" }],
      });

      // RuleConditionType.When === 1, RuleActionType.MakeRequired === 1
      expect(mockProcessApi.addProcessWorkItemTypeRule).toHaveBeenCalledWith(
        {
          name: "Require resolution when closed",
          isDisabled: undefined,
          conditions: [{ conditionType: 1, field: "System.State", value: "Closed" }],
          actions: [{ actionType: 1, targetField: "Custom.Resolution" }],
        },
        "p1",
        "MyProcess.Bug"
      );
    });

    it("update_rule carries the rule id in the body and the path", async () => {
      const handler = getHandler("witprocess_update_rule");
      mockProcessApi.updateProcessWorkItemTypeRule.mockResolvedValue({ id: "r1" });

      await handler({
        processId: "p1",
        witRefName: "MyProcess.Bug",
        ruleId: "r1",
        name: "Updated",
        conditions: [{ conditionType: "WhenChanged", field: "System.State" }],
        actions: [{ actionType: "MakeReadOnly", targetField: "Custom.Resolution" }],
      });

      const [body, processId, witRefName, ruleId] = mockProcessApi.updateProcessWorkItemTypeRule.mock.calls[0];
      expect(body).toMatchObject({ id: "r1", name: "Updated" });
      expect(processId).toBe("p1");
      expect(witRefName).toBe("MyProcess.Bug");
      expect(ruleId).toBe("r1");
    });

    it("delete_rule confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_rule");
      mockProcessApi.deleteProcessWorkItemTypeRule.mockResolvedValue(undefined);

      const result = await handler({ processId: "p1", witRefName: "MyProcess.Bug", ruleId: "r1" });

      expect(mockProcessApi.deleteProcessWorkItemTypeRule).toHaveBeenCalledWith("p1", "MyProcess.Bug", "r1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("list_picklists returns the organization's lists", async () => {
      const handler = getHandler("witprocess_list_picklists");
      mockProcessApi.getListsMetadata.mockResolvedValue([{ id: "l1", name: "Severity" }]);

      const result = await handler({});

      expect(mockProcessApi.getListsMetadata).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Severity");
    });

    it("get_picklist reports a missing list as an error", async () => {
      const handler = getHandler("witprocess_get_picklist");
      mockProcessApi.getList.mockResolvedValue(undefined);

      const result = await handler({ listId: "nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("create_picklist sends the items", async () => {
      const handler = getHandler("witprocess_create_picklist");
      mockProcessApi.createList.mockResolvedValue({ id: "l1" });

      await handler({ name: "Severity", items: ["High", "Low"], type: "String" });

      expect(mockProcessApi.createList).toHaveBeenCalledWith({ name: "Severity", items: ["High", "Low"], type: "String", isSuggested: undefined });
    });

    it("update_picklist replaces the whole list", async () => {
      const handler = getHandler("witprocess_update_picklist");
      mockProcessApi.updateList.mockResolvedValue({ id: "l1" });

      await handler({ listId: "l1", name: "Severity", items: ["High"], type: "String" });

      expect(mockProcessApi.updateList).toHaveBeenCalledWith({ id: "l1", name: "Severity", items: ["High"], type: "String", isSuggested: undefined }, "l1");
    });

    it("delete_picklist confirms the deletion", async () => {
      const handler = getHandler("witprocess_delete_picklist");
      mockProcessApi.deleteList.mockResolvedValue(undefined);

      const result = await handler({ listId: "l1" });

      expect(mockProcessApi.deleteList).toHaveBeenCalledWith("l1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("surfaces API failures as error results", async () => {
      const handler = getHandler("witprocess_create_rule");
      mockProcessApi.addProcessWorkItemTypeRule.mockRejectedValue(new Error("VS403072: process is not inherited"));

      const result = await handler({ processId: "p1", witRefName: "Agile.Bug", name: "x", conditions: [], actions: [] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating rule: VS403072: process is not inherited");
    });
  });
});
