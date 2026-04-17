# Fork Notes: On-Prem Azure DevOps + PAT

This document describes the fork-specific changes required to run this MCP server against Azure DevOps Server (on-premises) using Personal Access Tokens (PAT).

## What Changed In This Fork

### 1) Organization input now accepts full URLs

- `src/index.ts` now accepts either:
  - organization name, for example `contoso`, or
  - full organization/collection URL, for example `https://ado.company.local/tfs/DefaultCollection`
- New helper module: `src/deployment.ts`
  - normalizes deployment context
  - detects hosted vs on-prem
  - derives hosted-only endpoints when available

Why: on-prem servers do not use the `https://dev.azure.com/{org}` pattern.

### 2) Tenant discovery is now hosted-only

- `src/index.ts` now resolves tenant metadata only for hosted Entra-based auth flows (`interactive`, `azcli`, `env`).
- It does not call tenant lookup for PAT auth or on-prem URLs.

Why: `src/org-tenants.ts` uses Azure DevOps Services endpoint behavior (`vssps.dev.azure.com`) that is not valid for most on-prem deployments.

### 3) PAT auth now supports raw PAT values

- `src/auth.ts` PAT mode now supports:
  - preferred: raw PAT via `ADO_PAT`
  - compatibility: raw `PERSONAL_ACCESS_TOKEN`
  - compatibility: legacy base64 `PERSONAL_ACCESS_TOKEN` containing `email:pat`
- `src/index.ts` now passes raw PAT to `getPersonalAccessTokenHandler(...)`.

Why: requiring base64-encoded `email:pat` was difficult to operate and error-prone for local tooling.

### 4) Direct fetch auth rewriting updated for PAT mode

- `src/index.ts` still rewrites `Authorization: Bearer ...` to `Authorization: Basic ...` in PAT mode for tool paths that use direct `fetch`.
- The Basic credential is now generated from the raw PAT (`:${pat}`), which is the standard PAT Basic auth form.

Why: several tools currently issue direct REST calls and still set Bearer headers.

### 5) Identity API endpoint is deployment-aware

- `src/tools/auth.ts` now uses `buildIdentityApiBaseUrl(...)` from `src/deployment.ts`.
- Hosted keeps `vssps.dev.azure.com` behavior.
- On-prem uses `<connection.serverUrl>/_apis/identities`.

Why: previous logic assumed hosted URL shape and split server URL by fixed path segments.

### 6) Search tools are now explicit about hosted-only support

- `src/tools/search.ts` now builds search URLs via deployment helpers.
- For on-prem URLs, search tools return a clear unsupported message instead of calling hosted `almsearch.dev.azure.com` endpoints.

Why: current search implementation relies on Azure DevOps Services search endpoints.

## Behavior Compatibility

- Existing hosted org-name usage is preserved.
- Existing PAT users with legacy base64 `PERSONAL_ACCESS_TOKEN` remain supported.
- New recommended PAT variable is `ADO_PAT` with raw PAT value.

## Known Limitations

- `search_*` tools are currently Azure DevOps Services-only in this fork.
- API versions remain fixed to upstream defaults (`7.2-preview.*` in most places). Older on-prem releases may require additional API-version compatibility work.

## OpenCode Setup

Use OpenCode local MCP configuration and point to your fork build output.

Config file location:

- macOS/Linux: `~/.config/opencode/opencode.json`

Example:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "azure-devops-onprem": {
      "type": "local",
      "enabled": true,
      "command": [
        "node",
        "/absolute/path/to/azure-devops-mcp/dist/index.js",
        "https://ado.company.local/tfs/DefaultCollection",
        "--authentication",
        "pat",
        "-d",
        "core",
        "work",
        "work-items",
        "repositories",
        "wiki",
        "pipelines",
        "test-plans"
      ],
      "environment": {
        "ADO_PAT": "<your-pat>",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

If you publish this fork to npm, replace the `node .../dist/index.js` command with `npx -y <your-package-name> ...`.

## Validation Checklist

1. Build and run tests:

```bash
npm install
npm run build
npm test
```

2. Start the MCP server with on-prem URL + PAT auth.
3. Validate at least:
   - list projects
   - list teams
   - list repositories
4. If search tools are loaded on-prem, expect explicit unsupported messages.

## Troubleshooting

- 401/403 on all tools:
  - verify PAT scope and org permissions
  - verify `ADO_PAT` is set in OpenCode environment block
- Startup succeeds but tool calls fail with URL errors:
  - verify first positional argument is full on-prem collection URL
- Search tool failures on on-prem:
  - expected in this fork; restrict domains or avoid `search` domain
