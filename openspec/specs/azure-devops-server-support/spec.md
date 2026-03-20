# azure-devops-server-support Specification

## Purpose

TBD - created by archiving change azure-devops-server-support. Update Purpose after archive.

## Requirements

### Requirement: Support for Custom Azure DevOps Server URL

The system SHALL allow users to provide a custom base URL for their Azure DevOps instance via the `--url` command-line argument or MCP configuration.

#### Scenario: Using a custom URL

- **WHEN** the user starts the server with `--url https://tfs.contoso.com/tfs/DefaultCollection`
- **THEN** all API requests SHALL be directed to this base URL instead of `https://dev.azure.com/{organization}`

### Requirement: Compatibility with Azure DevOps Server 2022

The system SHALL correctly format URLs and handle responses for self-hosted instances (Azure DevOps Server 2022).

#### Scenario: Requesting resources from Server instance

- **WHEN** a tool is called with a project and organization name
- **THEN** the system SHALL construct the correct endpoint based on the custom URL provided
