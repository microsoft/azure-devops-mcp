# Toolset

This page lists all available tools provided by the local Azure DevOps MCP server. Use it as a reference to understand what each tool does, what parameters it requires, and how tools are organized by functional area.

## Overview

### Advanced Security

| Tool                                                                  | Description                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| [mcp_ado_advsec_get_alerts](#mcp_ado_advsec_get_alerts)               | Retrieve Advanced Security alerts for a repository       |
| [mcp_ado_advsec_get_alert_details](#mcp_ado_advsec_get_alert_details) | Get detailed information about a specific security alert |

### Core

| Tool                                                                | Description                            |
| ------------------------------------------------------------------- | -------------------------------------- |
| [mcp_ado_core_list_projects](#mcp_ado_core_list_projects)           | List all projects in the organization  |
| [mcp_ado_core_list_project_teams](#mcp_ado_core_list_project_teams) | List teams within a project            |
| [mcp_ado_core_get_identity_ids](#mcp_ado_core_get_identity_ids)     | Retrieve identity IDs by search filter |

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
| [pipelines_write](#pipelines_write)           | `update_build_stage` | Cancel, retry, or run a stage on an in-flight build |

### Repositories

| Tool                                                                                                      | Description                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [mcp_ado_repo_list_repos_by_project](#mcp_ado_repo_list_repos_by_project)                                 | List all repositories in a project             |
| [mcp_ado_repo_get_repo_by_name_or_id](#mcp_ado_repo_get_repo_by_name_or_id)                               | Get repository details by name or ID           |
| [mcp_ado_repo_list_branches_by_repo](#mcp_ado_repo_list_branches_by_repo)                                 | List all branches in a repository              |
| [mcp_ado_repo_list_my_branches_by_repo](#mcp_ado_repo_list_my_branches_by_repo)                           | List branches created by current user          |
| [mcp_ado_repo_get_branch_by_name](#mcp_ado_repo_get_branch_by_name)                                       | Get details of a specific branch               |
| [mcp_ado_repo_create_branch](#mcp_ado_repo_create_branch)                                                 | Create a new branch from a source branch       |
| [mcp_ado_repo_search_commits](#mcp_ado_repo_search_commits)                                               | Search for commits with comprehensive filters  |
| [mcp_ado_repo_list_pull_requests_by_repo_or_project](#mcp_ado_repo_list_pull_requests_by_repo_or_project) | List pull requests with optional filters       |
| [mcp_ado_repo_list_pull_requests_by_commits](#mcp_ado_repo_list_pull_requests_by_commits)                 | Find pull requests containing specific commits |
| [mcp_ado_repo_get_pull_request_by_id](#mcp_ado_repo_get_pull_request_by_id)                               | Get details of a specific pull request         |
| [mcp_ado_repo_get_pull_request_changes](#mcp_ado_repo_get_pull_request_changes)                           | Get file changes (diff) for a pull request     |
| [mcp_ado_repo_create_pull_request](#mcp_ado_repo_create_pull_request)                                     | Create a new pull request                      |
| [mcp_ado_repo_update_pull_request](#mcp_ado_repo_update_pull_request)                                     | Update pull request properties and settings    |
| [mcp_ado_repo_update_pull_request_reviewers](#mcp_ado_repo_update_pull_request_reviewers)                 | Add or remove reviewers from a pull request    |
| [mcp_ado_repo_vote_pull_request](#mcp_ado_repo_vote_pull_request)                                         | Cast a vote on a pull request                  |
| [mcp_ado_repo_list_pull_request_threads](#mcp_ado_repo_list_pull_request_threads)                         | List comment threads on a pull request         |
| [mcp_ado_repo_list_pull_request_thread_comments](#mcp_ado_repo_list_pull_request_thread_comments)         | List comments in a specific thread             |
| [mcp_ado_repo_create_pull_request_thread](#mcp_ado_repo_create_pull_request_thread)                       | Create a new comment thread on a pull request  |
| [mcp_ado_repo_update_pull_request_thread](#mcp_ado_repo_update_pull_request_thread)                       | Update an existing pull request comment thread |
| [mcp_ado_repo_reply_to_comment](#mcp_ado_repo_reply_to_comment)                                           | Reply to a pull request comment                |
| [mcp_ado_repo_list_directory](#mcp_ado_repo_list_directory)                                               | List files and folders in a directory          |
| [mcp_ado_repo_get_file_content](#mcp_ado_repo_get_file_content)                                           | Get file content at a specific version         |

### Search

| Tool                                                | Description                           |
| --------------------------------------------------- | ------------------------------------- |
| [mcp_ado_search_code](#mcp_ado_search_code)         | Search for code across repositories   |
| [mcp_ado_search_wiki](#mcp_ado_search_wiki)         | Search wiki pages by keywords         |
| [mcp_ado_search_workitem](#mcp_ado_search_workitem) | Search work items by text and filters |

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

### Work Items

| Tool                                                                                      | Description                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [mcp_ado_wit_get_work_item](#mcp_ado_wit_get_work_item)                                   | Get a work item by ID                                             |
| [mcp_ado_wit_get_work_items_batch_by_ids](#mcp_ado_wit_get_work_items_batch_by_ids)       | Retrieve multiple work items by IDs                               |
| [mcp_ado_wit_create_work_item](#mcp_ado_wit_create_work_item)                             | Create a new work item                                            |
| [mcp_ado_wit_update_work_item](#mcp_ado_wit_update_work_item)                             | Update fields of a work item                                      |
| [mcp_ado_wit_update_work_items_batch](#mcp_ado_wit_update_work_items_batch)               | Update multiple work items in batch                               |
| [mcp_ado_wit_add_child_work_items](#mcp_ado_wit_add_child_work_items)                     | Create child work items under a parent                            |
| [mcp_ado_wit_work_items_link](#mcp_ado_wit_work_items_link)                               | Link work items together                                          |
| [mcp_ado_wit_work_item_unlink](#mcp_ado_wit_work_item_unlink)                             | Remove links from a work item                                     |
| [mcp_ado_wit_add_artifact_link](#mcp_ado_wit_add_artifact_link)                           | Link artifacts (commits, builds, PRs) to work items               |
| [mcp_ado_wit_link_work_item_to_pull_request](#mcp_ado_wit_link_work_item_to_pull_request) | Link a work item to a pull request                                |
| [mcp_ado_wit_list_work_item_comments](#mcp_ado_wit_list_work_item_comments)               | List comments on a work item                                      |
| [mcp_ado_wit_add_work_item_comment](#mcp_ado_wit_add_work_item_comment)                   | Add a comment to a work item                                      |
| [mcp_ado_wit_update_work_item_comment](#mcp_ado_wit_update_work_item_comment)             | Update an existing comment on a work item                         |
| [mcp_ado_wit_list_work_item_revisions](#mcp_ado_wit_list_work_item_revisions)             | Get revision history of a work item                               |
| [mcp_ado_wit_get_work_item_type](#mcp_ado_wit_get_work_item_type)                         | Get details of a work item type                                   |
| [mcp_ado_wit_my_work_items](#mcp_ado_wit_my_work_items)                                   | List work items relevant to current user                          |
| [mcp_ado_wit_get_work_items_for_iteration](#mcp_ado_wit_get_work_items_for_iteration)     | Get work items in a specific iteration                            |
| [mcp_ado_wit_list_backlogs](#mcp_ado_wit_list_backlogs)                                   | List backlogs for a team                                          |
| [mcp_ado_wit_list_backlog_work_items](#mcp_ado_wit_list_backlog_work_items)               | Get work items in a backlog                                       |
| [mcp_ado_wit_get_query](#mcp_ado_wit_get_query)                                           | Get a work item query by ID or path                               |
| [mcp_ado_wit_get_query_results_by_id](#mcp_ado_wit_get_query_results_by_id)               | Execute a query and get results                                   |
| [mcp_ado_wit_query_by_wiql](#mcp_ado_wit_query_by_wiql)                                   | Execute a WIQL query and return matching work items               |
| [mcp_ado_wit_get_work_item_attachment](#mcp_ado_wit_get_work_item_attachment)             | Download a work item attachment; save locally or return as base64 |

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

## Details

### Advanced Security

#### mcp_ado_advsec_get_alerts

Retrieve Advanced Security alerts for a repository.

- **Required**: `project`, `repository`, `confidenceLevels`
- **Optional**: `alertType`, `continuationToken`, `onlyDefaultBranch`, `orderBy`, `ref`, `ruleId`, `ruleName`, `severities`, `states`, `toolName`, `top`, `validity`

#### mcp_ado_advsec_get_alert_details

Get detailed information about a specific Advanced Security alert.

- **Required**: `project`, `repository`, `alertId`
- **Optional**: `ref`

### Core

#### mcp_ado_core_list_projects

Retrieve a list of projects in your Azure DevOps organization.

- **Required**: None
- **Optional**: `continuationToken`, `projectNameFilter`, `skip`, `stateFilter`, `top`

#### mcp_ado_core_list_project_teams

Retrieve a list of teams for the specified Azure DevOps project.

- **Required**: `project`
- **Optional**: `mine`, `skip`, `top`

#### mcp_ado_core_get_identity_ids

Retrieve Azure DevOps identity IDs for a provided search filter.

- **Required**: `searchFilter`
- **Optional**: None

### Pipelines

> **Note:** The pipeline tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#pipelines) tool structure.

The pipeline tools are consolidated into grouped dispatchers using an `action` parameter.

#### pipelines_build

Retrieve build data for a project.

| Action        | Required params      | Optional params                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`        | `project`            | `branchName`, `buildIds`, `buildNumber`, `continuationToken`, `definitions`, `deletedFilter`, `maxBuildsPerDefinition`, `maxTime`, `minTime`, `properties`, `queryOrder`, `queues`, `reasonFilter`, `repositoryId`, `repositoryType`, `requestedFor`, `resultFilter`, `statusFilter`, `tagFilters`, `top` |
| `get_status`  | `project`, `buildId` | None                                                                                                                                                                                                                                                                                                      |
| `get_changes` | `project`, `buildId` | `continuationToken`, `includeSourceChange`, `top`                                                                                                                                                                                                                                                         |

#### pipelines_build_log

Retrieve build log data for a project.

| Action        | Required params               | Optional params        |
| ------------- | ----------------------------- | ---------------------- |
| `list`        | `project`, `buildId`          | None                   |
| `get_content` | `project`, `buildId`, `logId` | `startLine`, `endLine` |

#### pipelines_definition

Retrieve pipeline definition data for a project.

| Action           | Required params           | Optional params                                                                                                                                                                                                                                            |
| ---------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`           | `project`                 | `builtAfter`, `continuationToken`, `definitionIds`, `includeAllProperties`, `includeLatestBuilds`, `minMetricsTime`, `name`, `notBuiltAfter`, `path`, `processType`, `queryOrder`, `repositoryId`, `repositoryType`, `taskIdFilter`, `top`, `yamlFilename` |
| `list_revisions` | `project`, `definitionId` | None                                                                                                                                                                                                                                                       |

#### pipelines_run

Retrieve pipeline run data for a project.

| Action | Required params                  | Optional params |
| ------ | -------------------------------- | --------------- |
| `get`  | `project`, `pipelineId`, `runId` | None            |
| `list` | `project`, `pipelineId`          | None            |

#### pipelines_artifact

Retrieve and download build artifacts.

| Action     | Required params                      | Optional params                                                                 |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `list`     | `project`, `buildId`                 | None                                                                            |
| `download` | `project`, `buildId`, `artifactName` | `destinationPath` (relative path; absolute paths and traversal are not allowed) |

#### pipelines_write

Write operations for pipelines and builds.

| Action               | Required params                                                   | Optional params                                                                                                 |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `run_pipeline`       | `project`, `pipelineId`                                           | `pipelineVersion`, `previewRun`, `resources`, `stagesToSkip`, `templateParameters`, `variables`, `yamlOverride` |
| `create_pipeline`    | `project`, `name`, `yamlPath`, `repositoryType`, `repositoryName` | `folder`, `repositoryConnectionId`, `repositoryId`                                                              |
| `update_build_stage` | `project`, `buildId`, `stageName`, `status`                       | `forceRetryAllJobs`                                                                                             |

### Repositories

#### mcp_ado_repo_list_repos_by_project

Retrieve a list of repositories for a given project.

- **Required**: `project`
- **Optional**: `repoNameFilter`, `skip`, `top`

#### mcp_ado_repo_get_repo_by_name_or_id

Get the repository by project and repository name or ID.

- **Required**: `project`, `repositoryNameOrId`
- **Optional**: None

#### mcp_ado_repo_list_branches_by_repo

Retrieve a list of branches for a given repository.

- **Required**: `repositoryId`
- **Optional**: `filterContains`, `top`

#### mcp_ado_repo_list_my_branches_by_repo

Retrieve a list of my branches for a given repository Id.

- **Required**: `repositoryId`
- **Optional**: `filterContains`, `top`

#### mcp_ado_repo_get_branch_by_name

Get a branch by its name.

- **Required**: `repositoryId`, `branchName`
- **Optional**: None

#### mcp_ado_repo_create_branch

Create a new branch in the repository.

- **Required**: `repositoryId`, `branchName`
- **Optional**: `sourceBranchName`, `sourceCommitId`

#### mcp_ado_repo_search_commits

Search for commits across projects and repositories with comprehensive filtering capabilities.

- **Required**: `searchText`
- **Optional**: `project`, `repository`, `branch`, `author`, `commitStartDate`, `commitEndDate`, `orderBy`, `includeFacets`, `skip`, `top`

#### mcp_ado_repo_list_pull_requests_by_repo_or_project

Retrieve a list of pull requests for a given repository.

- **Required**: None (either `repositoryId` or `project` must be provided)
- **Optional**: `created_by_me`, `created_by_user`, `i_am_reviewer`, `project`, `repositoryId`, `skip`, `sourceRefName`, `status`, `targetRefName`, `top`, `user_is_reviewer`

#### mcp_ado_repo_list_pull_requests_by_commits

Lists pull requests by commit IDs to find which pull requests contain specific commits.

- **Required**: `project`, `repository`, `commits`
- **Optional**: `queryType`

#### mcp_ado_repo_get_pull_request_by_id

Get a pull request by its ID.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `project`, `includeWorkItemRefs`, `includeLabels`, `includeChangedFiles`

#### mcp_ado_repo_get_pull_request_changes

Get the file changes (diff) for a pull request iteration with actual code diff content. Returns the code changes including line-by-line diffs made in the pull request.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `iterationId`, `project`, `top`, `skip`, `compareTo`, `includeDiffs`, `includeLineContent`

**Notes**:

- If `iterationId` is not specified, returns changes for the latest iteration
- Use `compareTo` to get changes between two specific iterations
- Supports pagination with `top` and `skip` parameters
- By default, includes line-by-line diff metadata (line numbers, change types) AND actual code content
- Set `includeDiffs=false` to get only file metadata without diff information
- Set `includeLineContent=false` to exclude actual code lines and get only diff metadata (line numbers, change types)
- The diff content includes `lineDiffBlocks` showing line numbers and change types
- By default, each `lineDiffBlock` includes `originalLines` (from base) and `modifiedLines` (from target) arrays with actual code content

#### mcp_ado_repo_create_pull_request

Create a new pull request.

- **Required**: `repositoryId`, `sourceRefName`, `targetRefName`, `title`
- **Optional**: `description`, `forkSourceRepositoryId`, `isDraft`, `labels`, `workItems`

#### mcp_ado_repo_update_pull_request

Update a Pull Request by ID with specified fields.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `autoComplete`, `bypassReason`, `deleteSourceBranch`, `description`, `isDraft`, `mergeStrategy`, `status`, `targetRefName`, `title`, `transitionWorkItems`

#### mcp_ado_repo_update_pull_request_reviewers

Add or remove reviewers for an existing pull request.

- **Required**: `repositoryId`, `pullRequestId`, `reviewerIds`, `action`
- **Optional**: None

#### mcp_ado_repo_vote_pull_request

Cast a vote on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `vote`
- **Optional**: None

#### mcp_ado_repo_list_pull_request_threads

Retrieve a list of comment threads for a pull request.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `baseIteration`, `fullResponse`, `iteration`, `project`, `skip`, `top`

#### mcp_ado_repo_list_pull_request_thread_comments

Retrieve a list of comments in a pull request thread.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`
- **Optional**: `fullResponse`, `project`, `skip`, `top`

#### mcp_ado_repo_create_pull_request_thread

Creates a new comment thread on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `content`
- **Optional**: `filePath`, `project`, `rightFileEndLine`, `rightFileEndOffset`, `rightFileStartLine`, `rightFileStartOffset`, `status`

#### mcp_ado_repo_update_pull_request_thread

Updates an existing comment thread on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`
- **Optional**: `project`, `status`

#### mcp_ado_repo_reply_to_comment

Replies to a specific comment on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`, `content`
- **Optional**: `fullResponse`, `project`

#### mcp_ado_repo_list_directory

List files and folders in a directory within a repository.

- **Required**: `repositoryId`
- **Optional**: `path`, `project`, `version`, `versionType`, `recursive`, `recursionDepth`

#### mcp_ado_repo_get_file_content

Get the content of a file from a Git repository at a specific version (branch, tag, or commit SHA).

- **Required**: `repositoryId`, `path`
- **Optional**: `project`, `version`, `versionType`

### Search

#### mcp_ado_search_code

Search Azure DevOps Repositories for a given search text.

- **Required**: `searchText`
- **Optional**: `branch`, `includeFacets`, `path`, `project`, `repository`, `skip`, `top`

#### mcp_ado_search_wiki

Search Azure DevOps Wiki for a given search text.

- **Required**: `searchText`
- **Optional**: `includeFacets`, `project`, `skip`, `top`, `wiki`

#### mcp_ado_search_workitem

Get Azure DevOps Work Item search results for a given search text.

- **Required**: `searchText`
- **Optional**: `areaPath`, `assignedTo`, `includeFacets`, `project`, `skip`, `state`, `top`, `workItemType`

### Test Plans

> **Note:** The test plan tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#test-plans) tool structure.

The test plan tools are consolidated into grouped dispatchers using an `action` parameter.

#### testplan

Retrieve test plan data for a project.

| Action        | Required params                | Optional params                                                |
| ------------- | ------------------------------ | -------------------------------------------------------------- |
| `list_plans`  | `project`                      | `filterActivePlans`, `includePlanDetails`, `continuationToken` |
| `list_suites` | `project`, `planId`            | `continuationToken`                                            |
| `list_cases`  | `project`, `planId`, `suiteId` | `continuationToken`                                            |

#### testplan_show_test_results_from_build_id

Gets a list of test results for a given project and build ID. Can filter by test outcome (e.g. Failed, Passed, Aborted). Returns test case titles, error messages, stack traces, and outcomes.

- **Required**: `project`, `buildid`
- **Optional**: `outcomes`

#### testplan_test_plan_write

Write operations for test plans.

| Action   | Required params                | Optional params                                   |
| -------- | ------------------------------ | ------------------------------------------------- |
| `create` | `project`, `name`, `iteration` | `description`, `startDate`, `endDate`, `areaPath` |

#### testplan_test_suite_write

Write operations for test suites.

| Action           | Required params                               | Optional params |
| ---------------- | --------------------------------------------- | --------------- |
| `create`         | `project`, `planId`, `parentSuiteId`, `name`  | None            |
| `add_test_cases` | `project`, `planId`, `suiteId`, `testCaseIds` | None            |

#### testplan_test_case_write

Write operations for test cases. Step content supports text formatting — use Markdown markers (`**bold**`, `*italic*`, `__underline__`, `` `code` ``, `[label](url)`) directly in step text and expected results.

| Action         | Required params    | Optional params                                                     |
| -------------- | ------------------ | ------------------------------------------------------------------- |
| `create`       | `project`, `title` | `steps`, `priority`, `areaPath`, `iterationPath`, `testsWorkItemId` |
| `update_steps` | `id`, `steps`      | None                                                                |

### Wiki

> **Note:** The wiki tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#wiki) tool structure.

The wiki tools are consolidated into grouped dispatchers using an `action` parameter.

| Tool               | Action             | Description                                  | Read-only |
| ------------------ | ------------------ | -------------------------------------------- | :-------: |
| `wiki`             | `list_wikis`       | List all wikis in an organization or project |    ✅     |
| `wiki`             | `get_wiki`         | Get details of a specific wiki               |    ✅     |
| `wiki`             | `list_pages`       | List pages in a wiki                         |    ✅     |
| `wiki`             | `get_page`         | Get wiki page metadata (without content)     |    ✅     |
| `wiki`             | `get_page_content` | Retrieve wiki page content                   |    ✅     |
| `wiki_upsert_page` |                    | Create or update a wiki page                 |    ❌     |

### Work Items

#### mcp_ado_wit_get_work_item

Get a single work item by ID.

- **Required**: `id`, `project`
- **Optional**: `asOf`, `expand`, `fields`

#### mcp_ado_wit_get_work_items_batch_by_ids

Retrieve list of work items by IDs in batch.

- **Required**: `project`, `ids`
- **Optional**: `fields`

#### mcp_ado_wit_create_work_item

Create a new work item in a specified project and work item type.

- **Required**: `project`, `workItemType`, `fields`
- **Optional**: None

#### mcp_ado_wit_update_work_item

Update a work item by ID with specified fields.

- **Required**: `id`, `updates`
- **Optional**: None

#### mcp_ado_wit_update_work_items_batch

Update work items in batch.

- **Required**: `updates`
- **Optional**: None

#### mcp_ado_wit_add_child_work_items

Create one or many child work items from a parent by work item type and parent id.

- **Required**: `parentId`, `project`, `workItemType`, `items`
- **Optional**: None

#### mcp_ado_wit_work_items_link

Link work items together in batch.

- **Required**: `project`, `updates`
- **Optional**: None

#### mcp_ado_wit_work_item_unlink

Remove one or many links from a single work item.

- **Required**: `project`, `id`
- **Optional**: `type`, `url`

#### mcp_ado_wit_add_artifact_link

Add artifact links (repository, branch, commit, builds) to work items.

- **Required**: `workItemId`, `project`
- **Optional**: `artifactUri`, `branchName`, `buildId`, `comment`, `commitId`, `linkType`, `projectId`, `pullRequestId`, `repositoryId`

#### mcp_ado_wit_link_work_item_to_pull_request

Link a single work item to an existing pull request.

- **Required**: `projectId`, `repositoryId`, `pullRequestId`, `workItemId`
- **Optional**: `pullRequestProjectId`

#### mcp_ado_wit_list_work_item_comments

Retrieve list of comments for a work item by ID.

- **Required**: `project`, `workItemId`
- **Optional**: `top`

#### mcp_ado_wit_add_work_item_comment

Add comment to a work item by ID.

- **Required**: `project`, `workItemId`, `comment`
- **Optional**: `format`

#### mcp_ado_wit_update_work_item_comment

Update an existing comment on a work item by ID.

- **Required**: `project`, `workItemId`, `commentId`, `text`
- **Optional**: `format`

#### mcp_ado_wit_list_work_item_revisions

Retrieve list of revisions for a work item by ID.

- **Required**: `project`, `workItemId`
- **Optional**: `expand`, `skip`, `top`

#### mcp_ado_wit_get_work_item_type

Get a specific work item type.

- **Required**: `project`, `workItemType`
- **Optional**: None

#### mcp_ado_wit_my_work_items

Retrieve a list of work items relevant to the authenticated user.

- **Required**: `project`
- **Optional**: `includeCompleted`, `top`, `type`

#### mcp_ado_wit_get_work_items_for_iteration

Retrieve a list of work items for a specified iteration.

- **Required**: `project`, `iterationId`
- **Optional**: `team`

#### mcp_ado_wit_list_backlogs

Receive a list of backlogs for a given project and team.

- **Required**: `project`, `team`
- **Optional**: None

#### mcp_ado_wit_list_backlog_work_items

Retrieve a list of backlogs for a given project, team, and backlog category.

- **Required**: `project`, `team`, `backlogId`
- **Optional**: None

#### mcp_ado_wit_get_query

Get a query by its ID or path.

- **Required**: `project`, `query`
- **Optional**: `depth`, `expand`, `includeDeleted`, `useIsoDateFormat`

#### mcp_ado_wit_get_query_results_by_id

Retrieve the results of a work item query given the query ID.

- **Required**: `id`
- **Optional**: `project`, `responseType`, `team`, `timePrecision`, `top`

#### mcp_ado_wit_query_by_wiql

Execute a WIQL (Work Item Query Language) query and return the matching work items. If a project is not specified, you will be prompted to select one.

- **Required**: `wiql`
- **Optional**: `project`, `team`, `timePrecision`, `top`

#### mcp_ado_wit_get_work_item_attachment

Download a work item attachment by its ID. If `savePath` is provided, saves the file to that local directory and returns the file path. Otherwise returns the content as a base64-encoded resource. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs.

- **Required**: `attachmentId`
- **Optional**: `project`, `fileName`, `savePath`

### Work

> **Note:** The work tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work) tool structure.

The work tools are consolidated into grouped dispatchers using an `action` parameter.

| Tool                   | Action                     | Description                                                                             | Read-only |
| ---------------------- | -------------------------- | --------------------------------------------------------------------------------------- | :-------: |
| `work`                 | `list_iterations`          | List all iterations in a project                                                        |    ✅     |
| `work`                 | `list_team_iterations`     | List iterations assigned to a team                                                      |    ✅     |
| `work`                 | `get_team_settings`        | Get team settings including default iteration, backlog iteration, and default area path |    ✅     |
| `work`                 | `get_team_capacity`        | Get team capacity for an iteration                                                      |    ✅     |
| `work`                 | `get_iteration_capacities` | Get an iteration's capacity for all teams in the iteration and project                  |    ✅     |
| `work_iteration_write` | `create`                   | Create iterations                                                                       |    ❌     |
| `work_iteration_write` | `assign`                   | Assign iterations to a team                                                             |    ❌     |
| `work_capacity_write`  | `update`                   | Update the team capacity of a team member for a specific iteration                      |    ❌     |
