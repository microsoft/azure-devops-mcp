# Azure DevOps MCP — Ontwikkel- en testplan

## Huidige status (2026-05-04, sessie 2)

### ✅ Afgerond
- AzureDevOpsOptions configuratiemodel
- AzureDevOpsConnectionFactory (PAT auth via VssConnection)
- **GetWorkItemContext use case**: complete (end-to-end + tests)
  - IWorkItemContextService interface (Application laag)
  - AzureDevOpsWorkItemContextService implementatie (Infrastructure laag)
  - WorkItemTools MCP tool
  - 2 fixture-backed integration tests ✅
- **CreateFeatureBranch use case**: complete (end-to-end + tests + live validatie)
  - IRepositoryService interface (Application laag)
  - AzureDevOpsRepositoryService implementatie (Infrastructure laag, GitHttpClient)
  - RepositoryTools MCP tool
  - 2 fixture-backed integration tests ✅
  - Live smoke test ✅ (DependabotTest/VulnerableDotNet, master → feature/mcp-smoke-test)
  - Bugfix: `GetRefsAsync` filter moet `heads/{branchName}` zijn (niet alleen `{branchName}`)
  - Branches met slash in naam werken ook (bv. `feature/mcp-smoke-test` als source) ✅
- Program.cs service registration (DI + MCP transport)
- appsettings.Development.json in .gitignore gezet

### 📊 Test status
- Integration tests: **4/4 slaagd** (WorkItemTools × 2 + RepositoryTools × 2)
- Build: ✅ Alle 8 projecten compileren
- Live smoke tests: GetWorkItemContext ✅, CreateFeatureBranch ✅

- **AddWorkItemComment use case**: complete (end-to-end + tests + live validatie)
  - `AddCommentResult` DTO + `AddCommentAsync` op `IWorkItemContextService`
  - Implementatie via `WorkItemTrackingHttpClient.AddCommentAsync`
  - MCP tool `AddWorkItemComment(project, workItemId, comment)`
  - 2 fixture-backed integration tests ✅
  - Live smoke test ✅

- **LinkBranchToWorkItem use case**: complete (end-to-end + tests + live validatie)
  - `LinkBranchResult` DTO + `LinkBranchToWorkItemAsync` op `IRepositoryService`
  - Implementatie via vstfs artifact URL + `WorkItemTrackingHttpClient.UpdateWorkItemAsync`
  - MCP tool `LinkBranchToWorkItem(project, repository, branchName, workItemId)`
  - 2 fixture-backed integration tests ✅
  - Live smoke test ✅

### 📊 Test status
- Integration tests: **8/8 slaagd** (WorkItemTools × 4 + RepositoryTools × 4)
- Build: ✅ Clean

### ⏳ Volgende capabilities
- **CreatePullRequestForWorkItem use case**: complete (end-to-end + tests)
  - `CreatePullRequestResult` DTO + `CreatePullRequestAsync` op `IRepositoryService`
  - Implementatie via `GitHttpClient.CreatePullRequestAsync` met `WorkItemRefs` koppeling
  - MCP tool `CreatePullRequestForWorkItem(project, repository, sourceBranch, targetBranch, title, workItemId)`
  - 2 fixture-backed integration tests ✅

### 📊 Test status
- Integration tests: **10/10 slaagd** (WorkItemTools × 4 + RepositoryTools × 6)
- Build: ✅ Clean

### ✅ Alle geplande capabilities zijn geïmplementeerd
1. GetWorkItemContext ✅
2. CreateFeatureBranch ✅
3. AddWorkItemComment ✅
4. LinkBranchToWorkItem ✅
5. CreatePullRequestForWorkItem ✅

---

## Teststrategie (ACTUEEL)

### 1. Fixture-backed integration tests ✅
**Status**: 2 tests, beide slaagd
**Locatie**: `tests/AzureDevOpsServerMCP.IntegrationTests/WorkItemToolsFixtureTests.cs`
**Doel**: valideer tool wiring, JSON-RPC response shape, error serialisatie
**Fixture**: `tests/AzureDevOpsServerMCP.IntegrationTests/Fixtures/work-item-context-result.json`

Deze tests zijn stabiel, snel, en niet afhankelijk van echte DevOps instances. Voldoende dekking voor tool level.

### 2. Unit tests
**Status**: ⏳ Uitgesteld
**Reden**: Azure DevOps SDK method signatures zijn complex (named params, nullable optionals); direct Moq-mocking is ingewikkeld
**Alternatief**: Fixture-backed integration tests geven voldoende dekking voorlopig
**Hervatten**: Alleen als toekomstige wijzigingen in mappinglogica unit test coverage vereisen

### 3. Live smoke test
**Status**: ⏳ Handmatig, eenmaal bewezen
**Doel**: end-to-end validatie tegen echte DevOps (enkel voor bepaalde commits)
**Niet in CI**: Zou flaky zijn op onvoorspelbare wijzigingen in DevOps

---

## Project structuur

```
dotnet/
├── src/
│   ├── AzureDevOpsServerMCP.Application/
│   │   └── Services/ (IWorkItemContextService, DTO's)
│   ├── AzureDevOpsServerMCP.Infrastructure.AzureDevOps/
│   │   └── Services/ (AzureDevOpsWorkItemContextService)
│   ├── AzureDevOpsServerMCP.Tools/
│   │   └── WorkItemTools.cs (MCP tool def)
│   └── AzureDevOpsServerMCP.Server/
│       ├── Program.cs (DI + MCP registration)
│       └── appsettings.Development.json (✅ in .gitignore)
├── tests/
│   ├── AzureDevOpsServerMCP.UnitTests/ (TODO: add service tests)
│   └── AzureDevOpsServerMCP.IntegrationTests/
│       ├── WorkItemToolsFixtureTests.cs ✅
│       └── Fixtures/work-item-context-result.json ✅
└── docs/
    └── plan.md (dit bestand)
```

---

## Volgende stap(pen)

**Prioriteit 1**: LinkBranchToWorkItem
- Voorwaarde: CreateFeatureBranch is klaar ✅
- Functie: artifact link toevoegen aan work item
- MCP tool: `WorkItemTools.LinkBranchToWorkItem(project, workItemId, branchName, repository)`
- Implementatie: WorkItemTrackingHttpClient.UpdateWorkItemAsync met add-link patch operation

**Prioriteit 2**: AddWorkItemComment
- Functie: comment toevoegen aan bestaand work item
- MCP tool: `WorkItemTools.AddWorkItemComment(project, workItemId, comment)`
- Implementatie: WorkItemTrackingHttpClient.AddCommentAsync

**Prioriteit 3**: HTML stripping in responses
- Tool retourneert momenteel raw HTML uit Azure DevOps
- Optie: HTML → platte tekst converter in Application laag
- Kan uniform toepassen op GetWorkItemContext + toekomstige capabilities

**Prioriteit 4**: CreatePullRequestForWorkItem
- Vereist: GitHttpClient.CreatePullRequestAsync
- Koppeling: link PR aan work item via LinkBranchToWorkItem

Laatst bijgewerkt: 2026-05-04 (sessie 2)
