# G5e.AzureDevOpsServerMCP Fork Notes

G5e.AzureDevOpsServerMCP is an attempt to make part of the Azure DevOps MCP Server functionality available as a .NET/NuGet-based application, with a focus on scenarios relevant to Azure DevOps Server (on-prem).

According to the FAQ of the original project, on-prem is not supported as a target platform. This fork explores how similar workflows can still be made usable in a C# implementation.

## Technical Direction

- New fork-specific functionality is located under [dotnet](dotnet).
- The implementation uses `ModelContextProtocol.AspNetCore` as the MCP transport/runtime for .NET.
- Azure DevOps connectivity is implemented with `Microsoft.TeamFoundationServer.Client` and `Microsoft.VisualStudio.Services.Client`.
- Reference: https://csharp.sdk.modelcontextprotocol.io/

## Reusable Integration Package

Besides the standalone server app, this fork now also provides a reusable integration project at:

- [dotnet/src/G5e.AzureDevOpsServerMCP.AspNetCore](dotnet/src/G5e.AzureDevOpsServerMCP.AspNetCore)

This project is intended to be packaged as a NuGet package so existing MCP servers (already using `ModelContextProtocol.AspNetCore`) can add the Azure DevOps tools with minimal setup.

It exposes two extension methods:

- `AddDevOpsServerMcpServices(this IServiceCollection services, IConfiguration configuration)`
- `AddDevOpsServerMCP(this IMcpServerBuilder builder)`

Example usage in an existing MCP host:

```csharp
using G5e.AzureDevOpsServerMCP.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDevOpsServerMcpServices(builder.Configuration);

builder.Services
	.AddMcpServer()
	.AddDevOpsServerMCP()
	.WithHttpTransport(options =>
	{
		options.Stateless = true;
	});
```

What this adds automatically:

- Azure DevOps options loading from appsettings/environment
- Connection factory and Azure DevOps service registrations
- MCP tool registrations for work items and repository workflows

## Goal of This Fork

- Make Azure DevOps MCP capabilities available in a .NET stack
- Provide end-to-end workflows for branch/work item/PR use cases
- Provide a foundation that is easy to extend with additional Azure DevOps tools

## Capability Overview

A matrix that maps upstream capabilities to what is implemented in this fork is available in [FORK_MATRIX.md](FORK_MATRIX.md).

## Upstream Synchronization Workflow

This fork uses an audit-first upstream synchronization flow before any merge action. The merge phase targets a sync branch (not `main` by default) and relies on manual validation before promoting changes.

See [docs/UPSTREAM-SYNC.md](docs/UPSTREAM-SYNC.md) for the complete workflow, guardrails, troubleshooting, and examples.

## Configuration (appsettings.json)

The .NET server reads Azure DevOps settings from configuration keys under `AzureDevOps`.

**Required keys:**

- `AzureDevOps:OrganizationUrl`: Base URL of the Azure DevOps Server (e.g., `https://dev.azure.local/myorg` or `https://myserver.com/tfs`). Collection name is **not** part of the URL; it is specified per request.

**Optional keys:** None (all other parameters are provided per request).

Example:

```json
{
	"AzureDevOps": {
		"OrganizationUrl": "https://dev.azure.local"
	}
}
```

Notes:

- Both `appsettings.json` and `appsettings.Development.json` work.
- For local development, `appsettings.Development.json` is the safer option because it is ignored by git in this repo.
- `appsettings.json` is not ignored by git, so it should not be used for secrets unless you explicitly manage that risk.
- Environment variables are also supported:
	- `AZURE_DEVOPS_ORG_URL`: Base URL of Azure DevOps Server (no collection in URL)

## Per-Request Parameters and PAT Headers

Each MCP tool call **must include**:

1. **Collection name** as a tool parameter (required)
2. **Project name** as a tool parameter (required)
3. **Repository name** as a tool parameter (required for repository operations)
4. **Personal Access Token** via a collection-specific header (required)

The server supports per-request authentication via collection-specific PAT headers. This allows multiple collections and PATs to be used with the same server instance.

**Supported PAT header pattern:**

- `X-AzureDevOps-Pat-{CollectionName}`: Personal Access Token for the specified collection
  - Example: `X-AzureDevOps-Pat-DefaultCollection`
  - Example: `X-AzureDevOps-Pat-MyTeamCollection`

**PAT Resolution:**

When a tool call is made with a collection name, the server looks for a PAT in this order:

1. Collection-specific header (e.g., `X-AzureDevOps-Pat-MyCollection`)
2. If not found, the request fails with HTTP 401 Unauthorized

Example request with headers (via curl):

```bash
curl -X POST http://localhost:3000/mcp \
  -H "X-AzureDevOps-Pat-DefaultCollection: YOUR_COLLECTION_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "wit_get_work_item",
      "arguments": {
        "collection": "DefaultCollection",
        "project": "MyProject",
        "workItemId": 123
      }
    }
  }'
```

Notes:

- The `AzureDevOps:OrganizationUrl` is intentionally **not overridable via headers** to prevent runtime endpoint switching security risks. It must be configured via `appsettings.json` or `AZURE_DEVOPS_ORG_URL` environment variable at server startup.
- Each collection requires its own PAT header with the collection name embedded in the header name (e.g., `X-AzureDevOps-Pat-CollectionA`, `X-AzureDevOps-Pat-CollectionB`).
- Headers should always be sent over HTTPS to prevent credential exposure in transit.
- The base URL in `OrganizationUrl` must **not** include the collection name (e.g., use `https://myserver.com/tfs`, not `https://myserver.com/tfs/DefaultCollection`).

## Validation

- The currently implemented workflows were validated with fixture-backed integration tests in the .NET solution.
- The main end-to-end scenarios were also smoke-tested manually against a real Azure DevOps Server/instance using MCP calls.
- This includes work item retrieval, branch creation, work item comments, branch linking, and pull request creation.

## PAT Permissions

For the capabilities currently implemented in this fork, the PAT should have at least:

- **Code: Read & Write**
	- Needed for creating branches and pull requests.
- **Work Items: Read & Write**
	- Needed for reading work item context, adding comments, and linking branch/PR artifacts.
