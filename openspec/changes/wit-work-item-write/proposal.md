## Why

The .NET implementation of the Azure DevOps MCP server currently supports reading work items and adding comments, but lacks the fundamental capability to create new work items. This gap limits the utility of the fork for Azure DevOps Server (on-prem) environments where programmatic work item creation is essential for automation workflows and AI-powered agent interactions.

## What Changes

- Add a new MCP tool `wit_work_item_write_create` to create work items in Azure DevOps
- The tool will accept collection, project, work item type, title, and optional description parameters
- Return the newly created work item ID and URL

## Capabilities

### New Capabilities
- `wit-work-item-write-create`: Create new work items in Azure DevOps projects with configurable type, title, and description

### Modified Capabilities

## Impact

**Code Changes:**
- `dotnet/src/G5e.AzureDevOpsServerMCP.Application/Services/`: Add or extend the work item service to support creation
- `dotnet/src/G5e.AzureDevOpsServerMCP.Tools/WorkItemTools.cs`: Add the `wit_work_item_write` tool method with proper input validation and error handling
- Tests: Extend integration and unit tests to cover work item creation scenarios

**APIs & Contracts:**
- New MCP tool: `wit_work_item_write_create(collection, project, workItemType, title, description?)`
- Extends the existing work item tool surface area

**Dependencies:**
- Existing: `Microsoft.TeamFoundationServer.Client` (already in use)
- No new external dependencies required
