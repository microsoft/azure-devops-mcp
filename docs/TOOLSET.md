# Toolset

## Overview

| Functional Area   | Tool                                                                                                      | Description                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Advanced Security | [mcp_ado_advsec_get_alerts](#mcp_ado_advsec_get_alerts)                                                   | Retrieve Advanced Security alerts for a repository       |
| Advanced Security | [mcp_ado_advsec_get_alert_details](#mcp_ado_advsec_get_alert_details)                                     | Get detailed information about a specific security alert |
| Core              | [mcp_ado_core_list_projects](#mcp_ado_core_list_projects)                                                 | List all projects in the organization                    |
| Core              | [mcp_ado_core_list_project_teams](#mcp_ado_core_list_project_teams)                                       | List teams within a project                              |
| Core              | [mcp_ado_core_get_identity_ids](#mcp_ado_core_get_identity_ids)                                           | Retrieve identity IDs by search filter                   |
| Pipelines         | [mcp_ado_pipelines_create_pipeline](#mcp_ado_pipelines_create_pipeline)                                   | Create a new pipeline with YAML configuration            |
| Pipelines         | [mcp_ado_pipelines_get_builds](#mcp_ado_pipelines_get_builds)                                             | Retrieve a list of builds with optional filters          |
| Pipelines         | [mcp_ado_pipelines_get_build_status](#mcp_ado_pipelines_get_build_status)                                 | Get the status of a specific build                       |
| Pipelines         | [mcp_ado_pipelines_get_build_log](#mcp_ado_pipelines_get_build_log)                                       | Retrieve complete logs for a build                       |
| Pipelines         | [mcp_ado_pipelines_get_build_log_by_id](#mcp_ado_pipelines_get_build_log_by_id)                           | Get a specific build log by log ID                       |
| Pipelines         | [mcp_ado_pipelines_get_build_changes](#mcp_ado_pipelines_get_build_changes)                               | Get changes (commits) associated with a build            |
| Pipelines         | [mcp_ado_pipelines_get_build_definitions](#mcp_ado_pipelines_get_build_definitions)                       | List build/pipeline definitions in a project             |
| Pipelines         | [mcp_ado_pipelines_get_build_definition_revisions](#mcp_ado_pipelines_get_build_definition_revisions)     | Get revision history of a build definition               |
| Pipelines         | [mcp_ado_pipelines_run_pipeline](#mcp_ado_pipelines_run_pipeline)                                         | Start a new pipeline run with optional parameters        |
| Pipelines         | [mcp_ado_pipelines_get_run](#mcp_ado_pipelines_get_run)                                                   | Get details of a specific pipeline run                   |
| Pipelines         | [mcp_ado_pipelines_list_runs](#mcp_ado_pipelines_list_runs)                                               | List recent runs for a pipeline                          |
| Pipelines         | [mcp_ado_pipelines_update_build_stage](#mcp_ado_pipelines_update_build_stage)                             | Update a build stage (cancel, retry, or run)             |
| Repositories      | [mcp_ado_repo_list_repos_by_project](#mcp_ado_repo_list_repos_by_project)                                 | List all repositories in a project                       |
| Repositories      | [mcp_ado_repo_get_repo_by_name_or_id](#mcp_ado_repo_get_repo_by_name_or_id)                               | Get repository details by name or ID                     |
| Repositories      | [mcp_ado_repo_list_branches_by_repo](#mcp_ado_repo_list_branches_by_repo)                                 | List all branches in a repository                        |
| Repositories      | [mcp_ado_repo_list_my_branches_by_repo](#mcp_ado_repo_list_my_branches_by_repo)                           | List branches created by current user                    |
| Repositories      | [mcp_ado_repo_get_branch_by_name](#mcp_ado_repo_get_branch_by_name)                                       | Get details of a specific branch                         |
| Repositories      | [mcp_ado_repo_create_branch](#mcp_ado_repo_create_branch)                                                 | Create a new branch from a source branch                 |
| Repositories      | [mcp_ado_repo_search_commits](#mcp_ado_repo_search_commits)                                               | Search for commits with comprehensive filters            |
| Repositories      | [mcp_ado_repo_list_pull_requests_by_repo_or_project](#mcp_ado_repo_list_pull_requests_by_repo_or_project) | List pull requests with optional filters                 |
| Repositories      | [mcp_ado_repo_list_pull_requests_by_commits](#mcp_ado_repo_list_pull_requests_by_commits)                 | Find pull requests containing specific commits           |
| Repositories      | [mcp_ado_repo_get_pull_request_by_id](#mcp_ado_repo_get_pull_request_by_id)                               | Get details of a specific pull request                   |
| Repositories      | [mcp_ado_repo_create_pull_request](#mcp_ado_repo_create_pull_request)                                     | Create a new pull request                                |
| Repositories      | [mcp_ado_repo_update_pull_request](#mcp_ado_repo_update_pull_request)                                     | Update pull request properties and settings              |
| Repositories      | [mcp_ado_repo_update_pull_request_reviewers](#mcp_ado_repo_update_pull_request_reviewers)                 | Add or remove reviewers from a pull request              |
| Repositories      | [mcp_ado_repo_list_pull_request_threads](#mcp_ado_repo_list_pull_request_threads)                         | List comment threads on a pull request                   |
| Repositories      | [mcp_ado_repo_list_pull_request_thread_comments](#mcp_ado_repo_list_pull_request_thread_comments)         | List comments in a specific thread                       |
| Repositories      | [mcp_ado_repo_create_pull_request_thread](#mcp_ado_repo_create_pull_request_thread)                       | Create a new comment thread on a pull request            |
| Repositories      | [mcp_ado_repo_update_pull_request_thread](#mcp_ado_repo_update_pull_request_thread)                       | Update an existing pull request comment thread           |
| Repositories      | [mcp_ado_repo_reply_to_comment](#mcp_ado_repo_reply_to_comment)                                           | Reply to a pull request comment                          |
| Search            | [mcp_ado_search_code](#mcp_ado_search_code)                                                               | Search for code across repositories                      |
| Search            | [mcp_ado_search_wiki](#mcp_ado_search_wiki)                                                               | Search wiki pages by keywords                            |
| Search            | [mcp_ado_search_workitem](#mcp_ado_search_workitem)                                                       | Search work items by text and filters                    |
| Test Plans        | [mcp_ado_testplan_list_test_plans](#mcp_ado_testplan_list_test_plans)                                     | List test plans in a project                             |
| Test Plans        | [mcp_ado_testplan_create_test_plan](#mcp_ado_testplan_create_test_plan)                                   | Create a new test plan                                   |
| Test Plans        | [mcp_ado_testplan_list_test_suites](#mcp_ado_testplan_list_test_suites)                                   | List test suites in a test plan                          |
| Test Plans        | [mcp_ado_testplan_create_test_suite](#mcp_ado_testplan_create_test_suite)                                 | Create a test suite within a test plan                   |
| Test Plans        | [mcp_ado_testplan_add_test_cases_to_suite](#mcp_ado_testplan_add_test_cases_to_suite)                     | Add test cases to a test suite                           |
| Test Plans        | [mcp_ado_testplan_list_test_cases](#mcp_ado_testplan_list_test_cases)                                     | List test cases in a test suite                          |
| Test Plans        | [mcp_ado_testplan_create_test_case](#mcp_ado_testplan_create_test_case)                                   | Create a new test case work item                         |
| Test Plans        | [mcp_ado_testplan_update_test_case_steps](#mcp_ado_testplan_update_test_case_steps)                       | Update steps of an existing test case                    |
| Test Plans        | [mcp_ado_testplan_show_test_results_from_build_id](#mcp_ado_testplan_show_test_results_from_build_id)     | Get test results for a specific build                    |
| Wiki              | [mcp_ado_wiki_list_wikis](#mcp_ado_wiki_list_wikis)                                                       | List wikis in organization or project                    |
| Wiki              | [mcp_ado_wiki_get_wiki](#mcp_ado_wiki_get_wiki)                                                           | Get details of a specific wiki                           |
| Wiki              | [mcp_ado_wiki_list_pages](#mcp_ado_wiki_list_pages)                                                       | List pages in a wiki                                     |
| Wiki              | [mcp_ado_wiki_get_page](#mcp_ado_wiki_get_page)                                                           | Get wiki page metadata (without content)                 |
| Wiki              | [mcp_ado_wiki_get_page_content](#mcp_ado_wiki_get_page_content)                                           | Retrieve wiki page content                               |
| Wiki              | [mcp_ado_wiki_create_or_update_page](#mcp_ado_wiki_create_or_update_page)                                 | Create or update a wiki page                             |
| Work Items        | [mcp_ado_wit_get_work_item](#mcp_ado_wit_get_work_item)                                                   | Get a work item by ID                                    |
| Work Items        | [mcp_ado_wit_get_work_items_batch_by_ids](#mcp_ado_wit_get_work_items_batch_by_ids)                       | Retrieve multiple work items by IDs                      |
| Work Items        | [mcp_ado_wit_create_work_item](#mcp_ado_wit_create_work_item)                                             | Create a new work item                                   |
| Work Items        | [mcp_ado_wit_update_work_item](#mcp_ado_wit_update_work_item)                                             | Update fields of a work item                             |
| Work Items        | [mcp_ado_wit_update_work_items_batch](#mcp_ado_wit_update_work_items_batch)                               | Update multiple work items in batch                      |
| Work Items        | [mcp_ado_wit_add_child_work_items](#mcp_ado_wit_add_child_work_items)                                     | Create child work items under a parent                   |
| Work Items        | [mcp_ado_wit_work_items_link](#mcp_ado_wit_work_items_link)                                               | Link work items together                                 |
| Work Items        | [mcp_ado_wit_work_item_unlink](#mcp_ado_wit_work_item_unlink)                                             | Remove links from a work item                            |
| Work Items        | [mcp_ado_wit_add_artifact_link](#mcp_ado_wit_add_artifact_link)                                           | Link artifacts (commits, builds, PRs) to work items      |
| Work Items        | [mcp_ado_wit_link_work_item_to_pull_request](#mcp_ado_wit_link_work_item_to_pull_request)                 | Link a work item to a pull request                       |
| Work Items        | [mcp_ado_wit_list_work_item_comments](#mcp_ado_wit_list_work_item_comments)                               | List comments on a work item                             |
| Work Items        | [mcp_ado_wit_add_work_item_comment](#mcp_ado_wit_add_work_item_comment)                                   | Add a comment to a work item                             |
| Work Items        | [mcp_ado_wit_list_work_item_revisions](#mcp_ado_wit_list_work_item_revisions)                             | Get revision history of a work item                      |
| Work Items        | [mcp_ado_wit_get_work_item_type](#mcp_ado_wit_get_work_item_type)                                         | Get details of a work item type                          |
| Work Items        | [mcp_ado_wit_my_work_items](#mcp_ado_wit_my_work_items)                                                   | List work items relevant to current user                 |
| Work Items        | [mcp_ado_wit_get_work_items_for_iteration](#mcp_ado_wit_get_work_items_for_iteration)                     | Get work items in a specific iteration                   |
| Work Items        | [mcp_ado_wit_list_backlogs](#mcp_ado_wit_list_backlogs)                                                   | List backlogs for a team                                 |
| Work Items        | [mcp_ado_wit_list_backlog_work_items](#mcp_ado_wit_list_backlog_work_items)                               | Get work items in a backlog                              |
| Work Items        | [mcp_ado_wit_get_query](#mcp_ado_wit_get_query)                                                           | Get a work item query by ID or path                      |
| Work Items        | [mcp_ado_wit_get_query_results_by_id](#mcp_ado_wit_get_query_results_by_id)                               | Execute a query and get results                          |
| Work              | [mcp_ado_work_list_iterations](#mcp_ado_work_list_iterations)                                             | List all iterations in a project                         |
| Work              | [mcp_ado_work_create_iterations](#mcp_ado_work_create_iterations)                                         | Create new iterations in a project                       |
| Work              | [mcp_ado_work_list_team_iterations](#mcp_ado_work_list_team_iterations)                                   | List iterations assigned to a team                       |
| Work              | [mcp_ado_work_assign_iterations](#mcp_ado_work_assign_iterations)                                         | Assign iterations to a team                              |
| Work              | [mcp_ado_work_get_iteration_capacities](#mcp_ado_work_get_iteration_capacities)                           | Get capacity for all teams in an iteration               |
| Work              | [mcp_ado_work_get_team_capacity](#mcp_ado_work_get_team_capacity)                                         | Get capacity for a specific team in iteration            |
| Work              | [mcp_ado_work_update_team_capacity](#mcp_ado_work_update_team_capacity)                                   | Update team member capacity for iteration                |

## Advanced Security

### mcp_ado_advsec_get_alerts

Retrieve Advanced Security alerts for a repository.

- **Required**: `project`, `repository`, `confidenceLevels`
- **Optional**: `alertType`, `continuationToken`, `onlyDefaultBranch`, `orderBy`, `ref`, `ruleId`, `ruleName`, `severities`, `states`, `toolName`, `top`, `validity`

### mcp_ado_advsec_get_alert_details

Get detailed information about a specific Advanced Security alert.

- **Required**: `project`, `repository`, `alertId`
- **Optional**: `ref`

## Core

### mcp_ado_core_list_projects

Retrieve a list of projects in your Azure DevOps organization.

- **Required**: None
- **Optional**: `continuationToken`, `projectNameFilter`, `skip`, `stateFilter`, `top`

### mcp_ado_core_list_project_teams

Retrieve a list of teams for the specified Azure DevOps project.

- **Required**: `project`
- **Optional**: `mine`, `skip`, `top`

### mcp_ado_core_get_identity_ids

Retrieve Azure DevOps identity IDs for a provided search filter.

- **Required**: `searchFilter`
- **Optional**: None

## Pipelines

### mcp_ado_pipelines_create_pipeline

Creates a pipeline definition with YAML configuration for a given project.

- **Required**: `project`, `name`, `yamlPath`, `repositoryType`, `repositoryName`
- **Optional**: `folder`, `repositoryConnectionId`, `repositoryId`

### mcp_ado_pipelines_get_builds

Retrieves a list of builds for a given project.

- **Required**: `project`
- **Optional**: `branchName`, `buildIds`, `buildNumber`, `continuationToken`, `definitions`, `deletedFilter`, `maxBuildsPerDefinition`, `maxTime`, `minTime`, `properties`, `queryOrder`, `queues`, `reasonFilter`, `repositoryId`, `repositoryType`, `requestedFor`, `resultFilter`, `statusFilter`, `tagFilters`, `top`

### mcp_ado_pipelines_get_build_status

Fetches the status of a specific build.

- **Required**: `project`, `buildId`
- **Optional**: None

### mcp_ado_pipelines_get_build_log

Retrieves the logs for a specific build.

- **Required**: `project`, `buildId`
- **Optional**: None

### mcp_ado_pipelines_get_build_log_by_id

Get a specific build log by log ID.

- **Required**: `project`, `buildId`, `logId`
- **Optional**: `endLine`, `startLine`

### mcp_ado_pipelines_get_build_changes

Get the changes associated with a specific build.

- **Required**: `project`, `buildId`
- **Optional**: `continuationToken`, `includeSourceChange`, `top`

### mcp_ado_pipelines_get_build_definitions

Retrieves a list of build definitions for a given project.

- **Required**: `project`
- **Optional**: `builtAfter`, `continuationToken`, `definitionIds`, `includeAllProperties`, `includeLatestBuilds`, `minMetricsTime`, `name`, `notBuiltAfter`, `path`, `processType`, `queryOrder`, `repositoryId`, `repositoryType`, `taskIdFilter`, `top`, `yamlFilename`

### mcp_ado_pipelines_get_build_definition_revisions

Retrieves a list of revisions for a specific build definition.

- **Required**: `project`, `definitionId`
- **Optional**: None

### mcp_ado_pipelines_run_pipeline

Starts a new run of a pipeline.

- **Required**: `project`, `pipelineId`
- **Optional**: `pipelineVersion`, `previewRun`, `resources`, `stagesToSkip`, `templateParameters`, `variables`, `yamlOverride`

### mcp_ado_pipelines_get_run

Gets a run for a particular pipeline.

- **Required**: `project`, `pipelineId`, `runId`
- **Optional**: None

### mcp_ado_pipelines_list_runs

Gets top 10000 runs for a particular pipeline.

- **Required**: `project`, `pipelineId`
- **Optional**: None

### mcp_ado_pipelines_update_build_stage

Updates the stage of a specific build.

- **Required**: `project`, `buildId`, `stageName`, `status`
- **Optional**: `forceRetryAllJobs`

### mcp_ado_pipelines_list_artifacts

Lists artifacts for a given build.

- **Required**: `project`, `buildId`

### mcp_ado_pipelines_download_artifact

Downloads a pipeline artifact.

- **Required**: `project`, `buildId`, `artifactName`
- **Optional**: `destinationPath`

## Repositories

### mcp_ado_repo_list_repos_by_project

Retrieve a list of repositories for a given project.

- **Required**: `project`
- **Optional**: `repoNameFilter`, `skip`, `top`

### mcp_ado_repo_get_repo_by_name_or_id

Get the repository by project and repository name or ID.

- **Required**: `project`, `repositoryNameOrId`
- **Optional**: None

### mcp_ado_repo_list_branches_by_repo

Retrieve a list of branches for a given repository.

- **Required**: `repositoryId`
- **Optional**: `filterContains`, `top`

### mcp_ado_repo_list_my_branches_by_repo

Retrieve a list of my branches for a given repository Id.

- **Required**: `repositoryId`
- **Optional**: `filterContains`, `top`

### mcp_ado_repo_get_branch_by_name

Get a branch by its name.

- **Required**: `repositoryId`, `branchName`
- **Optional**: None

### mcp_ado_repo_create_branch

Create a new branch in the repository.

- **Required**: `repositoryId`, `branchName`
- **Optional**: `sourceBranchName`, `sourceCommitId`

### mcp_ado_repo_search_commits

Search for commits in a repository with comprehensive filtering capabilities.

- **Required**: `project`, `repository`
- **Optional**: `author`, `authorEmail`, `commitIds`, `committer`, `committerEmail`, `fromCommit`, `fromDate`, `historySimplificationMode`, `includeLinks`, `includeWorkItems`, `searchText`, `skip`, `toCommit`, `toDate`, `top`, `version`, `versionType`

### mcp_ado_repo_list_pull_requests_by_repo_or_project

Retrieve a list of pull requests for a given repository.

- **Required**: None (either `repositoryId` or `project` must be provided)
- **Optional**: `created_by_me`, `created_by_user`, `i_am_reviewer`, `project`, `repositoryId`, `skip`, `sourceRefName`, `status`, `targetRefName`, `top`, `user_is_reviewer`

### mcp_ado_repo_list_pull_requests_by_commits

Lists pull requests by commit IDs to find which pull requests contain specific commits.

- **Required**: `project`, `repository`, `commits`
- **Optional**: `queryType`

### mcp_ado_repo_get_pull_request_by_id

Get a pull request by its ID.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `includeWorkItemRefs`

### mcp_ado_repo_create_pull_request

Create a new pull request.

- **Required**: `repositoryId`, `sourceRefName`, `targetRefName`, `title`
- **Optional**: `description`, `forkSourceRepositoryId`, `isDraft`, `labels`, `workItems`

### mcp_ado_repo_update_pull_request

Update a Pull Request by ID with specified fields.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `autoComplete`, `bypassReason`, `deleteSourceBranch`, `description`, `isDraft`, `mergeStrategy`, `status`, `targetRefName`, `title`, `transitionWorkItems`

### mcp_ado_repo_update_pull_request_reviewers

Add or remove reviewers for an existing pull request.

- **Required**: `repositoryId`, `pullRequestId`, `reviewerIds`, `action`
- **Optional**: None

### mcp_ado_repo_list_pull_request_threads

Retrieve a list of comment threads for a pull request.

- **Required**: `repositoryId`, `pullRequestId`
- **Optional**: `baseIteration`, `fullResponse`, `iteration`, `project`, `skip`, `top`

### mcp_ado_repo_list_pull_request_thread_comments

Retrieve a list of comments in a pull request thread.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`
- **Optional**: `fullResponse`, `project`, `skip`, `top`

### mcp_ado_repo_create_pull_request_thread

Creates a new comment thread on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `content`
- **Optional**: `filePath`, `project`, `rightFileEndLine`, `rightFileEndOffset`, `rightFileStartLine`, `rightFileStartOffset`, `status`

### mcp_ado_repo_update_pull_request_thread

Updates an existing comment thread on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`
- **Optional**: `project`, `status`

### mcp_ado_repo_reply_to_comment

Replies to a specific comment on a pull request.

- **Required**: `repositoryId`, `pullRequestId`, `threadId`, `content`
- **Optional**: `fullResponse`, `project`

## Search

### mcp_ado_search_code

Search Azure DevOps Repositories for a given search text.

- **Required**: `searchText`
- **Optional**: `branch`, `includeFacets`, `path`, `project`, `repository`, `skip`, `top`

### mcp_ado_search_wiki

Search Azure DevOps Wiki for a given search text.

- **Required**: `searchText`
- **Optional**: `includeFacets`, `project`, `skip`, `top`, `wiki`

### mcp_ado_search_workitem

Get Azure DevOps Work Item search results for a given search text.

- **Required**: `searchText`
- **Optional**: `areaPath`, `assignedTo`, `includeFacets`, `project`, `skip`, `state`, `top`, `workItemType`

## Test Plans

### mcp_ado_testplan_list_test_plans

Retrieve a paginated list of test plans from an Azure DevOps project.

- **Required**: `project`
- **Optional**: `continuationToken`, `filterActivePlans`, `includePlanDetails`

### mcp_ado_testplan_create_test_plan

Creates a new test plan in the project.

- **Required**: `project`, `name`, `iteration`
- **Optional**: `areaPath`, `description`, `endDate`, `startDate`

### mcp_ado_testplan_list_test_suites

Retrieve a paginated list of test suites from an Azure DevOps project and Test Plan Id. Returns test suites in a properly nested hierarchical structure.

- **Required**: `project`, `planId`
- **Optional**: `continuationToken`

### mcp_ado_testplan_create_test_suite

Creates a new test suite in a test plan.

- **Required**: `project`, `planId`, `parentSuiteId`, `name`
- **Optional**: None

### mcp_ado_testplan_add_test_cases_to_suite

Adds existing test cases to a test suite.

- **Required**: `project`, `planId`, `suiteId`, `testCaseIds`
- **Optional**: None

### mcp_ado_testplan_list_test_cases

Gets a list of test cases in the test plan.

- **Required**: `project`, `planid`, `suiteid`
- **Optional**: None

### mcp_ado_testplan_create_test_case

Creates a new test case work item.

- **Required**: `project`, `title`
- **Optional**: `areaPath`, `iterationPath`, `priority`, `steps`, `testsWorkItemId`

### mcp_ado_testplan_update_test_case_steps

Update an existing test case work item.

- **Required**: `id`, `steps`
- **Optional**: None

### mcp_ado_testplan_show_test_results_from_build_id

Gets a list of test results for a given project and build ID.

- **Required**: `project`, `buildid`
- **Optional**: None

## Wiki

### mcp_ado_wiki_list_wikis

Retrieve a list of wikis for an organization or project.

- **Required**: None
- **Optional**: `project`

### mcp_ado_wiki_get_wiki

Get the wiki by wikiIdentifier.

- **Required**: `wikiIdentifier`
- **Optional**: `project`

### mcp_ado_wiki_list_pages

Retrieve a list of wiki pages for a specific wiki and project.

- **Required**: `wikiIdentifier`, `project`
- **Optional**: `continuationToken`, `pageViewsForDays`, `top`

### mcp_ado_wiki_get_page

Retrieve wiki page metadata by path. This tool does not return page content.

- **Required**: `wikiIdentifier`, `project`, `path`
- **Optional**: `recursionLevel`

### mcp_ado_wiki_get_page_content

Retrieve wiki page content.

- **Required**: None (either `url` OR `wikiIdentifier` and `project`)
- **Optional**: `path`, `project`, `url`, `wikiIdentifier`

### mcp_ado_wiki_create_or_update_page

Create or update a wiki page with content.

- **Required**: `wikiIdentifier`, `path`, `content`
- **Optional**: `branch`, `etag`, `project`

## Work Items

### mcp_ado_wit_get_work_item

Get a single work item by ID.

- **Required**: `id`, `project`
- **Optional**: `asOf`, `expand`, `fields`

### mcp_ado_wit_get_work_items_batch_by_ids

Retrieve list of work items by IDs in batch.

- **Required**: `project`, `ids`
- **Optional**: `fields`

### mcp_ado_wit_create_work_item

Create a new work item in a specified project and work item type.

- **Required**: `project`, `workItemType`, `fields`
- **Optional**: None

### mcp_ado_wit_update_work_item

Update a work item by ID with specified fields.

- **Required**: `id`, `updates`
- **Optional**: None

### mcp_ado_wit_update_work_items_batch

Update work items in batch.

- **Required**: `updates`
- **Optional**: None

### mcp_ado_wit_add_child_work_items

Create one or many child work items from a parent by work item type and parent id.

- **Required**: `parentId`, `project`, `workItemType`, `items`
- **Optional**: None

### mcp_ado_wit_work_items_link

Link work items together in batch.

- **Required**: `project`, `updates`
- **Optional**: None

### mcp_ado_wit_work_item_unlink

Remove one or many links from a single work item.

- **Required**: `project`, `id`
- **Optional**: `type`, `url`

### mcp_ado_wit_add_artifact_link

Add artifact links (repository, branch, commit, builds) to work items.

- **Required**: `workItemId`, `project`
- **Optional**: `artifactUri`, `branchName`, `buildId`, `comment`, `commitId`, `linkType`, `projectId`, `pullRequestId`, `repositoryId`

### mcp_ado_wit_link_work_item_to_pull_request

Link a single work item to an existing pull request.

- **Required**: `projectId`, `repositoryId`, `pullRequestId`, `workItemId`
- **Optional**: `pullRequestProjectId`

### mcp_ado_wit_list_work_item_comments

Retrieve list of comments for a work item by ID.

- **Required**: `project`, `workItemId`
- **Optional**: `top`

### mcp_ado_wit_add_work_item_comment

Add comment to a work item by ID.

- **Required**: `project`, `workItemId`, `comment`
- **Optional**: `format`

### mcp_ado_wit_list_work_item_revisions

Retrieve list of revisions for a work item by ID.

- **Required**: `project`, `workItemId`
- **Optional**: `expand`, `skip`, `top`

### mcp_ado_wit_get_work_item_type

Get a specific work item type.

- **Required**: `project`, `workItemType`
- **Optional**: None

### mcp_ado_wit_my_work_items

Retrieve a list of work items relevant to the authenticated user.

- **Required**: `project`
- **Optional**: `includeCompleted`, `top`, `type`

### mcp_ado_wit_get_work_items_for_iteration

Retrieve a list of work items for a specified iteration.

- **Required**: `project`, `iterationId`
- **Optional**: `team`

### mcp_ado_wit_list_backlogs

Receive a list of backlogs for a given project and team.

- **Required**: `project`, `team`
- **Optional**: None

### mcp_ado_wit_list_backlog_work_items

Retrieve a list of backlogs for a given project, team, and backlog category.

- **Required**: `project`, `team`, `backlogId`
- **Optional**: None

### mcp_ado_wit_get_query

Get a query by its ID or path.

- **Required**: `project`, `query`
- **Optional**: `depth`, `expand`, `includeDeleted`, `useIsoDateFormat`

### mcp_ado_wit_get_query_results_by_id

Retrieve the results of a work item query given the query ID.

- **Required**: `id`
- **Optional**: `project`, `responseType`, `team`, `timePrecision`, `top`

## Work

### mcp_ado_work_list_iterations

List all iterations in a specified Azure DevOps project.

- **Required**: `project`
- **Optional**: `depth`, `excludedIds`

### mcp_ado_work_create_iterations

Create new iterations in a specified Azure DevOps project.

- **Required**: `project`, `iterations`
- **Optional**: None

### mcp_ado_work_list_team_iterations

Retrieve a list of iterations for a specific team in a project.

- **Required**: `project`, `team`
- **Optional**: `timeframe`

### mcp_ado_work_assign_iterations

Assign existing iterations to a specific team in a project.

- **Required**: `project`, `team`, `iterations`
- **Optional**: None

### mcp_ado_work_get_iteration_capacities

Get an iteration's capacity for all teams in iteration and project.

- **Required**: `project`, `iterationId`
- **Optional**: None

### mcp_ado_work_get_team_capacity

Get the team capacity of a specific team and iteration in a project.

- **Required**: `project`, `team`, `iterationId`
- **Optional**: None

### mcp_ado_work_update_team_capacity

Update the team capacity of a team member for a specific iteration in a project.

- **Required**: `project`, `team`, `teamMemberId`, `iterationId`, `activities`
- **Optional**: `daysOff`
