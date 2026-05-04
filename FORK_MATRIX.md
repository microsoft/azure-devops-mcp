# Fork Capability Matrix

This matrix compares capabilities from the original Azure DevOps MCP Server with the current .NET fork.

- Upstream source: [docs/TOOLSET.md](docs/TOOLSET.md)
- Fork implementation: [dotnet](dotnet)

| Capability | Upstream equivalent (toolset) | Fork tool | Status |
| --- | --- | --- | --- |
| Get work item context (details + comments) | `mcp_ado_wit_get_work_item`, `mcp_ado_wit_list_work_item_comments` | `GetWorkItemContext` | Implemented |
| Add comment to work item | `mcp_ado_wit_add_work_item_comment` | `AddWorkItemComment` | Implemented |
| Create feature branch | `mcp_ado_repo_create_branch` | `CreateFeatureBranch` | Implemented |
| Link branch to work item (artifact link) | `mcp_ado_wit_add_artifact_link` | `LinkBranchToWorkItem` | Implemented |
| Create pull request and link to work item | `mcp_ado_repo_create_pull_request`, `mcp_ado_wit_link_work_item_to_pull_request` | `CreatePullRequestForWorkItem` | Implemented |
| Pipelines | `mcp_ado_pipelines_*` | - | Not implemented |
| Wiki | `mcp_ado_wiki_*` | - | Not implemented |
| Search | `mcp_ado_search_*` | - | Not implemented |
| Test Plans | `mcp_ado_testplan_*` | - | Not implemented |
| Advanced Security | `mcp_ado_advsec_*` | - | Not implemented |
| Core (projects/teams/identity) | `mcp_ado_core_*` | - | Not implemented |
| Work (iterations/capacity/settings) | `mcp_ado_work_*` | - | Not implemented |

## Notes

- This fork currently focuses on a limited, pragmatic subset in the [dotnet](dotnet) implementation.
- The current scope mainly covers repository + work item collaboration workflows for feature delivery.
