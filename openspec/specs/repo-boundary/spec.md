# Capability: Repo Boundary

## Purpose
Define the implementation ownership boundaries for this fork so proposals and changes target the correct surface.

## Requirements

### Requirement: Fork-specific implementation lives under dotnet
Fork-specific runtime behavior SHALL be defined against the .NET implementation under dotnet/.

#### Scenario: Planning a fork-specific behavior change
- GIVEN a proposed change alters the behavior of the Azure DevOps Server fork
- WHEN the proposal identifies implementation scope
- THEN the proposal SHALL treat dotnet/ as the default implementation surface
- AND the proposal SHALL name the affected project or area under dotnet/src/ when known

### Requirement: Root TypeScript surface is upstream-tracking by default
The root TypeScript surface SHALL be treated as upstream-tracking and reference-oriented unless a change explicitly targets it.

#### Scenario: Evaluating changes outside dotnet
- GIVEN a proposed change touches files under the root src/ tree
- WHEN the change is reviewed for scope
- THEN the proposal SHALL explain why the root TypeScript surface is the correct place to change
- AND it SHALL state whether the change is for upstream sync, documentation parity, shared contract analysis, or another explicit reason

### Requirement: Cross-surface changes are explicit
Changes that touch both dotnet/ and the root TypeScript surface SHALL document both surfaces and why each is needed.

#### Scenario: A change spans both implementation surfaces
- GIVEN a proposal affects both dotnet/ and root-level TypeScript files
- WHEN the proposal is written
- THEN it SHALL identify both surfaces explicitly
- AND it SHALL describe the responsibility of each surface within the change