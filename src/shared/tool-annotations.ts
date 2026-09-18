// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

const MUTATING_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

const ADDITIVE_ANNOTATIONS = {
  ...MUTATING_ANNOTATIONS,
  destructiveHint: false,
} as const satisfies ToolAnnotations;

const TOOL_ANNOTATIONS: Readonly<Record<string, ToolAnnotations>> = {
  advsec_get_alert_details: READ_ONLY_ANNOTATIONS,
  advsec_get_alerts: READ_ONLY_ANNOTATIONS,
  core_get_identity_ids: READ_ONLY_ANNOTATIONS,
  core_list_projects: READ_ONLY_ANNOTATIONS,
  core_list_project_teams: READ_ONLY_ANNOTATIONS,
  mcp_apps_ping: { ...READ_ONLY_ANNOTATIONS, openWorldHint: false },
  pipelines_artifact: MUTATING_ANNOTATIONS,
  pipelines_build: READ_ONLY_ANNOTATIONS,
  pipelines_build_log: READ_ONLY_ANNOTATIONS,
  pipelines_definition: READ_ONLY_ANNOTATIONS,
  pipelines_run: READ_ONLY_ANNOTATIONS,
  pipelines_write: MUTATING_ANNOTATIONS,
  repo_branch: READ_ONLY_ANNOTATIONS,
  repo_create_branch: ADDITIVE_ANNOTATIONS,
  repo_file: READ_ONLY_ANNOTATIONS,
  repo_file_write: MUTATING_ANNOTATIONS,
  repo_pull_request: READ_ONLY_ANNOTATIONS,
  repo_pull_request_org: READ_ONLY_ANNOTATIONS,
  repo_pull_request_thread: READ_ONLY_ANNOTATIONS,
  repo_pull_request_thread_write: MUTATING_ANNOTATIONS,
  repo_pull_request_write: MUTATING_ANNOTATIONS,
  repo_repository: READ_ONLY_ANNOTATIONS,
  repo_search_commits: READ_ONLY_ANNOTATIONS,
  search_code: READ_ONLY_ANNOTATIONS,
  search_wiki: READ_ONLY_ANNOTATIONS,
  search_workitem: READ_ONLY_ANNOTATIONS,
  testplan: READ_ONLY_ANNOTATIONS,
  testplan_show_test_results_from_build_id: READ_ONLY_ANNOTATIONS,
  testplan_test_case_write: MUTATING_ANNOTATIONS,
  testplan_test_plan_write: MUTATING_ANNOTATIONS,
  testplan_test_suite_write: MUTATING_ANNOTATIONS,
  wiki: READ_ONLY_ANNOTATIONS,
  wiki_upsert_page: MUTATING_ANNOTATIONS,
  wit_backlog: MUTATING_ANNOTATIONS,
  wit_query: READ_ONLY_ANNOTATIONS,
  wit_work_item: READ_ONLY_ANNOTATIONS,
  wit_work_item_attachment: ADDITIVE_ANNOTATIONS,
  wit_work_item_comment_write: MUTATING_ANNOTATIONS,
  wit_work_item_link_write: MUTATING_ANNOTATIONS,
  wit_work_item_write: MUTATING_ANNOTATIONS,
  work: READ_ONLY_ANNOTATIONS,
  work_capacity_write: MUTATING_ANNOTATIONS,
  work_iteration_write: ADDITIVE_ANNOTATIONS,
};

function configureToolsWithAnnotations(server: McpServer, configureFn: () => void): void {
  const originalTool = server.tool;

  server.tool = new Proxy(originalTool, {
    apply(target, thisArg, argumentsList: unknown[]) {
      const toolName = argumentsList[0];
      if (typeof toolName !== "string" || !Object.hasOwn(TOOL_ANNOTATIONS, toolName)) {
        throw new Error(`Missing MCP annotations for tool: ${String(toolName)}`);
      }

      argumentsList.splice(argumentsList.length - 1, 0, TOOL_ANNOTATIONS[toolName]);
      return Reflect.apply(target, thisArg, argumentsList);
    },
  });

  try {
    configureFn();
  } finally {
    server.tool = originalTool;
  }
}

export { configureToolsWithAnnotations, TOOL_ANNOTATIONS };
