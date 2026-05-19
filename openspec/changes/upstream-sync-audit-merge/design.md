## Context

The repository is a fork with a selective implementation under `dotnet/`, while much of the root TypeScript surface remains upstream-tracking.

This creates a recurring need:

1. pull in upstream updates
2. determine if upstream changes affect implemented fork capabilities
3. merge safely without bypassing review

The design uses a two-phase workflow so analysis and side effects remain separated.

## Goals / Non-Goals

**Goals**

- provide a deterministic, repeatable upstream sync workflow
- enforce an audit-first process
- prevent direct-to-main merges by default
- produce a focused impact report for implemented fork capabilities

**Non-Goals**

- replacing standard PR review practices
- automatically resolving semantic conflicts in fork-specific code
- introducing new runtime MCP product capabilities

## Architecture

```
┌───────────────────────────────┐
│ Phase 1: Upstream Audit       │
│ - ensure upstream remote      │
│ - fetch upstream/main         │
│ - compute diff/range          │
│ - classify capability impact  │
└───────────────┬───────────────┘
                │ report + gate decision
                ▼
┌───────────────────────────────┐
│ Phase 2: Sync Branch Merge    │
│ - create sync branch          │
│ - merge upstream/main         │
│ - run verification checks     │
│ - present outcome summary     │
└───────────────────────────────┘
```

## Phase 1: Upstream Impact Audit

### Inputs

- upstream repository URL (`https://github.com/microsoft/azure-devops-mcp`)
- fork main branch baseline
- optional local override for target branch names

### Steps

1. Validate git context and branch availability.
2. Ensure upstream remote exists (or add temporary upstream remote).
3. Fetch upstream/main.
4. Determine divergence (`fork/main..upstream/main`) and changed files.
5. Map changed upstream areas to fork-implemented capabilities.
6. Emit impact report with severity and recommendation.

### Capability Impact Focus Set

- `wit_get_work_item`
- `wit_work_item_write_create`
- `wit_add_work_item_comment`
- `wit_update_work_item_comment`
- `repo_create_branch`
- `wit_add_artifact_link`
- `repo_create_pull_request`

### Severity Model

- **High**: likely contract/behavior break for implemented fork capability
- **Medium**: possible drift requiring targeted validation
- **Low**: informational or documentation-only change

### Gate Rules

- Merge phase is blocked when unresolved High-impact findings exist.
- Merge phase requires explicit user confirmation even if no High findings exist.

## Phase 2: Sync Branch Merge

### Branching Strategy

- Create merge target branch from fork main using a deterministic name, for example:
  - `sync/upstream-YYYYMMDD`
- Never merge upstream directly into main by default.

### Steps

1. Create or refresh sync branch from fork main.
2. Merge upstream/main into sync branch.
3. Capture merge conflicts and unresolved files if present.
4. Run configured verification checks (for example build/test/lint per repository conventions).
5. Produce final sync summary and recommended next action (PR to main).

### Output Contract

The merge summary includes at least:

- sync branch name
- merge result (success/conflict)
- list of conflict files when applicable
- verification status
- suggested PR title/body seed

## Risks / Trade-offs

**Risk: false positives in impact mapping**

- Mitigation: maintain explicit mapping rules and classify uncertain matches as Medium.

**Risk: direct merge bypass**

- Mitigation: enforce branch-target guardrail in merge flow.

**Trade-off: two-step workflow is slower**

- Benefit: significantly better traceability and lower regression risk for fork-specific behavior.

## Validation Strategy

- unit-level checks for impact classification logic
- scenario checks for gate behavior (High finding blocks merge)
- dry-run and real-run checks for merge orchestration

## Open Questions

- Should sync branch naming be configurable or fixed?
- Should verification checks be mandatory defaults or repository-configurable presets?
- Should the audit report be persisted to a markdown artifact in the repo?
