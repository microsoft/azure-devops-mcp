---
name: upstream-sync-merge
description: Merge upstream/main into a deterministic sync branch after explicit confirmation and successful audit gates.
license: MIT
compatibility: Requires git and repository access.
metadata:
  author: g5e
  version: "1.0"
---

Merge upstream changes into a sync branch only.

This skill is side-effecting and requires explicit user confirmation before merge execution.

## Inputs

- `forkMainBranch` (default: `main`)
- `upstreamMainRef` (default: `upstream/main`)
- `syncBranchName` (default format: `sync/upstream-YYYYMMDD`)
- `allowMainTarget` (default: `false`)
- `auditGateDecision` (required)

## Preconditions

1. `auditGateDecision` must be `READY_FOR_SYNC_BRANCH_MERGE`.
2. User must explicitly confirm merge execution.
3. Target branch must not be `main` when `allowMainTarget=false`.

## Workflow

1. **Validate merge preconditions**
   - ensure `upstream/main` is present and up to date
   - refuse execution when gate decision is `BLOCKED`
   - refuse direct merge to `main` unless explicit policy override exists

2. **Create sync branch from fork main**
   - create or reset deterministic sync branch from fork `main`

3. **Merge upstream/main into sync branch**
   - execute merge
   - capture conflict details when merge is not clean

4. **Run manual verification checkpoint**
   - report a checklist to perform manual validation before PR
   - capture status as `pending_manual_validation` until user confirms results

5. **Emit PR-ready summary**
   - sync branch name
   - merge status
   - conflict files (if any)
   - manual validation status
   - suggested PR title/body

## Standard Output Shape

Return markdown sections in this order:

1. `Sync Branch Merge Summary`
2. `Precondition Check`
3. `Merge Result`
4. `Conflict Details` (if applicable)
5. `Manual Validation Checklist`
6. `PR Draft`

## Guardrails

- Block on unresolved High-impact findings.
- Block direct merge-to-main by default.
- Require explicit user confirmation before any merge command.
- Never run destructive git commands.
