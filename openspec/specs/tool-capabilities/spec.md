# Capability: Tool Capabilities

## Purpose
Define the intended capability scope of the fork and how capability changes are governed.

## Requirements

### Requirement: Supported capability scope is intentionally limited
The fork SHALL support a pragmatic subset of Azure DevOps MCP capabilities centered on work item and repository collaboration workflows unless expanded by an explicit change.

#### Scenario: Assessing current fork scope
- GIVEN the current fork implementation is reviewed
- WHEN supported capability areas are described
- THEN work item and repository collaboration workflows SHALL be treated as the primary in-scope capability set
- AND unsupported upstream areas SHALL remain out of scope unless introduced by an explicit change proposal

### Requirement: Capability expansion is explicit
New capability areas SHALL require an explicit proposal before implementation.

#### Scenario: Adding a new upstream capability area
- GIVEN a change proposes support for a capability area not currently implemented in the fork
- WHEN the change is planned
- THEN the proposal SHALL identify the new capability area explicitly
- AND it SHALL describe how the scope affects fork priorities, contracts, and validation

### Requirement: Capability references stay aligned
Changes that alter supported fork capabilities SHALL keep the normative spec and the fork capability reference documentation aligned.

#### Scenario: Updating supported capabilities
- GIVEN a change adds, removes, or materially reshapes a supported capability
- WHEN the change artifacts are completed
- THEN the relevant OpenSpec capability specification SHALL be updated
- AND FORK_MATRIX.md SHALL be reviewed and updated if the capability snapshot has changed

### Requirement: Existing tool contracts are compatibility-sensitive
Changes to supported capabilities SHALL preserve existing MCP tool contracts unless a proposal explicitly describes a contract change.

#### Scenario: Revising an existing tool behavior
- GIVEN a change modifies an existing fork tool in a supported capability area
- WHEN the change is proposed
- THEN the proposal SHALL describe compatibility expectations for tool name, input shape, and observable behavior