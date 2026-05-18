# Capability: Server Runtime

## Purpose
Define the stable runtime and authentication constraints for the Azure DevOps Server fork.

## Requirements

### Requirement: Base server endpoint is startup configuration
The fork runtime SHALL take its Azure DevOps base server endpoint from startup configuration rather than per-request overrides.

#### Scenario: Resolving the base server endpoint
- GIVEN the server starts with configured Azure DevOps settings
- WHEN a tool call is executed
- THEN the runtime SHALL use the configured base server endpoint
- AND it SHALL NOT accept a per-request override for that endpoint

### Requirement: Collection is provided per tool call
Requests targeting Azure DevOps Server SHALL identify the collection as request data rather than embedding the collection in the configured base server endpoint.

#### Scenario: Executing a tool call against a collection
- GIVEN a tool call targets Azure DevOps Server
- WHEN the runtime resolves the target collection
- THEN the collection SHALL be supplied by request data for that call
- AND the configured base server endpoint SHALL remain collection-agnostic

### Requirement: Authentication is resolved per request by collection-specific PAT header
The runtime SHALL resolve authentication from a collection-specific PAT header for the requested collection.

#### Scenario: Collection-specific PAT is supplied
- GIVEN a tool call specifies a collection
- WHEN the request includes the corresponding collection-specific PAT header
- THEN the runtime SHALL use that PAT for authentication

#### Scenario: Collection-specific PAT is missing
- GIVEN a tool call specifies a collection
- WHEN the corresponding collection-specific PAT header is not present
- THEN the request SHALL fail as unauthorized

### Requirement: Runtime constraints are preserved unless explicitly changed
Changes to runtime endpoint, collection, or authentication behavior SHALL be proposed explicitly before implementation.

#### Scenario: A proposal changes runtime access rules
- GIVEN a proposed change alters endpoint resolution, collection handling, or PAT resolution
- WHEN the proposal is prepared
- THEN it SHALL describe the behavioral change explicitly
- AND it SHALL update the relevant runtime specification if the change is accepted