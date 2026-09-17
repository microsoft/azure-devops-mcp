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
    const update = jest.fn();
    const tool = jest.fn(() => ({ update }));
    return { server: { tool } as unknown as McpServer, tool, update };
  }

  it("registers via server.tool with the handler as the last argument", () => {
    const { server, tool } = makeServer();
    const handler = jest.fn();

    registerTool(server, "core_list_projects", "desc", {}, handler as never);

    expect(tool).toHaveBeenCalledWith("core_list_projects", "desc", {}, handler);
  });

  it("applies read-only annotations for a read tool", () => {
    const { server, update } = makeServer();
    registerTool(server, "wit_get_work_item", "desc", {}, jest.fn() as never);
    expect(update).toHaveBeenCalledWith({ annotations: { readOnlyHint: true, destructiveHint: false } });
  });

  it("applies destructive annotations for a delete tool", () => {
    const { server, update } = makeServer();
    registerTool(server, "core_delete_project", "desc", {}, jest.fn() as never);
    expect(update).toHaveBeenCalledWith({ annotations: { readOnlyHint: false, destructiveHint: true } });
  });

  it("applies non-destructive write annotations for a create tool", () => {
    const { server, update } = makeServer();
    registerTool(server, "wit_create_work_item", "desc", {}, jest.fn() as never);
    expect(update).toHaveBeenCalledWith({ annotations: { readOnlyHint: false, destructiveHint: false } });
  });

  it("does not throw when server.tool returns nothing (annotations are best-effort)", () => {
    const tool = jest.fn(() => undefined);
    const server = { tool } as unknown as McpServer;
    expect(() => registerTool(server, "wit_get_work_item", "desc", {}, jest.fn() as never)).not.toThrow();
  });
});
