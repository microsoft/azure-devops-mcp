# api-versioning Specification

## Purpose

TBD - created by archiving change azure-devops-server-support. Update Purpose after archive.

## Requirements

### Requirement: Configure API Version

The system SHALL allow users to specify the Azure DevOps REST API version via the `--api-version` command-line argument or MCP configuration.

#### Scenario: Using a specific API version

- **WHEN** the user starts the server with `--api-version 6.0`
- **THEN** all API requests SHALL include `api-version=6.0` in the query string

### Requirement: Default API Version

The system SHALL use a default API version (`7.2-preview.1`) if none is specified by the user.

#### Scenario: No API version provided

- **WHEN** the user starts the server without `--api-version`
- **THEN** all API requests SHALL include `api-version=7.2-preview.1` in the query string
