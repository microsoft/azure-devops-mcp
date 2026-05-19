## 1. Define Skill Surfaces

- [ ] 1.1 Add a read-only skill for upstream impact auditing
- [ ] 1.2 Add a separate skill/flow for sync-branch merge execution
- [ ] 1.3 Document mandatory confirmation points before side-effect operations

## 2. Build Upstream Audit Flow

- [ ] 2.1 Resolve or register upstream remote (`microsoft/azure-devops-mcp`)
- [ ] 2.2 Fetch upstream/main and compute divergence against fork main
- [ ] 2.3 Implement capability-focused impact mapping for implemented fork tools
- [ ] 2.4 Add severity classification (High/Medium/Low)
- [ ] 2.5 Emit a standardized audit report with merge recommendation

## 3. Build Sync Branch Merge Flow

- [ ] 3.1 Create deterministic sync branch from fork main
- [ ] 3.2 Merge upstream/main into the sync branch
- [ ] 3.3 Capture and report conflict details
- [ ] 3.4 Run repository verification checks and report status
- [ ] 3.5 Produce a PR-ready summary for merging sync branch into main

## 4. Guardrails and Safety

- [ ] 4.1 Block merge flow on unresolved High-impact findings
- [ ] 4.2 Block direct merge-to-main behavior by default
- [ ] 4.3 Require explicit user confirmation for merge execution

## 5. Documentation

- [ ] 5.1 Add usage docs for audit and merge flows
- [ ] 5.2 Add troubleshooting guidance for remote setup and conflict handling
- [ ] 5.3 Add examples of audit output and decision criteria

## 6. Validation

- [ ] 6.1 Add tests for capability impact classification
- [ ] 6.2 Add tests for gate behavior and merge blocking logic
- [ ] 6.3 Add integration scenario for end-to-end audit -> sync branch merge
