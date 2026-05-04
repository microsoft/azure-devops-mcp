# README Fork

This fork is an attempt to make part of the Azure DevOps MCP Server functionality available as a .NET/NuGet-based application, with a focus on scenarios relevant to Azure DevOps Server (on-prem).

According to the FAQ of the original project, on-prem is not supported as a target platform. This fork explores how similar workflows can still be made usable in a C# implementation.

## Technical Direction

- New fork-specific functionality is located under [dotnet](dotnet).
- The implementation uses `ModelContextProtocol.AspNetCore` as the MCP transport/runtime for .NET.
- Reference: https://csharp.sdk.modelcontextprotocol.io/

## Goal of This Fork

- Make Azure DevOps MCP capabilities available in a .NET stack
- Provide end-to-end workflows for branch/work item/PR use cases
- Provide a foundation that is easy to extend with additional Azure DevOps tools

## Capability Overview

A matrix that maps upstream capabilities to what is implemented in this fork is available in [FORK_MATRIX.md](FORK_MATRIX.md).
