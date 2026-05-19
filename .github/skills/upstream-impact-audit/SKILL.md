---
name: upstream-impact-audit
description: Read-only upstream audit flow for this fork. Fetch upstream changes, classify impact on implemented fork capabilities, and emit a merge recommendation report.
license: MIT
compatibility: Requires git and repository access.
metadata:
  author: g5e
  version: "1.0"
---

Run a read-only upstream impact audit for this fork.

This skill must not create commits, switch main, or perform merge operations.

## Inputs

- `upstreamUrl` (default: `https://github.com/microsoft/azure-devops-mcp`)
- `forkMainBranch` (default: `main`)
- `upstreamMainRef` (default: `upstream/main`)

## Capability Focus Set

Always evaluate impact on these implemented fork capabilities:

- `wit_get_work_item`
- `wit_work_item_write_create`
- `wit_add_work_item_comment`
- `wit_update_work_item_comment`
- `repo_create_branch`
- `wit_add_artifact_link`
- `repo_create_pull_request`

## Workflow

1. **Validate repository state (read-only checks only)**
   - confirm git repository
   - confirm fork main branch exists

2. **Resolve upstream remote**
   - if `upstream` remote is missing, add it with the configured upstream URL
   - if `upstream` remote exists with a different URL, report and ask user how to proceed

3. **Fetch and compute divergence**
   - fetch `upstream/main`
   - compute commit and file diff range between `main` and `upstream/main`

4. **Classify impact**
   - map changed files and tool definitions to the capability focus set
   - classify findings:
     - `High`: probable contract or behavior break for implemented capability
     - `Medium`: possible drift requiring targeted manual validation
     - `Low`: informational or documentation-only drift

5. **Emit standardized report**
   - include: remotes, compared refs, changed file count, findings by severity, and recommendation

## Standard Output Shape

Return markdown sections in this order:

1. `Upstream Audit Summary`
2. `Compared Refs`
3. `Capability Impact Findings`
4. `Gate Decision`
5. `Suggested Next Step`

Gate decision rules:

- `BLOCKED` when unresolved `High` findings exist
- `READY_FOR_SYNC_BRANCH_MERGE` when no unresolved `High` findings exist

## Guardrails

- Do not merge.
- Do not create or rewrite local branches.
- Do not run destructive git commands.
- Keep all operations audit-oriented.
