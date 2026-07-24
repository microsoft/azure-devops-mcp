# Toolset

This page lists all available tools provided by the local Azure DevOps MCP server. Use it as a reference to understand what each tool does, what parameters it requires, and how tools are organized by functional area.

## Overview

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

## Details

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

### Work Items

> **Note:** The work item tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#work-items) tool structure.

The work item tools are consolidated into grouped dispatchers using an `action` parameter.

#### wit_work_item

Retrieve work item data for a project.

| Action               | Required params | Optional params                              |
| -------------------- | --------------- | -------------------------------------------- |
| `get`                | `id`            | `project`, `asOf`, `expand`, `fields`        |
| `get_batch`          | `ids`           | `project`, `fields`, `top`                   |
| `list_comments`      | `workItemId`    | `project`, `top`                             |
| `my`                 |                 | `project`, `includeCompleted`, `top`, `type` |
| `list_revisions`     | `workItemId`    | `project`, `expand`, `skip`, `top`           |
| `list_for_iteration` | `iterationId`   | `project`, `team`                            |
| `get_type`           | `workItemType`  | `project`                                    |

#### wit_work_item_write

Write operations for work items.

| Action         | Required params                                | Optional params |
| -------------- | ---------------------------------------------- | --------------- |
| `create`       | `project`, `workItemType`, `fields`            | None            |
| `update`       | `id`, `updates`                                | None            |
| `update_batch` | `batchUpdates`                                 | None            |
| `add_child`    | `project`, `workItemType`, `parentId`, `items` | None            |

#### wit_work_item_comment_write

Write operations for work item comments.

| Action   | Required params                              | Optional params |
| -------- | -------------------------------------------- | --------------- |
| `add`    | `project`, `workItemId`, `text`              | `format`        |
| `update` | `project`, `workItemId`, `commentId`, `text` | `format`        |

#### wit_work_item_link_write

Write operations for work item links.

| Action                 | Required params                                            | Optional params                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `link`                 | `updates`                                                  | `project`                                                                                                                                               |
| `unlink`               | `id`, `type`                                               | `project`, `url`                                                                                                                                        |
| `link_to_pull_request` | `projectId`, `repositoryId`, `pullRequestId`, `workItemId` | `project`, `pullRequestProjectId`                                                                                                                       |
| `add_artifact_link`    | `workItemId`, `project`                                    | `artifactUri`, `branchName`, `buildId`, `commitId`, `comment`, `linkType`, `pageId`, `pagePath`, `projectId`, `pullRequestId`, `repositoryId`, `wikiId` |

#### wit_query

Retrieve work item query data for a project.

| Action        | Required params | Optional params                                                    |
| ------------- | --------------- | ------------------------------------------------------------------ |
| `get`         | `query`         | `project`, `depth`, `expand`, `includeDeleted`, `useIsoDateFormat` |
| `get_results` | `id`            | `project`, `responseType`, `team`, `timePrecision`, `top`          |
| `wiql`        | `wiql`          | `project`, `team`, `timePrecision`, `top`                          |

#### wit_backlog

Retrieve backlog data for a project and team.

| Action            | Required params                | Optional params |
| ----------------- | ------------------------------ | --------------- |
| `list`            | `project`, `team`              | None            |
| `list_work_items` | `project`, `team`, `backlogId` | None            |

#### wit_work_item_attachment

Download a work item attachment by its ID. By default returns the content as a base64-encoded resource. If `savePath` is provided, saves the file locally to that directory and returns the file path instead. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs.

- **Required**: `attachmentId`
- **Optional**: `project`, `fileName`, `savePath`

### Repositories

