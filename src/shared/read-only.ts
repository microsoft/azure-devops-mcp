// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tool names that are safe for read-only mode (no mutations).
 * When --read-only mode is active, only these tools are registered.
 * New tools must be explicitly added here to be available in read-only mode.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  // advanced security
  "advsec_get_alerts",
  "advsec_get_alert_details",
  // core
  "core_list_project_teams",
  "core_list_projects",
  "core_get_identity_ids",
  // pipelines
  "pipelines_get_builds",
  "pipelines_get_build_changes",
  "pipelines_get_build_definitions",
  "pipelines_get_build_definition_revisions",
  "pipelines_get_build_log",
  "pipelines_get_build_log_by_id",
  "pipelines_get_build_status",
  "pipelines_get_run",
  "pipelines_list_runs",
  "pipelines_list_artifacts",
  "pipelines_download_artifact",
  // repositories
  "repo_list_repos_by_project",
  "repo_list_pull_requests_by_repo_or_project",
  "repo_list_branches_by_repo",
  "repo_list_my_branches_by_repo",
  "repo_list_pull_request_threads",
  "repo_list_pull_request_thread_comments",
  "repo_get_repo_by_name_or_id",
  "repo_get_branch_by_name",
  "repo_get_pull_request_by_id",
  "repo_search_commits",
  "repo_list_pull_requests_by_commits",
  // search
  "search_code",
  "search_wiki",
  "search_workitem",
  // test plans
  "testplan_show_test_results_from_build_id",
  "testplan_list_test_cases",
  "testplan_list_test_plans",
  "testplan_list_test_suites",
  // wiki
  "wiki_list_wikis",
  "wiki_get_wiki",
  "wiki_list_pages",
  "wiki_get_page",
  "wiki_get_page_content",
  // work items
  "wit_my_work_items",
  "wit_list_backlogs",
  "wit_list_backlog_work_items",
  "wit_get_work_item",
  "wit_get_work_items_batch_by_ids",
  "wit_list_work_item_comments",
  "wit_list_work_item_revisions",
  "wit_get_work_items_for_iteration",
  "wit_get_work_item_type",
  "wit_get_query",
  "wit_get_query_results_by_id",
  // work
  "work_list_team_iterations",
  "work_list_iterations",
  "work_get_team_capacity",
  "work_get_iteration_capacities",
]);
