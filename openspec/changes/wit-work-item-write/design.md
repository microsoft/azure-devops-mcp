## Context

The Azure DevOps MCP server currently supports reading work items and adding comments via the `IWorkItemContextService` and `WorkItemTools` classes. The .NET implementation follows a layered architecture:

- **Tools Layer** (`dotnet/src/G5e.AzureDevOpsServerMCP.Tools/WorkItemTools.cs`): MCP tool definitions with `[McpServerTool]` attributes
- **Application Layer** (`dotnet/src/G5e.AzureDevOpsServerMCP.Application/Services/`): Business logic and Azure DevOps API interactions
- **Infrastructure Layer**: Uses `Microsoft.TeamFoundationServer.Client` for API calls

Existing patterns:
- Async methods decorated with `[McpServerTool(Name = "...")]` and `[Description("...")]`
- Exception handling returning JSON error responses
- JSON serialization with indentation for responses
- Service methods accepting collection, project as parameters

## Goals / Non-Goals

**Goals:**
- Add `wit_work_item_write_create` tool to create new work items with title, type, and optional description
- Follow existing code patterns and error handling conventions
- Support essential work item creation parameters (type, title, description)
- Return created work item ID and URL
- Maintain consistency with TypeScript upstream tool contracts

**Non-Goals:**
- Support for complex field assignments beyond standard fields in this iteration
- Work item linking or relationships during creation
- Template-based work item creation
- Bulk creation operations
- Custom workflow state initialization

## Decisions

**Decision 1: Service Method Location**
- **Choice**: Extend `IWorkItemContextService` with a `CreateWorkItemAsync` method
- **Rationale**: Maintains separation of concerns and consistency with existing pattern. New work item operations belong with other work item context operations.
- **Alternative Considered**: Create a separate `IWorkItemWriteService` → Would fragment service responsibilities

**Decision 2: Tool Parameter Contract**
- **Choice**: Accept `collection`, `project`, `workItemType`, `title`, and optional `description`
- **Rationale**: These are the minimum required fields for work item creation. Collection and project contextualize the operation.
- **Alternative Considered**: Accepting a generic JSON object for fields → Too open-ended, harder to validate and document

**Decision 3: API Integration Pattern**
- **Choice**: Use `WorkItemTrackingHttpClient` from `Microsoft.TeamFoundationServer.Client` (consistent with existing patterns)
- **Rationale**: Already in use throughout the codebase; provides native Azure DevOps Server support
- **Alternative Considered**: Use REST client directly → Duplicates existing abstraction; requires more error handling

**Decision 4: Response Format**
- **Choice**: Return JSON with `workItemId`, `url`, `title`, `type`, and `success: true`
- **Rationale**: Mirrors existing tool response patterns; provides caller with immediate confirmation and identifiers
- **Alternative Considered**: Return full work item context → Too verbose for a create operation; caller can fetch full context if needed

## Risks / Trade-offs

**Risk: Incomplete Field Validation**
- **Issue**: `workItemType` is passed as string; Azure DevOps may reject invalid types
- **Mitigation**: Add validation against available work item types in the project; document valid types in tool description

**Risk: Description Field Encoding**
- **Issue**: If description contains HTML/markup, encoding may be required
- **Mitigation**: Use Azure DevOps API's native HTML handling; test with rich text input

**Risk: Concurrency & Race Conditions**
- **Issue**: Multiple simultaneous creates might conflict or produce unexpected ordering
- **Mitigation**: Azure DevOps API handles concurrency; document that ordering is not guaranteed

**Trade-off: No Field Defaulting**
- **Issue**: Work items created only with type + title + description; other fields use project defaults
- **Mitigation**: Acceptable for initial implementation; future `wit_work_item_write_update` can modify additional fields post-creation

## Migration Plan

**Deployment:**
1. Update `IWorkItemContextService` with `CreateWorkItemAsync` method signature
2. Implement service method in concrete service class
3. Add `wit_work_item_write_create` tool method to `WorkItemTools`
4. Update tests to cover creation scenarios
5. Package and deploy as part of regular MCP server build

**Rollback:**
- If issues arise, remove the new tool method and revert service changes
- No database migrations required; purely additive change
- No breaking changes to existing tools

**Documentation:**
- Add tool description to MCP server documentation
- Include example usage in EXAMPLES.md or similar

## Open Questions

- Should work item creation validate the work item type against available types in the project?
- Should the tool accept optional `assignedTo` parameter in future iterations?
- How should the tool handle Azure DevOps Server permission restrictions (e.g., user cannot create work items)?
