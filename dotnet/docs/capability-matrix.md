# Capability Matrix

This matrix tracks scope and implementation progress for the .NET Azure DevOps MCP server.

## Status Legend

- Planned
- In implementation
- Implemented
- Verified
- Out of scope

## Phase 1 Matrix

| Capability | Use Case Value | TypeScript Reference | .NET Target | PAT Scope | Status | Test Coverage | Notes |
|---|---|---|---|---|---|---|---|
| Work item context ophalen | Agent kan meteen issue-context lezen (details, links, comments) | src/tools/work-items.ts (`wit_get_work_item`, `wit_list_work_item_comments`) | `GetWorkItemContext` | Work Items (Read & write) | Planned | Unit + integration (planned) | Samengestelde tool die read calls combineert |
| Feature branch creeren | Agent kan geautomatiseerd branch starten vanuit work item | src/tools/repositories.ts (`repo_create_branch`) | `CreateFeatureBranch` | Code (Read & write) | Planned | Unit + integration (planned) | Branch naming deterministic houden |
| Branch linken aan work item | Traceability tussen code branch en work item | src/tools/work-items.ts (`wit_add_artifact_link`) | `LinkBranchToWorkItem` | Work Items (Read & write) | Planned | Unit + integration (planned) | Gebruikt `vstfs:///Git/Ref/...` artifact link |
| Work item comment toevoegen | Audittrail voor agent-acties op het work item | src/tools/work-items.ts (`wit_add_work_item_comment`) | `AddWorkItemComment` | Work Items (Read & write) | Planned | Unit + integration (planned) | Gebruik vaste comment templates |
| Work item comment updaten | Correctie van eerdere auditcomment zonder ruis | src/tools/work-items.ts (`wit_update_work_item_comment`) | `UpdateWorkItemComment` | Work Items (Read & write) | Planned | Unit + integration (planned) | Optioneel in fase 1 |
| Pull request openen vanuit flow | Snellere overgang van branch naar review | src/tools/repositories.ts (`repo_create_pull_request`) | `CreatePullRequestForWorkItem` | Code (Read & write) | Planned | Integration (planned) | Na basisflow prioriteren |

## Explicit Out Of Scope (Current)

| Capability | Reason |
|---|---|
| Advanced Security | Niet nodig voor fase 1 use case |
| Wiki | Geen directe waarde voor branch/work item workflow |
| Search | Later evalueren op echte behoefte |
| Test Plans | Buiten scope van huidige use case |
