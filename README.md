# Azure DevOps MCP Server — On-Premises Edition

This is an MCP server for **Azure DevOps Server 2022.2 (on-premises)**. It connects to your self-hosted ADO Server instance using a Personal Access Token and exposes ADO capabilities to MCP-compatible clients such as VS Code with GitHub Copilot, Claude Code, Cursor, and others.

> This fork targets ADO Server 2022.2 only. Cloud-specific features have been removed. There are no dual-mode switches.

## Prerequisites

- Node.js 20+
- Azure DevOps Server 2022.2 (on-premises)
- A Personal Access Token (PAT) with appropriate scopes

## Configuration

Set the following environment variables before starting the server:

| Variable | Required | Description |
|----------|----------|-------------|
| `ADO_SERVER_URL` | Yes | Full collection URL, e.g. `https://ado.company.internal/tfs/DefaultCollection` |
| `ADO_PAT` | Yes | Personal Access Token |
| `LOG_LEVEL` | No | Logging level: `debug`, `info`, `warn`, `error` (default: `info`) |

### Example `.env`

```env
ADO_SERVER_URL=https://ado.company.internal/tfs/DefaultCollection
ADO_PAT=your-personal-access-token-here
LOG_LEVEL=info
```

### Example `mcp.json`

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "mcp-server-azuredevops",
      "args": [],
      "env": {
        "ADO_SERVER_URL": "https://ado.company.internal/tfs/DefaultCollection",
        "ADO_PAT": "your-personal-access-token-here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

To load only specific domains (see [Domains](#domains) below):

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "mcp-server-azuredevops",
      "args": ["-d", "core", "work", "work-items"],
      "env": {
        "ADO_SERVER_URL": "https://ado.company.internal/tfs/DefaultCollection",
        "ADO_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

## Installation

```bash
npm install -g @azure-devops/mcp
```

Then set your environment variables and run:

```bash
ADO_SERVER_URL=https://ado.company.internal/tfs/DefaultCollection ADO_PAT=<token> mcp-server-azuredevops
```

## Domains

The server groups tools into domains. Use `-d` to enable only what you need:

| Domain | Description |
|--------|-------------|
| `core` | Projects and teams |
| `work` | Iterations and team capacity |
| `work-items` | Work item tracking (CRUD, queries, links) |
| `repositories` | Git repos and pull requests |
| `pipelines` | Build pipelines and runs |
| `wiki` | Wiki pages |
| `test-plans` | Test plans, suites, cases |
| `search` | Code, wiki, and work item search |

By default all domains are loaded. We recommend always enabling `core`.

## Supported Tools

### core
- `core_list_projects` — List projects in the collection
- `core_list_project_teams` — List teams for a project
- `core_get_identity_ids` — Search identity IDs by name or email

### work
- `work_list_team_iterations` — List iterations for a team
- `work_list_iterations` — List all iterations in a project
- `work_create_iterations` — Create iterations with dates
- `work_assign_iterations` — Assign iterations to a team
- `work_get_team_capacity` — Get team member capacity
- `work_update_team_capacity` — Update team capacity settings
- `work_get_iteration_capacities` — Get capacity for an iteration
- `work_get_team_settings` — Get team configuration settings

### work-items
- `wit_my_work_items` — Work items assigned to current user
- `wit_list_backlogs` — List backlogs
- `wit_list_backlog_work_items` — Get work items in a backlog
- `wit_get_work_item` — Get a work item by ID
- `wit_get_work_items_batch_by_ids` — Batch fetch work items
- `wit_update_work_item` — Update work item fields
- `wit_create_work_item` — Create a new work item
- `wit_list_work_item_comments` — List comments on a work item
- `wit_list_work_item_revisions` — Get revision history
- `wit_get_work_items_for_iteration` — Work items in an iteration
- `wit_add_work_item_comment` — Add a comment
- `wit_update_work_item_comment` — Edit a comment
- `wit_add_child_work_items` — Add child work items
- `wit_link_work_item_to_pull_request` — Link to a PR
- `wit_get_work_item_type` — Get work item type definition
- `wit_get_query` — Get a WIQL query definition
- `wit_get_query_results_by_id` — Execute a query
- `wit_update_work_items_batch` — Batch update work items
- `wit_work_items_link` — Link two work items
- `wit_work_item_unlink` — Remove a link
- `wit_add_artifact_link` — Add an artifact link

### repositories
- `repo_list_repos_by_project` — List repositories
- `repo_list_pull_requests_by_repo_or_project` — List PRs
- `repo_list_branches_by_repo` — List branches
- `repo_list_my_branches_by_repo` — List user's branches
- `repo_list_pull_request_threads` — PR comment threads
- `repo_list_pull_request_thread_comments` — Comments in a thread
- `repo_get_repo_by_name_or_id` — Get repository details
- `repo_get_branch_by_name` — Get branch details
- `repo_get_pull_request_by_id` — Get PR details
- `repo_create_pull_request` — Create a PR
- `repo_create_branch` — Create a branch
- `repo_update_pull_request` — Update a PR
- `repo_update_pull_request_reviewers` — Manage reviewers
- `repo_reply_to_comment` — Reply to a PR comment
- `repo_create_pull_request_thread` — Create a comment thread
- `repo_update_pull_request_thread` — Update a comment thread
- `repo_search_commits` — Search commits
- `repo_list_pull_requests_by_commits` — PRs for commits
- `repo_vote_pull_request` — Approve/reject a PR
- `repo_list_directory` — List files in a repo path

### pipelines
- `pipelines_get_builds` — List builds
- `pipelines_get_build_changes` — Changes in a build
- `pipelines_get_build_definitions` — List build definitions
- `pipelines_get_build_definition_revisions` — Definition versions
- `pipelines_get_build_log` — Retrieve build logs
- `pipelines_get_build_log_by_id` — Get a specific log file
- `pipelines_get_build_status` — Build status/report
- `pipelines_update_build_stage` — Retry or cancel a stage
- `pipelines_create_pipeline` — Create a pipeline
- `pipelines_get_run` — Get a pipeline run
- `pipelines_list_runs` — List pipeline runs
- `pipelines_run_pipeline` — Trigger a pipeline
- `pipelines_list_artifacts` — List build artifacts
- `pipelines_download_artifact` — Download an artifact

### wiki
- `wiki_list_wikis` — List wikis in a project
- `wiki_get_wiki` — Get a specific wiki
- `wiki_list_pages` — List wiki pages
- `wiki_get_page` — Get wiki page metadata
- `wiki_get_page_content` — Get wiki page content
- `wiki_create_or_update_page` — Create or update a page

### test-plans
- `testplan_create_test_plan` — Create a test plan
- `testplan_create_test_case` — Create a test case
- `testplan_update_test_case_steps` — Update test case steps
- `testplan_add_test_cases_to_suite` — Add test cases to a suite
- `testplan_show_test_results_from_build_id` — Test results from a build
- `testplan_list_test_cases` — List test cases
- `testplan_list_test_plans` — List test plans
- `testplan_list_test_suites` — List test suites
- `testplan_create_test_suite` — Create a test suite

### search
- `search_code` — Search code repositories
- `search_wiki` — Search wiki pages
- `search_workitem` — Search work items

## Removed Features

The following cloud-only features were removed from the original server and are not available in this on-prem edition:

| Feature / Domain | Reason |
|-----------------|--------|
| `advanced-security` domain (`advsec_get_alerts`, `advsec_get_alert_details`) | Advanced Security (GHAS for Azure DevOps) is a cloud-only service. No REST API for on-premises in ADO Server 2022.2. |
| Tenant discovery (`org-tenants.ts`) | Called `vssps.dev.azure.com` to resolve Azure AD tenant IDs. Not applicable to on-premises AD. |
| Interactive OAuth / MSAL authentication | Uses Microsoft identity platform (Entra ID / AAD). Not available for on-prem AD authentication. |
| Azure CLI authentication (`azcli`) | Depends on `az login` with Microsoft identity platform. Not applicable on-prem. |
| Default Azure Credential chain (`env`) | Depends on Azure managed identity or Entra ID. Not applicable on-prem. |
| `ADO_MCP_AUTH_TOKEN` env var | Renamed to `ADO_PAT` for clarity. |
| `organization` CLI positional argument | Replaced by `ADO_SERVER_URL` environment variable which carries the full collection URL. |
| `--authentication` / `--tenant` CLI flags | Removed — PAT via `ADO_PAT` is the only authentication method. |

## Authentication

PAT (Personal Access Token) authentication is used exclusively. The server encodes the PAT as HTTP Basic authentication (`Authorization: Basic base64(:PAT)`), which is the standard and recommended method for on-premises Azure DevOps Server.

To create a PAT in Azure DevOps Server: **User Settings → Personal Access Tokens → New Token**.

## API Version

All REST API calls use **api-version=7.1**, which is the maximum stable version supported by Azure DevOps Server 2022.2.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Licensed under the [MIT License](./LICENSE.md).
