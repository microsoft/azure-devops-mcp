# Toolset

This page lists all available tools provided by the local Azure DevOps MCP server. Use it as a reference to understand what each tool does, what parameters it requires, and how tools are organized by functional area.

### Core

| Tool                                                                | Description                            |
| ------------------------------------------------------------------- | -------------------------------------- |
| [mcp_ado_core_list_projects](#mcp_ado_core_list_projects)           | List all projects in the organization  |
| [mcp_ado_core_list_project_teams](#mcp_ado_core_list_project_teams) | List teams within a project            |
| [mcp_ado_core_get_identity_ids](#mcp_ado_core_get_identity_ids)     | Retrieve identity IDs by search filter |

### Work

> **Note:** The work tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work) tool structure.

| Tool                          | Action                     | Description                                                                             |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| [work](#work)                 | `list_iterations`          | List all iterations in a project                                                        |
| [work](#work)                 | `list_team_iterations`     | List iterations assigned to a team                                                      |
| [work](#work)                 | `get_team_settings`        | Get team settings including default iteration, backlog iteration, and default area path |
| [work](#work)                 | `get_team_capacity`        | Get team capacity for an iteration                                                      |
| [work](#work)                 | `get_iteration_capacities` | Get an iteration's capacity for all teams in the iteration and project                  |
| [work_iteration_write](#work) | `create`                   | Create iterations                                                                       |
| [work_iteration_write](#work) | `assign`                   | Assign iterations to a team                                                             |
| [work_capacity_write](#work)  | `update`                   | Update the team capacity of a team member for a specific iteration                      |

### Work Items

> **Note:** The work item tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work-items) tool structure.

| Tool                                                        | Action                 | Description                                                             |
| ----------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| [wit_work_item](#wit_work_item)                             | `get`                  | Get a single work item by ID                                            |
| [wit_work_item](#wit_work_item)                             | `get_batch`            | Retrieve multiple work items by IDs                                     |
| [wit_work_item](#wit_work_item)                             | `list_comments`        | List comments on a work item                                            |
| [wit_work_item](#wit_work_item)                             | `my`                   | List work items relevant to the authenticated user                      |
| [wit_work_item](#wit_work_item)                             | `list_revisions`       | Get revision history of a work item                                     |
| [wit_work_item](#wit_work_item)                             | `list_for_iteration`   | Get work items in a specific team iteration                             |
| [wit_work_item](#wit_work_item)                             | `get_type`             | Get metadata for a work item type                                       |
| [wit_work_item_write](#wit_work_item_write)                 | `create`               | Create a new work item                                                  |
| [wit_work_item_write](#wit_work_item_write)                 | `update`               | Update fields on a single work item                                     |
| [wit_work_item_write](#wit_work_item_write)                 | `update_batch`         | Update multiple work items in one call                                  |
| [wit_work_item_write](#wit_work_item_write)                 | `add_child`            | Create child work items under a parent                                  |
| [wit_work_item_comment_write](#wit_work_item_comment_write) | `add`                  | Add a comment to a work item                                            |
| [wit_work_item_comment_write](#wit_work_item_comment_write) | `update`               | Update an existing comment on a work item                               |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `link`                 | Link two work items together                                            |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `unlink`               | Remove links from a work item                                           |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `link_to_pull_request` | Link a work item to a pull request                                      |
| [wit_work_item_link_write](#wit_work_item_link_write)       | `add_artifact_link`    | Add a repository, branch, commit, or build artifact link to a work item |
| [wit_query](#wit_query)                                     | `get`                  | Get a work item query by ID or path                                     |
| [wit_query](#wit_query)                                     | `get_results`          | Execute a saved query and return results                                |
| [wit_query](#wit_query)                                     | `wiql`                 | Execute an ad-hoc WIQL query                                            |
| [wit_backlog](#wit_backlog)                                 | `list`                 | List backlog levels for a team                                          |
| [wit_backlog](#wit_backlog)                                 | `list_work_items`      | Get work items in a specific backlog level                              |
| [wit_backlog](#wit_backlog)                                 | `reorder`              | Reorder work items in a backlog or iteration                            |
| [wit_work_item_attachment](#wit_work_item_attachment)       |                        | Download a work item attachment; save locally or return as base64       |

### Repositories

> **Note:** The repository tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#repos) tool structure.

| Tool                                                              | Action             | Description                                                         |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| [repo_repository](#repo_repository)                               | `get`              | Get a repository by name or ID                                      |
| [repo_repository](#repo_repository)                               | `list`             | List repositories in a project                                      |
| [repo_pull_request](#repo_pull_request)                           | `get`              | Get a pull request by ID                                            |
| [repo_pull_request](#repo_pull_request)                           | `list`             | List pull requests in a repository or project                       |
| [repo_pull_request](#repo_pull_request)                           | `list_by_commits`  | Find pull requests that contain specific commit IDs                 |
| [repo_pull_request_thread](#repo_pull_request_thread)             | `list`             | List comment threads on a pull request                              |
| [repo_pull_request_thread](#repo_pull_request_thread)             | `list_comments`    | List comments in a specific thread                                  |
| [repo_branch](#repo_branch)                                       | `get`              | Get a branch by name                                                |
| [repo_branch](#repo_branch)                                       | `list`             | List branches in a repository                                       |
| [repo_branch](#repo_branch)                                       | `list_mine`        | List branches the current user has pushed to                        |
| [repo_file](#repo_file)                                           | `get_content`      | Get the text content of a file at a specific branch, tag, or commit |
| [repo_file](#repo_file)                                           | `list_directory`   | List files and folders in a directory                               |
| [repo_search_commits](#repo_search_commits)                       |                    | Search commits with filtering by text, author, date range, and more |
| [repo_pull_request_write](#repo_pull_request_write)               | `create`           | Create a pull request                                               |
| [repo_pull_request_write](#repo_pull_request_write)               | `update`           | Update a pull request, including setting autocomplete               |
| [repo_pull_request_write](#repo_pull_request_write)               | `update_reviewers` | Add or remove pull request reviewers                                |
| [repo_pull_request_write](#repo_pull_request_write)               | `vote`             | Cast a vote on a pull request                                       |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `create`           | Create a new comment thread on a pull request                       |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `reply`            | Reply to a comment in a thread                                      |
| [repo_pull_request_thread_write](#repo_pull_request_thread_write) | `update_status`    | Update the status of a comment thread                               |
| [repo_create_branch](#repo_create_branch)                         |                    | Create a branch                                                     |

### Pipelines

> **Note:** The pipeline tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#pipelines) tool structure.

| Tool                                          | Action               | Description                                         |
| --------------------------------------------- | -------------------- | --------------------------------------------------- |
| [pipelines_build](#pipelines_build)           | `list`               | List builds with optional filters                   |
| [pipelines_build](#pipelines_build)           | `get_status`         | Get status, issues, and report metadata for a build |
| [pipelines_build](#pipelines_build)           | `get_changes`        | Get commits and work items associated with a build  |
| [pipelines_build_log](#pipelines_build_log)   | `list`               | List available logs for a build                     |
| [pipelines_build_log](#pipelines_build_log)   | `get_content`        | Get the text content of a specific log by ID        |
| [pipelines_definition](#pipelines_definition) | `list`               | List pipeline definitions with optional filters     |
| [pipelines_definition](#pipelines_definition) | `list_revisions`     | List revision history for a pipeline definition     |
| [pipelines_run](#pipelines_run)               | `get`                | Get a single pipeline run                           |
| [pipelines_run](#pipelines_run)               | `list`               | List runs for a pipeline                            |
| [pipelines_artifact](#pipelines_artifact)     | `list`               | List artifacts for a build                          |
| [pipelines_artifact](#pipelines_artifact)     | `download`           | Download a named build artifact                     |
| [pipelines_write](#pipelines_write)           | `run_pipeline`       | Queue a new pipeline run                            |
| [pipelines_write](#pipelines_write)           | `create_pipeline`    | Create a new YAML pipeline definition               |
| [pipelines_write](#pipelines_write)           | `rename_pipeline`    | Rename an existing pipeline definition              |
| [pipelines_write](#pipelines_write)           | `update_build_stage` | Cancel, retry, or run a stage on an in-flight build |

### Test Plans

> **Note:** The test plan tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#test-plans) tool structure.

| Tool                                                                                  | Action           | Description                            |
| ------------------------------------------------------------------------------------- | ---------------- | -------------------------------------- |
| [testplan](#testplan)                                                                 | `list_plans`     | List test plans in a project           |
| [testplan](#testplan)                                                                 | `list_suites`    | List test suites under a test plan     |
| [testplan](#testplan)                                                                 | `list_cases`     | List test cases under a test suite     |
| [testplan_show_test_results_from_build_id](#testplan_show_test_results_from_build_id) |                  | Get test results for a specific build  |
| [testplan_test_plan_write](#testplan_test_plan_write)                                 | `create`         | Create a new test plan                 |
| [testplan_test_suite_write](#testplan_test_suite_write)                               | `create`         | Create a test suite within a test plan |
| [testplan_test_suite_write](#testplan_test_suite_write)                               | `add_test_cases` | Add test cases to a test suite         |
| [testplan_test_case_write](#testplan_test_case_write)                                 | `create`         | Create a new test case work item       |
| [testplan_test_case_write](#testplan_test_case_write)                                 | `update_steps`   | Update steps of an existing test case  |

### Wiki

> **Note:** The wiki tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#wiki) tool structure.

| Tool                      | Action             | Description                                  |
| ------------------------- | ------------------ | -------------------------------------------- |
| [wiki](#wiki)             | `list_wikis`       | List all wikis in an organization or project |
| [wiki](#wiki)             | `get_wiki`         | Get details of a specific wiki               |
| [wiki](#wiki)             | `list_pages`       | List pages in a wiki                         |
| [wiki](#wiki)             | `get_page`         | Get wiki page metadata (without content)     |
| [wiki](#wiki)             | `get_page_content` | Retrieve wiki page content                   |
| [wiki_upsert_page](#wiki) |                    | Create or update a wiki page                 |

### Search

| Tool                                                | Description                           |
| --------------------------------------------------- | ------------------------------------- |
| [mcp_ado_search_code](#mcp_ado_search_code)         | Search for code across repositories   |
| [mcp_ado_search_wiki](#mcp_ado_search_wiki)         | Search wiki pages by keywords         |
| [mcp_ado_search_workitem](#mcp_ado_search_workitem) | Search work items by text and filters |

### Advanced Security

| Tool                                                                  | Description                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| [mcp_ado_advsec_get_alerts](#mcp_ado_advsec_get_alerts)               | Retrieve Advanced Security alerts for a repository       |
| [mcp_ado_advsec_get_alert_details](#mcp_ado_advsec_get_alert_details) | Get detailed information about a specific security alert |
