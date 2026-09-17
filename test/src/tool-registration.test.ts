// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { categorizeTool, registerTool } from "../../src/shared/tool-registration";

describe("categorizeTool", () => {
  it("classifies list/get/search/query/show/my tools as read", () => {
    for (const name of ["core_list_projects", "wit_get_work_item", "search_code", "wit_query_by_wiql", "testplan_show_test_results_from_build_id", "wit_my_work_items", "repo_search_commits"]) {
      expect(categorizeTool(name)).toBe("read");
    }
  });

  it("classifies create/update/add/set/replace/assign/run tools as write", () => {
    for (const name of [
      "wit_create_work_item",
      "wit_update_work_item",
      "wit_add_work_item_comment",
      "core_set_project_properties",
      "dashboard_replace_dashboard",
      "work_assign_iterations",
      "pipelines_run_pipeline",
    ]) {
      expect(categorizeTool(name)).toBe("write");
    }
  });

  it("classifies delete/remove/unlink tools as destructive", () => {
    for (const name of ["core_delete_project", "work_remove_team_iteration", "wit_work_item_unlink", "securityrole_remove_assignments", "taskagent_delete_variable_group"]) {
      expect(categorizeTool(name)).toBe("destructive");
    }
  });

  it("honors explicit overrides (mcp_apps_ping is read)", () => {
    expect(categorizeTool("mcp_apps_ping")).toBe("read");
  });

  // Granting a deny bit can lock everyone out, so clients must confirm it.
  it("treats setting ACL entries as destructive despite the 'set' verb", () => {
    expect(categorizeTool("permissions_set_access_control_entries")).toBe("destructive");
  });
});

describe("registerTool", () => {
  function makeServer() {
    const registered = { update: jest.fn() };
    const registerTool = jest.fn(() => registered);
    return { server: { registerTool } as unknown as McpServer, registerTool, registered };
  }

  // server.tool(name, description, schema, cb) is deprecated in the SDK.
  it("registers through server.registerTool with the description, schema and handler", () => {
    const { server, registerTool: register, registered } = makeServer();
    const handler = jest.fn();
    const schema = {};

    const result = registerTool(server, "core_list_projects", "desc", schema, handler as never);

    expect(register).toHaveBeenCalledWith("core_list_projects", expect.objectContaining({ description: "desc", inputSchema: schema }), handler);
    expect(result).toBe(registered);
  });

  it.each([
    ["wit_get_work_item", { readOnlyHint: true, destructiveHint: false }],
    ["core_delete_project", { readOnlyHint: false, destructiveHint: true }],
    ["wit_create_work_item", { readOnlyHint: false, destructiveHint: false }],
    ["permissions_set_access_control_entries", { readOnlyHint: false, destructiveHint: true }],
  ])("passes the annotations for %s in the registration itself", (name, annotations) => {
    const { server, registerTool: register } = makeServer();

    registerTool(server, name, "desc", {}, jest.fn() as never);

    expect(register).toHaveBeenCalledWith(name, expect.objectContaining({ annotations }), expect.any(Function));
  });
});
