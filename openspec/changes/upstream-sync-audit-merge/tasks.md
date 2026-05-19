## 1. Define Skill Surfaces

- [x] 1.1 Add a read-only skill for upstream impact auditing
- [x] 1.2 Add a separate skill/flow for sync-branch merge execution
- [x] 1.3 Document mandatory confirmation points before side-effect operations

## 2. Build Upstream Audit Flow

- [x] 2.1 Resolve or register upstream remote (`microsoft/azure-devops-mcp`)
- [x] 2.2 Fetch upstream/main and compute divergence against fork main
- [x] 2.3 Implement capability-focused impact mapping for implemented fork tools
- [x] 2.4 Add severity classification (High/Medium/Low)
- [x] 2.5 Emit a standardized audit report with merge recommendation

## 3. Build Sync Branch Merge Flow

- [x] 3.1 Create deterministic sync branch from fork main
- [x] 3.2 Merge upstream/main into the sync branch
- [x] 3.3 Capture and report conflict details
- [x] 3.4 Run repository verification checks and report status
- [x] 3.5 Produce a PR-ready summary for merging sync branch into main

## 4. Guardrails and Safety

- [x] 4.1 Block merge flow on unresolved High-impact findings
- [x] 4.2 Block direct merge-to-main behavior by default
- [x] 4.3 Require explicit user confirmation for merge execution

## 5. Documentation

- [x] 5.1 Add usage docs for audit and merge flows
- [x] 5.2 Add troubleshooting guidance for remote setup and conflict handling
- [x] 5.3 Add examples of audit output and decision criteria

## 6. Validation (Manual)

- [x] 6.1 Define manual checks for capability impact classification review
- [x] 6.2 Define manual checks for gate behavior and merge blocking logic
- [x] 6.3 Define manual end-to-end scenario for audit -> sync branch merge
