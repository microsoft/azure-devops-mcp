# G5e.AzureDevOpsServerMCP Fork Notes

G5e.AzureDevOpsServerMCP is an attempt to make part of the Azure DevOps MCP Server functionality available as a .NET/NuGet-based application, with a focus on scenarios relevant to Azure DevOps Server (on-prem).

According to the FAQ of the original project, on-prem is not supported as a target platform. This fork explores how similar workflows can still be made usable in a C# implementation.

## Technical Direction

- New fork-specific functionality is located under [dotnet](dotnet).
- The implementation uses `ModelContextProtocol.AspNetCore` as the MCP transport/runtime for .NET.
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

## Configuration (appsettings.json)

The .NET server reads Azure DevOps settings from configuration keys under `AzureDevOps`.

Required keys:

- `AzureDevOps:OrganizationUrl`
- `AzureDevOps:PersonalAccessToken`

Optional keys:

- `AzureDevOps:DefaultProject`
- `AzureDevOps:DefaultRepository`

Example:

```json
{
	"AzureDevOps": {
		"OrganizationUrl": "https://your-server/YourCollection",
		"PersonalAccessToken": "YOUR_PAT",
		"DefaultProject": "YourProject",
		"DefaultRepository": "YourRepository"
	}
}
```

Notes:

- Both `appsettings.json` and `appsettings.Development.json` work.
- For local development, `appsettings.Development.json` is the safer option because it is ignored by git in this repo.
- `appsettings.json` is not ignored by git, so it should not be used for secrets unless you explicitly manage that risk.
- Environment variables are also supported:
	- `AZURE_DEVOPS_ORG_URL`
	- `AZURE_DEVOPS_PAT`
	- `AZURE_DEVOPS_PROJECT`
	- `AZURE_DEVOPS_REPOSITORY`

## Per-Request Header Overrides

The server also supports per-request header-based overrides for authentication and default parameters. This is useful when multiple users or contexts access the same server instance with different credentials or project/repository defaults.

Supported headers (must be sent with each MCP request):

- `X-AzureDevOps-Pat`: Personal Access Token (overrides system PAT from config)
- `X-AzureDevOps-Default-Project`: Default project name/ID (overrides configured default project)
- `X-AzureDevOps-Default-Repository`: Default repository name/ID (overrides configured default repository)

Header precedence:

1. Header value (if provided)
2. Function argument (if provided as a tool parameter)
3. Configured default (from appsettings/environment)

Example request with headers (via curl):

```bash
curl -X POST http://localhost:3000/mcp \
  -H "X-AzureDevOps-Pat: YOUR_HEADER_PAT" \
  -H "X-AzureDevOps-Default-Project: MyProject" \
  -H "X-AzureDevOps-Default-Repository: MyRepo" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {...}}'
```

Notes:

- The `AzureDevOps:OrganizationUrl` is intentionally **not overridable via headers** to prevent runtime endpoint switching security risks. It must be configured via `appsettings.json` or `AZURE_DEVOPS_ORG_URL` environment variable at server startup.
- Headers should always be sent over HTTPS to prevent credential exposure in transit.

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
