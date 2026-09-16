// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { GetProcessExpandLevel, GetWorkItemTypeExpand, RuleActionType, RuleConditionType } from "azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces.js";
import { getEnumKeys, safeEnumConvert } from "../utils.js";

const WIT_PROCESS_TOOLS = {
  list_processes: "witprocess_list_processes",
  get_process: "witprocess_get_process",
  list_work_item_types: "witprocess_list_work_item_types",
  get_work_item_type: "witprocess_get_work_item_type",
  list_work_item_type_fields: "witprocess_list_work_item_type_fields",
  list_states: "witprocess_list_states",
  get_state: "witprocess_get_state",
  list_behaviors: "witprocess_list_behaviors",
  get_behavior: "witprocess_get_behavior",
  create_process: "witprocess_create_process",
  create_work_item_type: "witprocess_create_work_item_type",
  add_field_to_work_item_type: "witprocess_add_field_to_work_item_type",
  create_state: "witprocess_create_state",
  update_process: "witprocess_update_process",
  delete_process: "witprocess_delete_process",
  update_work_item_type: "witprocess_update_work_item_type",
  delete_work_item_type: "witprocess_delete_work_item_type",
  update_work_item_type_field: "witprocess_update_work_item_type_field",
  remove_work_item_type_field: "witprocess_remove_work_item_type_field",
  update_state: "witprocess_update_state",
  delete_state: "witprocess_delete_state",
  hide_state: "witprocess_hide_state",
  create_behavior: "witprocess_create_behavior",
  update_behavior: "witprocess_update_behavior",
  delete_behavior: "witprocess_delete_behavior",
  add_behavior_to_work_item_type: "witprocess_add_behavior_to_work_item_type",
  remove_behavior_from_work_item_type: "witprocess_remove_behavior_from_wit",
  list_rules: "witprocess_list_rules",
  get_rule: "witprocess_get_rule",
  create_rule: "witprocess_create_rule",
  update_rule: "witprocess_update_rule",
  delete_rule: "witprocess_delete_rule",
  list_picklists: "witprocess_list_picklists",
  get_picklist: "witprocess_get_picklist",
  create_picklist: "witprocess_create_picklist",
  update_picklist: "witprocess_update_picklist",
  delete_picklist: "witprocess_delete_picklist",
};

const WORK_ITEM_TYPE_EXPAND_MAP: Record<string, GetWorkItemTypeExpand> = {
  none: GetWorkItemTypeExpand.None,
  states: GetWorkItemTypeExpand.States,
  behaviors: GetWorkItemTypeExpand.Behaviors,
  layout: GetWorkItemTypeExpand.Layout,
};

function configureWitProcessTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_processes,
    "List the processes (e.g. Agile, Scrum, Basic and inherited processes) in the organization.",
    {
      includeProjects: z.boolean().optional().describe("Whether to include the projects using each process. Defaults to false."),
    },
    async ({ includeProjects }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const processes = await processApi.getListOfProcesses(includeProjects ? GetProcessExpandLevel.Projects : undefined);

        if (!processes || processes.length === 0) {
          return { content: [{ type: "text", text: "No processes found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(processes, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching processes: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_process,
    "Get a specific process by its type ID.",
    {
      processTypeId: z.string().describe("The type ID (GUID) of the process. Use witprocess_list_processes to discover IDs."),
      includeProjects: z.boolean().optional().describe("Whether to include the projects using the process. Defaults to false."),
    },
    async ({ processTypeId, includeProjects }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const process = await processApi.getProcessByItsId(processTypeId, includeProjects ? GetProcessExpandLevel.Projects : undefined);

        return { content: [{ type: "text", text: JSON.stringify(process, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching process: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_work_item_types,
    "List the work item types defined in a process.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      expand: z.enum(["none", "states", "behaviors", "layout"]).optional().describe("Optional detail to expand for each work item type."),
    },
    async ({ processId, expand }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const workItemTypes = await processApi.getProcessWorkItemTypes(processId, expand ? WORK_ITEM_TYPE_EXPAND_MAP[expand] : undefined);

        if (!workItemTypes || workItemTypes.length === 0) {
          return { content: [{ type: "text", text: "No work item types found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(workItemTypes, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item types: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_work_item_type,
    "Get a specific work item type in a process by its reference name.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      witRefName: z.string().describe("The reference name of the work item type (e.g. 'Agile.UserStory' or 'Microsoft.VSTS.WorkItemTypes.Bug')."),
      expand: z.enum(["none", "states", "behaviors", "layout"]).optional().describe("Optional detail to expand for the work item type."),
    },
    async ({ processId, witRefName, expand }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const workItemType = await processApi.getProcessWorkItemType(processId, witRefName, expand ? WORK_ITEM_TYPE_EXPAND_MAP[expand] : undefined);

        return { content: [{ type: "text", text: JSON.stringify(workItemType, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_work_item_type_fields,
    "List the fields of a work item type in a process.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      witRefName: z.string().describe("The reference name of the work item type."),
    },
    async ({ processId, witRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const fields = await processApi.getAllWorkItemTypeFields(processId, witRefName);

        if (!fields || fields.length === 0) {
          return { content: [{ type: "text", text: "No fields found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(fields, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching work item type fields: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_states,
    "List the state definitions of a work item type in a process.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      witRefName: z.string().describe("The reference name of the work item type."),
    },
    async ({ processId, witRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const states = await processApi.getStateDefinitions(processId, witRefName);

        if (!states || states.length === 0) {
          return { content: [{ type: "text", text: "No state definitions found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(states, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching state definitions: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_state,
    "Get a specific state definition of a work item type in a process.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      witRefName: z.string().describe("The reference name of the work item type."),
      stateId: z.string().describe("The ID of the state definition."),
    },
    async ({ processId, witRefName, stateId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const state = await processApi.getStateDefinition(processId, witRefName, stateId);

        return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching state definition: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_behaviors,
    "List the behaviors defined in a process.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
    },
    async ({ processId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const behaviors = await processApi.getProcessBehaviors(processId);

        if (!behaviors || behaviors.length === 0) {
          return { content: [{ type: "text", text: "No behaviors found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(behaviors, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching behaviors: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_behavior,
    "Get a specific behavior in a process by its reference name.",
    {
      processId: z.string().describe("The ID (GUID) of the process."),
      behaviorRefName: z.string().describe("The reference name of the behavior."),
    },
    async ({ processId, behaviorRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const behavior = await processApi.getProcessBehavior(processId, behaviorRefName);

        return { content: [{ type: "text", text: JSON.stringify(behavior, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching behavior: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_process,
    "Create a new inherited process derived from a system process (Agile, Scrum, Basic, or CMMI).",
    {
      name: z.string().describe("The name of the new process."),
      parentProcessTypeId: z.string().describe("The ID of the parent (system) process to inherit from. Use witprocess_list_processes to find it."),
      description: z.string().optional().describe("An optional description for the process."),
      referenceName: z.string().optional().describe("An optional reference name for the process."),
    },
    async ({ name, parentProcessTypeId, description, referenceName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const process = await processApi.createNewProcess({ name, parentProcessTypeId, description, referenceName });

        return { content: [{ type: "text", text: JSON.stringify(process, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating process: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_work_item_type,
    "Create a new work item type in an inherited process, optionally inheriting from an existing type.",
    {
      processId: z.string().describe("The ID of the (inherited) process."),
      name: z.string().describe("The name of the work item type."),
      description: z.string().optional().describe("An optional description."),
      color: z.string().optional().describe("The color of the work item type as a hex string without '#', e.g. 'f6546a'."),
      icon: z.string().optional().describe("The icon identifier, e.g. 'icon_book'."),
      inheritsFrom: z.string().optional().describe("The reference name of an existing work item type to inherit from. Omit to create a new type."),
      isDisabled: z.boolean().optional().describe("Whether the work item type is disabled."),
    },
    async ({ processId, name, description, color, icon, inheritsFrom, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const workItemType = await processApi.createProcessWorkItemType({ name, description, color, icon, inheritsFrom, isDisabled }, processId);

        return { content: [{ type: "text", text: JSON.stringify(workItemType, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.add_field_to_work_item_type,
    "Add a field to a work item type in an inherited process.",
    {
      processId: z.string().describe("The ID of the (inherited) process."),
      witRefName: z.string().describe("The reference name of the work item type, e.g. 'MyProcess.Bug'."),
      referenceName: z.string().describe("The reference name of the field to add, e.g. 'Custom.MyField'."),
      required: z.boolean().optional().describe("Whether the field is required."),
      readOnly: z.boolean().optional().describe("Whether the field is read-only."),
      allowGroups: z.boolean().optional().describe("Whether groups are allowed for an identity field."),
      defaultValue: z.string().optional().describe("The default value for the field."),
      allowedValues: z.array(z.string()).optional().describe("The list of allowed (picklist) values for the field."),
    },
    async ({ processId, witRefName, referenceName, required, readOnly, allowGroups, defaultValue, allowedValues }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const field = await processApi.addFieldToWorkItemType({ referenceName, required, readOnly, allowGroups, defaultValue, allowedValues }, processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(field, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error adding field to work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_state,
    "Create a new workflow state for a work item type in an inherited process.",
    {
      processId: z.string().describe("The ID of the (inherited) process."),
      witRefName: z.string().describe("The reference name of the work item type, e.g. 'MyProcess.Bug'."),
      name: z.string().describe("The name of the state, e.g. 'Triaged'."),
      stateCategory: z.enum(["Proposed", "InProgress", "Resolved", "Completed", "Removed"]).describe("The state category the state belongs to."),
      color: z.string().optional().describe("The color of the state as a hex string without '#', e.g. 'b2b2b2'."),
      order: z.coerce.number().optional().describe("The order of the state within its category."),
    },
    async ({ processId, witRefName, name, stateCategory, color, order }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const state = await processApi.createStateDefinition({ name, stateCategory, color, order }, processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating state: ${errorMessage}` }], isError: true };
      }
    }
  );

  // Every write below only works on an inherited process: the out-of-the-box
  // Agile, Scrum and Basic processes are locked, and Azure DevOps answers with
  // a permission error rather than a validation one, which reads confusingly.
  const processIdField = z.string().describe("The ID of the inherited process. System processes (Agile, Scrum, Basic) cannot be modified.");
  const witRefNameField = z.string().describe("The reference name of the work item type, e.g. 'MyProcess.Bug'.");

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_process,
    "Update an inherited process: its name, description, whether it is enabled, and whether it is the organization's default for new projects.",
    {
      processId: processIdField,
      name: z.string().optional().describe("New name of the process."),
      description: z.string().optional().describe("New description of the process."),
      isEnabled: z.boolean().optional().describe("Whether the process can be used by projects."),
      isDefault: z.boolean().optional().describe("Whether new projects use this process by default."),
    },
    async ({ processId, name, description, isEnabled, isDefault }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const updated = await processApi.editProcess({ name, description, isEnabled, isDefault }, processId);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating process: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_process,
    "Delete an inherited process. Only a process that no project uses can be deleted.",
    {
      processId: processIdField,
    },
    async ({ processId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteProcessById(processId);

        return { content: [{ type: "text", text: `Process '${processId}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting process: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_work_item_type,
    "Update a work item type in an inherited process: its description, colour, icon, or whether it is disabled.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      description: z.string().optional().describe("New description of the work item type."),
      color: z.string().optional().describe("Colour as a hex string without '#', e.g. 'f6546a'."),
      icon: z.string().optional().describe("Icon name, e.g. 'icon_book'."),
      isDisabled: z.boolean().optional().describe("Disable the type so no new work items of it can be created."),
    },
    async ({ processId, witRefName, description, color, icon, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const updated = await processApi.updateProcessWorkItemType({ description, color, icon, isDisabled }, processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_work_item_type,
    "Delete a custom work item type from an inherited process. Inherited system types cannot be deleted — disable them with witprocess_update_work_item_type instead.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
    },
    async ({ processId, witRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteProcessWorkItemType(processId, witRefName);

        return { content: [{ type: "text", text: `Work item type '${witRefName}' was deleted from process '${processId}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_work_item_type_field,
    "Update how a field behaves on a work item type: required, read-only, its default value, or the values it allows.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      fieldRefName: z.string().describe("Reference name of the field, e.g. 'System.Description' or 'Custom.Severity'."),
      required: z.boolean().optional().describe("Whether the field must be filled in."),
      readOnly: z.boolean().optional().describe("Whether the field is read-only on the form."),
      defaultValue: z.string().optional().describe("Default value applied to new work items."),
      allowedValues: z.array(z.string()).optional().describe("The list of values the field accepts."),
      allowGroups: z.boolean().optional().describe("For identity fields, whether groups may be selected as well as users."),
    },
    async ({ processId, witRefName, fieldRefName, required, readOnly, defaultValue, allowedValues, allowGroups }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const updated = await processApi.updateWorkItemTypeField({ required, readOnly, defaultValue, allowedValues, allowGroups }, processId, witRefName, fieldRefName);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating work item type field: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.remove_work_item_type_field,
    "Remove a field from a work item type in an inherited process. Data already stored in the field on existing work items is not deleted.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      fieldRefName: z.string().describe("Reference name of the field to remove."),
    },
    async ({ processId, witRefName, fieldRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.removeWorkItemTypeField(processId, witRefName, fieldRefName);

        return { content: [{ type: "text", text: `Field '${fieldRefName}' was removed from '${witRefName}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error removing work item type field: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_state,
    "Update a workflow state of a work item type: its name, colour, category or order.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      stateId: z.string().describe("The ID of the state to update."),
      name: z.string().optional().describe("New name of the state."),
      color: z.string().optional().describe("Colour as a hex string without '#', e.g. 'b2b2b2'."),
      stateCategory: z.enum(["Proposed", "InProgress", "Resolved", "Completed", "Removed"]).optional().describe("The state category the state belongs to."),
      order: z.coerce.number().optional().describe("Order of the state within its category."),
    },
    async ({ processId, witRefName, stateId, name, color, stateCategory, order }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const updated = await processApi.updateStateDefinition({ name, color, stateCategory, order }, processId, witRefName, stateId);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating state: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_state,
    "Delete a custom workflow state from a work item type. Inherited states cannot be deleted — hide them with witprocess_hide_state instead.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      stateId: z.string().describe("The ID of the state to delete."),
    },
    async ({ processId, witRefName, stateId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteStateDefinition(processId, witRefName, stateId);

        return { content: [{ type: "text", text: `State '${stateId}' was deleted from '${witRefName}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting state: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.hide_state,
    "Hide or unhide an inherited workflow state. This is how a state that came from the parent process is taken out of use, since it cannot be deleted.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      stateId: z.string().describe("The ID of the state."),
      hidden: z.boolean().default(true).describe("True to hide the state, false to bring it back."),
    },
    async ({ processId, witRefName, stateId, hidden }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const result = await processApi.hideStateDefinition({ hidden }, processId, witRefName, stateId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error hiding state: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_behavior,
    "Create a behavior in an inherited process. Behaviors are what put a work item type on a backlog level, so a custom type only appears on a board once it inherits the right one.",
    {
      processId: processIdField,
      name: z.string().describe("Name of the behavior."),
      referenceName: z.string().optional().describe("Reference name of the behavior. Generated when omitted."),
      inherits: z.string().optional().describe("Reference name of the behavior this one inherits from, e.g. 'System.RequirementBacklogBehavior'."),
      color: z.string().optional().describe("Colour as a hex string without '#'."),
    },
    async ({ processId, name, referenceName, inherits, color }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const behavior = await processApi.createProcessBehavior({ name, referenceName, inherits, color }, processId);

        return { content: [{ type: "text", text: JSON.stringify(behavior, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating behavior: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_behavior,
    "Update a behavior's name or colour in an inherited process.",
    {
      processId: processIdField,
      behaviorRefName: z.string().describe("Reference name of the behavior."),
      name: z.string().optional().describe("New name of the behavior."),
      color: z.string().optional().describe("Colour as a hex string without '#'."),
    },
    async ({ processId, behaviorRefName, name, color }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const behavior = await processApi.updateProcessBehavior({ name, color }, processId, behaviorRefName);

        return { content: [{ type: "text", text: JSON.stringify(behavior, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating behavior: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_behavior,
    "Delete a custom behavior from an inherited process.",
    {
      processId: processIdField,
      behaviorRefName: z.string().describe("Reference name of the behavior to delete."),
    },
    async ({ processId, behaviorRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteProcessBehavior(processId, behaviorRefName);

        return { content: [{ type: "text", text: `Behavior '${behaviorRefName}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting behavior: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.add_behavior_to_work_item_type,
    "Attach a behavior to a work item type, which is what makes the type show up on the corresponding backlog level.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      behaviorRefName: z.string().describe("Reference name of the behavior to attach."),
      isDefault: z.boolean().optional().describe("Whether this type is the default one created on that backlog level."),
    },
    async ({ processId, witRefName, behaviorRefName, isDefault }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const result = await processApi.addBehaviorToWorkItemType({ behavior: { id: behaviorRefName }, isDefault }, processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error adding behavior to work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.remove_behavior_from_work_item_type,
    "Detach a behavior from a work item type, taking the type off that backlog level.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      behaviorRefName: z.string().describe("Reference name of the behavior to detach."),
    },
    async ({ processId, witRefName, behaviorRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.removeBehaviorFromWorkItemType(processId, witRefName, behaviorRefName);

        return { content: [{ type: "text", text: `Behavior '${behaviorRefName}' was removed from '${witRefName}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error removing behavior from work item type: ${errorMessage}` }], isError: true };
      }
    }
  );

  const ruleConditionsField = z
    .array(
      z.object({
        conditionType: z.enum(getEnumKeys(RuleConditionType) as [string, ...string[]]).describe("When the rule applies, e.g. 'When', 'WhenChanged', 'WhenWorkItemIsCreated'."),
        field: z.string().optional().describe("Reference name of the field the condition looks at."),
        value: z.string().optional().describe("Value the condition compares against."),
      })
    )
    .describe("Conditions that must hold for the rule to fire.");

  const ruleActionsField = z
    .array(
      z.object({
        actionType: z.enum(getEnumKeys(RuleActionType) as [string, ...string[]]).describe("What the rule does, e.g. 'MakeRequired', 'MakeReadOnly', 'SetDefaultValue', 'CopyValue'."),
        targetField: z.string().optional().describe("Reference name of the field the action applies to."),
        value: z.string().optional().describe("Value used by the action, where it takes one."),
      })
    )
    .describe("What happens when the conditions hold.");

  function mapRule(conditions: { conditionType: string; field?: string; value?: string }[], actions: { actionType: string; targetField?: string; value?: string }[]) {
    return {
      conditions: conditions.map((condition) => ({ ...condition, conditionType: safeEnumConvert(RuleConditionType, condition.conditionType) })),
      actions: actions.map((action) => ({ ...action, actionType: safeEnumConvert(RuleActionType, action.actionType) })),
    };
  }

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_rules,
    "List the custom rules defined on a work item type in an inherited process.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
    },
    async ({ processId, witRefName }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const rules = await processApi.getProcessWorkItemTypeRules(processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(rules, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing rules: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_rule,
    "Get a single custom rule of a work item type by its ID.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      ruleId: z.string().describe("The ID of the rule."),
    },
    async ({ processId, witRefName, ruleId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const rule = await processApi.getProcessWorkItemTypeRule(processId, witRefName, ruleId);

        if (!rule) {
          return { content: [{ type: "text", text: `Rule '${ruleId}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching rule: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_rule,
    "Create a custom rule on a work item type, e.g. 'when State is Closed, make Resolution required'.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      name: z.string().describe("Name of the rule, shown in the process editor."),
      conditions: ruleConditionsField,
      actions: ruleActionsField,
      isDisabled: z.boolean().optional().describe("Create the rule switched off."),
    },
    async ({ processId, witRefName, name, conditions, actions, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const rule = await processApi.addProcessWorkItemTypeRule({ name, isDisabled, ...mapRule(conditions, actions) }, processId, witRefName);

        return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating rule: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_rule,
    "Replace a custom rule. The conditions and actions are overwritten wholesale, so pass the complete set the rule should end up with.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      ruleId: z.string().describe("The ID of the rule to update."),
      name: z.string().describe("Name of the rule."),
      conditions: ruleConditionsField,
      actions: ruleActionsField,
      isDisabled: z.boolean().optional().describe("Whether the rule is switched off."),
    },
    async ({ processId, witRefName, ruleId, name, conditions, actions, isDisabled }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const rule = await processApi.updateProcessWorkItemTypeRule({ id: ruleId, name, isDisabled, ...mapRule(conditions, actions) }, processId, witRefName, ruleId);

        return { content: [{ type: "text", text: JSON.stringify(rule, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating rule: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_rule,
    "Delete a custom rule from a work item type.",
    {
      processId: processIdField,
      witRefName: witRefNameField,
      ruleId: z.string().describe("The ID of the rule to delete."),
    },
    async ({ processId, witRefName, ruleId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteProcessWorkItemTypeRule(processId, witRefName, ruleId);

        return { content: [{ type: "text", text: `Rule '${ruleId}' was deleted from '${witRefName}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting rule: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.list_picklists,
    "List the picklists in the organization. Picklists are the value sets behind custom dropdown fields; they are organization-wide, not per process.",
    {},
    async () => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const lists = await processApi.getListsMetadata();

        return { content: [{ type: "text", text: JSON.stringify(lists, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing picklists: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.get_picklist,
    "Get a picklist with the items it contains.",
    {
      listId: z.string().describe("The ID (GUID) of the picklist."),
    },
    async ({ listId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const list = await processApi.getList(listId);

        if (!list) {
          return { content: [{ type: "text", text: `Picklist '${listId}' not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching picklist: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.create_picklist,
    "Create a picklist for use by custom dropdown fields.",
    {
      name: z.string().describe("Name of the picklist."),
      items: z.array(z.string()).describe("The values the list offers."),
      type: z.enum(["String", "Integer"]).default("String").describe("Type of the list values."),
      isSuggested: z.boolean().optional().describe("Allow values outside the list, offering these as suggestions."),
    },
    async ({ name, items, type, isSuggested }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const list = await processApi.createList({ name, items, type, isSuggested });

        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating picklist: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.update_picklist,
    "Replace the contents of a picklist. The items are overwritten wholesale, so pass every value the list should keep — fetch the current ones with witprocess_get_picklist first.",
    {
      listId: z.string().describe("The ID (GUID) of the picklist."),
      name: z.string().describe("Name of the picklist."),
      items: z.array(z.string()).describe("The complete set of values the list should contain."),
      type: z.enum(["String", "Integer"]).default("String").describe("Type of the list values."),
      isSuggested: z.boolean().optional().describe("Allow values outside the list, offering these as suggestions."),
    },
    async ({ listId, name, items, type, isSuggested }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        const list = await processApi.updateList({ id: listId, name, items, type, isSuggested }, listId);

        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating picklist: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    WIT_PROCESS_TOOLS.delete_picklist,
    "Delete a picklist. A list still used by a field cannot be deleted.",
    {
      listId: z.string().describe("The ID (GUID) of the picklist to delete."),
    },
    async ({ listId }) => {
      try {
        const connection = await connectionProvider();
        const processApi = await connection.getWorkItemTrackingProcessApi();
        await processApi.deleteList(listId);

        return { content: [{ type: "text", text: `Picklist '${listId}' was deleted.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting picklist: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { WIT_PROCESS_TOOLS, configureWitProcessTools };
