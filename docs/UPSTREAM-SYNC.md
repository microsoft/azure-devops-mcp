# Upstream Sync Workflow (Audit First, Sync Branch Merge)

This fork uses a two-step workflow for bringing in upstream changes from:

- `https://github.com/microsoft/azure-devops-mcp`

The goal is to reduce regression risk for implemented fork capabilities by separating analysis from merge side effects.

## Step 1: Upstream Impact Audit (Read-Only)

Use skill: `upstream-impact-audit`

What this step does:

1. Ensures `upstream` remote points to the Microsoft source repository.
2. Fetches `upstream/main`.
3. Compares `main..upstream/main`.
4. Classifies impact on implemented fork capabilities.
5. Returns a gate decision.

Gate outcomes:

- `BLOCKED`: unresolved High-impact findings exist.
- `READY_FOR_SYNC_BRANCH_MERGE`: no unresolved High findings.

## Step 2: Sync Branch Merge (Side Effects)

Use skill: `upstream-sync-merge`

What this step does:

1. Requires explicit confirmation from the user.
2. Creates deterministic branch `sync/upstream-YYYYMMDD` from `main`.
3. Merges `upstream/main` into the sync branch.
4. Captures conflict details.
5. Produces a PR-ready summary for merge into `main`.

Default safety behavior:

- direct merge into `main` is blocked
- unresolved High-impact findings block merge execution

## Implemented Capability Focus

The audit always checks upstream impact on:

- `wit_get_work_item`
- `wit_work_item_write_create`
- `wit_add_work_item_comment`
- `wit_update_work_item_comment`
- `repo_create_branch`
- `wit_add_artifact_link`
- `repo_create_pull_request`

## Example Audit Output

```text
Upstream Audit Summary
- Compared refs: main..upstream/main
- Changed files: 84

Capability Impact Findings
- High: 1 (repo_create_pull_request input contract change)
- Medium: 2 (comment format behavior drift)
- Low: 4 (docs only)

Gate Decision
- BLOCKED

Suggested Next Step
- Review High finding and define mitigation before sync merge.
```

## Example Merge Output

```text
Sync Branch Merge Summary
- Branch: sync/upstream-20260519
- Merge result: conflicts

Conflict Details
- src/tools/work-items.ts
- docs/TOOLSET.md

Manual Validation Checklist
- pending_manual_validation

PR Draft
- Title: Sync upstream/main into fork (2026-05-19)
```

## Troubleshooting

### Remote setup issues

- `upstream` missing:
  - add remote: `git remote add upstream https://github.com/microsoft/azure-devops-mcp`
- `upstream` points elsewhere:
  - inspect with `git remote -v`
  - correct with `git remote set-url upstream https://github.com/microsoft/azure-devops-mcp`

### Fetch issues

- run `git fetch upstream main`
- confirm ref exists: `git show-ref refs/remotes/upstream/main`

### Merge conflicts

- resolve conflicts on sync branch only
- do not resolve by merging directly into `main`
- re-run manual validation after conflict resolution

## Manual Validation Checklist

Testing for this change is intentionally manual.

Before creating or completing PR from sync branch to `main`, validate:

1. Audit ran before merge and produced a gate decision.
2. Merge target is sync branch, not `main`.
3. If High findings existed, mitigation/acknowledgment was captured before merge.
4. Conflict details are clearly listed when conflicts occur.
5. PR summary includes branch name, merge result, and validation status.