> **Note:** The repository tools are being aligned with the [Azure DevOps remote MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#repos) tool structure.

The repository tools are consolidated into grouped dispatchers using an `action` parameter.

#### repo_repository

Retrieve repository data for an organization or project.

| Action | Required params                 | Optional params                 |
| ------ | ------------------------------- | ------------------------------- |
| `get`  | `project`, `repositoryNameOrId` | None                            |
| `list` | `project`                       | `repoNameFilter`, `skip`, `top` |

#### repo_pull_request

Retrieve pull request data.

| Action            | Required params                    | Optional params                                                                                                                                               |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get`             | `repositoryId`, `pullRequestId`    | `project`, `includeChangedFiles`, `includeLabels`, `includeWorkItemRefs`                                                                                      |
| `list`            | `repositoryId` or `project`        | `created_by_me`, `created_by_user`, `i_am_reviewer`, `project`, `repositoryId`, `skip`, `sourceRefName`, `status`, `targetRefName`, `top`, `user_is_reviewer` |
| `list_by_commits` | `project`, `repository`, `commits` | `queryType`                                                                                                                                                   |

#### repo_pull_request_thread

Retrieve pull request thread and comment data.

| Action          | Required params                             | Optional params                                                                                                      |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `list`          | `repositoryId`, `pullRequestId`             | `authorDisplayName`, `authorEmail`, `baseIteration`, `fullResponse`, `iteration`, `project`, `skip`, `status`, `top` |
| `list_comments` | `repositoryId`, `pullRequestId`, `threadId` | `fullResponse`, `project`, `skip`, `top`                                                                             |

#### repo_branch

Retrieve branch data for a repository.

| Action      | Required params              | Optional params                    |
| ----------- | ---------------------------- | ---------------------------------- |
| `get`       | `repositoryId`, `branchName` | `project`                          |
| `list`      | `repositoryId`               | `filterContains`, `project`, `top` |
| `list_mine` | `repositoryId`               | `filterContains`, `project`, `top` |

#### repo_file

Retrieve file data from a repository.

| Action           | Required params        | Optional params                                                            |
| ---------------- | ---------------------- | -------------------------------------------------------------------------- |
| `get_content`    | `repositoryId`, `path` | `project`, `version`, `versionType`                                        |
| `list_directory` | `repositoryId`         | `path`, `project`, `recursive`, `recursionDepth`, `version`, `versionType` |

#### repo_search_commits

Search commits with filtering by text, author, date range, and more.

- **Required**: `searchText`
- **Optional**: `author`, `branch`, `commitEndDate`, `commitStartDate`, `includeFacets`, `orderBy`, `project`, `repository`, `skip`, `top`

#### repo_pull_request_write

Write operations for pull requests.

| Action             | Required params                                                  | Optional params                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`           | `repositoryId`, `sourceRefName`, `targetRefName`, `title`        | `description`, `forkSourceRepositoryId`, `isDraft`, `labels`, `project`, `workItems`                                                                                                                  |
| `update`           | `repositoryId`, `pullRequestId`                                  | `autoComplete`, `bypassReason`, `deleteSourceBranch`, `description`, `isDraft`, `labels`, `mergeCommitMessage`, `mergeStrategy`, `project`, `status`, `targetRefName`, `title`, `transitionWorkItems` |
| `update_reviewers` | `repositoryId`, `pullRequestId`, `reviewerIds`, `reviewerAction` | `project`                                                                                                                                                                                             |
| `vote`             | `repositoryId`, `pullRequestId`, `vote`                          | `project`                                                                                                                                                                                             |

#### repo_pull_request_thread_write

Write operations for pull request comment threads.

| Action          | Required params                                        | Optional params                                                                                                         |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `create`        | `repositoryId`, `pullRequestId`, `content`             | `filePath`, `project`, `rightFileEndLine`, `rightFileEndOffset`, `rightFileStartLine`, `rightFileStartOffset`, `status` |
| `reply`         | `repositoryId`, `pullRequestId`, `threadId`, `content` | `fullResponse`, `project`                                                                                               |
| `update_status` | `repositoryId`, `pullRequestId`, `threadId`, `status`  | `project`                                                                                                               |

#### repo_create_branch

Create a new branch in the repository.

- **Required**: `repositoryId`, `branchName`
- **Optional**: `project`, `sourceBranchName`, `sourceCommitId`

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

### Advanced Security

#### mcp_ado_advsec_get_alerts

Retrieve Advanced Security alerts for a repository.

- **Required**: `project`, `repository`, `confidenceLevels`
- **Optional**: `alertType`, `continuationToken`, `onlyDefaultBranch`, `orderBy`, `ref`, `ruleId`, `ruleName`, `severities`, `states`, `toolName`, `top`, `validity`

#### mcp_ado_advsec_get_alert_details

Get detailed information about a specific Advanced Security alert.

- **Required**: `project`, `repository`, `alertId`
- **Optional**: `ref`
