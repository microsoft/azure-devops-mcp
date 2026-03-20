# auth Specification

## Purpose

TBD - created by archiving change azure-devops-server-support. Update Purpose after archive.

## Requirements

### Requirement: Support for Personal Access Token (PAT)

The system SHALL support authentication using a Personal Access Token (PAT) for Azure DevOps Server and Azure DevOps Services.

#### Scenario: Using a PAT via environment variable

- **WHEN** the user provides a PAT through the `ADO_MCP_AUTH_TOKEN` environment variable
- **THEN** the server SHALL authenticate API calls using this token with Basic authentication (or equivalent Bearer handler for ADO)

### Requirement: Configurable Authentication Type

The system SHALL support selecting the authentication type (e.g., `pat` or `envvar`) via the `--authentication` command-line argument.

#### Scenario: Using the PAT authentication type

- **WHEN** the user starts the server with `--authentication envvar` (or `pat` alias)
- **THEN** it SHALL use the provided token for all requests
