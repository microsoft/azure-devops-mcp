# Fork Capability Matrix

Project: G5e.AzureDevOpsServerMCP

This matrix compares capabilities from the original Azure DevOps MCP Server with the current .NET fork.

- Upstream source: [docs/TOOLSET.md](docs/TOOLSET.md)
- Fork implementation: [dotnet](dotnet)

| Capability | Upstream equivalent (toolset) | Fork tool | Status |
| --- | --- | --- | --- |
| Get work item context (details + comments) | `mcp_ado_wit_get_work_item`, `mcp_ado_wit_list_work_item_comments` | `wit_get_work_item` | Implemented |
| Add comment to work item | `mcp_ado_wit_add_work_item_comment` | `wit_add_work_item_comment` | Implemented |
| Create feature branch | `mcp_ado_repo_create_branch` | `repo_create_branch` | Implemented |
| Link branch to work item (artifact link) | `mcp_ado_wit_add_artifact_link` | `wit_add_artifact_link` | Implemented |
| Create pull request and link to work item | `mcp_ado_repo_create_pull_request`, `mcp_ado_wit_link_work_item_to_pull_request` | `repo_create_pull_request` | Implemented |
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
- `repo_create_pull_request` in this fork also links the pull request to a work item and supports an optional Markdown description for the pull request body.
- The implemented fork capabilities were validated with fixture-backed integration tests and manual smoke tests.

## NuGet Feed Example (GitHub Packages)

If you publish this fork's packages to GitHub Packages, consumers can configure a `NuGet.config` like this:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
	<packageSources>
		<add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
		<add key="github-g5e" value="https://nuget.pkg.github.com/gadeynebram/index.json" />
	</packageSources>
	<packageSourceCredentials>
		<github-g5e>
			<add key="Username" value="GITHUB_USERNAME" />
			<add key="ClearTextPassword" value="GITHUB_PAT" />
		</github-g5e>
	</packageSourceCredentials>
</configuration>
```

Notes:

- Replace `OWNER` with your GitHub organization or user name.
- The PAT must at least include `read:packages` for restore (and `write:packages` when publishing).
- Prefer CI/CD secrets or environment-based credential injection over committing plaintext tokens.
