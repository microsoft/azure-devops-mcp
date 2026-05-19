## Why

This fork tracks a different implementation surface than upstream, while still relying on upstream as the reference repository.

Upstream updates are currently pulled in manually. That increases the risk of:

- missing important upstream contract changes
- merging directly into main without enough impact visibility
- regressing fork-specific behavior in the implemented .NET collaboration tools

The fork needs a structured, repeatable workflow that separates analysis from side effects.

## What Changes

- Add a new read-only skill flow for upstream impact auditing.
- Add a separate merge flow that can only merge into a sync branch (not directly into main by default).
- Add capability-focused impact checks that explicitly inspect changes relevant to currently implemented fork features.
- Add a standardized audit report shape with severity classification and merge recommendation.

## New Capabilities

- `upstream-impact-audit`: analyze upstream changes since fork main without changing local branches
- `upstream-sync-merge`: merge upstream/main into a generated sync branch after explicit confirmation and successful audit gates

## Scope Boundaries

- This change defines workflow and guardrails for syncing upstream into the fork.
- This change does not implement new Azure DevOps product tools.
- This change does not auto-merge directly into main.

## Impact

**Code/Prompt Surface (expected):**

- `.github/skills/` (new skill definitions)
- `.github/prompts/` or equivalent orchestration prompt surface (if needed)
- supporting docs for operating the sync workflow

**Behavioral Impact:**

- upstream synchronization becomes a two-step process: audit first, merge second
- merge operation is gated by explicit risk reporting on implemented fork capabilities

**Compatibility:**

- no breaking change to existing fork MCP tool contracts
- additive workflow capability only
