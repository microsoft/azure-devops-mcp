# Azure DevOps MCP — Ontwikkel- en testplan

## Huidige status (2026-05-04)

### ✅ Afgerond
- AzureDevOpsOptions configuratiemodel
- AzureDevOpsConnectionFactory (PAT auth via VssConnection)
- IWorkItemContextService interface (Application laag)
- AzureDevOpsWorkItemContextService implementatie (Infrastructure laag)
- WorkItemTools MCP tool met GetWorkItemContext
- Program.cs service registration en MCP HTTP transport
- **End-to-end validatie**: live test tegen echte Azure DevOps, work item 1 succesvol opgehaald met comments
- **FixtureTests**: deterministische integration tests met fake service en JSON fixture (2 tests, beide slaagd)
- appsettings.Development.json uit git verwijderd, in .gitignore gezet
- Moq + Azure DevOps SDK packages toegevoegd aan UnitTests project

### 🚧 Volgende fase
- **Unit tests uitgesteld**: SDK method signatures zijn complex; fixture-backed integration tests geven voldoende dekking voor nu
- **Formatering**: HTML → platte tekst in descriptions/comments (later)
- **Volgende capability**: CreateFeatureBranch
- Formaat cleanup (HTML → platte tekst in descriptions/comments)

### ⏳ Volgende capabilities
- CreateFeatureBranch (Git branch management)
- LinkBranchToWorkItem (artifact links)
- AddWorkItemComment
- CreatePullRequestForWorkItem

---

## Teststrategie (ACTUEEL)

### 1. Fixture-backed integration tests ✅
**Status**: 2 tests, beide slaagd
**Locatie**: `tests/AzureDevOps.Mcp.IntegrationTests/WorkItemToolsFixtureTests.cs`
**Doel**: valideer tool wiring, JSON-RPC response shape, error serialisatie
**Fixture**: `tests/AzureDevOps.Mcp.IntegrationTests/Fixtures/work-item-context-result.json`

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
│   ├── AzureDevOps.Mcp.Application/
│   │   └── Services/ (IWorkItemContextService, DTO's)
│   ├── AzureDevOps.Mcp.Infrastructure.AzureDevOps/
│   │   └── Services/ (AzureDevOpsWorkItemContextService)
│   ├── AzureDevOps.Mcp.Tools/
│   │   └── WorkItemTools.cs (MCP tool def)
│   └── AzureDevOps.Mcp.Server/
│       ├── Program.cs (DI + MCP registration)
│       └── appsettings.Development.json (✅ in .gitignore)
├── tests/
│   ├── AzureDevOps.Mcp.UnitTests/ (TODO: add service tests)
│   └── AzureDevOps.Mcp.IntegrationTests/
│       ├── WorkItemToolsFixtureTests.cs ✅
│       └── Fixtures/work-item-context-result.json ✅
└── docs/
    └── plan.md (dit bestand)
```

---

## Volgende stap(pen)

**Prioriteit 1**: CreateFeatureBranch capability
- Nieuwe interface: `IRepositoryService` in Application laag
- DTO's: `CreateBranchResult`, `CreateBranchRequest`
- Implementation: `AzureDevOpsRepositoryService` met `GitHttpClient`
- MCP tool: `RepositoryTools.CreateFeatureBranch(project, repository, branchName, fromBranch)`
- Fixture test analoog aan WorkItemTools

**Prioriteit 2**: HTML stripping in responses
- Tool retourneert momenteel raw HTML uit Azure DevOps
- Optie: HTML → platte tekst converter in Application laag
- Of: optioneel via response formatting flag

**Prioriteit 3**: LinkBranchToWorkItem
- Artifact link toevoegen aan work item
- Vereist: work item link update operation

**Prioriteit 4**: AddWorkItemComment
- Simpel: `IWorkItemContextService.AddCommentAsync(...)`
- MCP tool: `WorkItemTools.AddWorkItemComment(project, workItemId, comment)`

Laatst bijgewerkt: 2026-05-04
