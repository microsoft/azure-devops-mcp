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
- **FixtureTests**: deterministische integration tests met fake service en JSON fixture
- appsettings.Development.json uit git verwijderd, in .gitignore gezet

### 🚧 In voorbereiding
- Unit tests voor AzureDevOpsWorkItemContextService (SDK mapping + foutpaden)
- Formaat cleanup (HTML → platte tekst in descriptions/comments)

### ⏳ Volgende capabilities
- CreateFeatureBranch (Git branch management)
- LinkBranchToWorkItem (artifact links)
- AddWorkItemComment
- CreatePullRequestForWorkItem

---

## Teststrategie

### 1. Unit tests (AzureDevOpsWorkItemContextService)
**Doel**: valideer SDK → CLR mapping en foutafhandeling
**Locatie**: `tests/AzureDevOps.Mcp.UnitTests/AzureDevOpsWorkItemContextServiceTests.cs`
**Testcases**:
- Happy path: werk item met comments gemapt naar DTO
- Foutpad 1: comments API faalt, maar work item komt nog terug
- Foutpad 2: ongeldige input (empty project, workItemId <= 0) → ArgumentException
- Foutpad 3: work item niet gevonden → InvalidOperationException
- AssignedTo mapping: IdentityRef.DisplayName correct geëxtraheerd

**Mock/fake strategie**: 
- Mock `IAzureDevOpsConnectionFactory` en `WorkItemTrackingHttpClient`
- Bouw SDK-objecten (WorkItem, Comment) handmatig
- Geen echte netwerk calls

### 2. Deterministische integration tests (MCP tool)
**Doel**: valideer tool wiring, JSON-RPC response shape
**Locatie**: `tests/AzureDevOps.Mcp.IntegrationTests/WorkItemToolsFixtureTests.cs`
**Status**: ✅ Klaar (2 tests, beide slaagd)

**Fixture**: `tests/AzureDevOps.Mcp.IntegrationTests/Fixtures/work-item-context-result.json`
- Genormaliseerde WorkItemContextResult met 1 comment
- Geen gevoelige data, geen echte URLs

**Tests**:
1. GetWorkItemContext via fixture-backed fake → valideert JSON shape
2. Service faalt → valideert error serialisatie

### 3. Live smoke test (optioneel)
**Doel**: end-to-end validatie tegen echte DevOps
**Niet in CI**, alleen handmatig voor bepaalde commits
**Eenmaal bewezen** (work item 1 werd succesvol opgehaald), hoeft niet herhaald te worden

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

## Volgende directe stap

**Unit tests voor AzureDevOpsWorkItemContextService**

1. Voeg Moq NuGet reference toe aan `AzureDevOps.Mcp.UnitTests.csproj`
2. Maak test class met:
   - Mock van IAzureDevOpsConnectionFactory
   - Mock van WorkItemTrackingHttpClient
   - Handmatig opgebouwde test WorkItem en Comment SDK objecten
3. Test 4-5 scenario's (happy path, comments fail, invalid input, not found)

---

## Notities voor vervolgwerk

- **PAT**: nooit in code of fixtures, altijd via appsettings.Development.json (in .gitignore)
- **Fixture versioning**: update work-item-context-result.json als je test scenario's wilt uitbreiden
- **HTML in responses**: momenteel gepreserveerd van Azure DevOps, kan later naar plain text
- **MCP transport**: stateless HTTP, SSE-based responses, require Accept header
- **Build**: `dotnet build AzureDevOpsMcp.slnx` (solution expressions)
- **Tests**: `dotnet test AzureDevOpsMcp.slnx --no-build`

---

Laatst bijgewerkt: 2026-05-04
