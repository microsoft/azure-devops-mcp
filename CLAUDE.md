# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build           # prebuild regenerates src/version.ts from package.json, then tsc + chmod dist/*.js
npm test                # jest (coverage always on; global threshold 40%)
npm test test/src/utils.test.ts          # single test file
npm test -- -t "list_projects"           # single test by name
npm run validate-tools  # tsc --noEmit + scripts/build-validate-tools.js (tool/param name guardrails)
npm run eslint          # eslint (also: eslint-fix)
npm run format          # prettier --write . (format-check in CI; husky + lint-staged run it pre-commit)
npm run toolset         # regenerate docs/TOOLSET.md from the built server (needs npm run build; npm run toolset-check verifies)
npm run inspect         # MCP Inspector against dist/index.js
npm run watch           # tsc --watch
```

CI (`.github/workflows/build.yml`) runs: `npm ci` → `build` → `validate-tools` → `test` → `toolset-check` → `eslint` → `format-check` → `git diff --exit-code src/version.ts package-lock.json`. Commit the regenerated `src/version.ts` whenever `package.json` version changes.

## Architecture

Fork of `microsoft/azure-devops-mcp` (origin: `DL-Solution/azure-devops-mcp`) — an MCP server exposing 376 Azure DevOps tools across 33 domains (the fork adds many beyond upstream). The core idea: tools are a **thin abstraction over the ADO REST API**; complex reasoning stays with the model. Do not add tools with heavy logic.

### Startup flow

[src/index.ts](src/index.ts) parses CLI args (yargs), builds a `DomainsManager`, then branches on transport:

- **stdio** (`runStdioTransport`) — a single long-lived `McpServer`, credentials resolved once by [src/auth.ts](src/auth.ts) (`interactive` MSAL / `azcli` / `env` / `envvar` / `pat`). PAT mode monkey-patches `globalThis.fetch` to rewrite `Bearer` → `Basic`, because `azure-devops-node-api` and hand-rolled `fetch` calls both assume bearer.
- **http** (`runHttpTransport`) — **stateless**: a fresh `McpServer` + `StreamableHTTPServerTransport` per request, so no credential or session state is shared between callers. The `--authentication` flag is ignored; the ADO token always comes per-request from an `AsyncLocalStorage` context via `getRequestToken()` ([src/transports/http.ts](src/transports/http.ts)). Two modes via `--auth`:
  - `passthrough` — caller supplies `Authorization: Bearer <ADO token>`.
  - `oauth` — [src/transports/http-oauth.ts](src/transports/http-oauth.ts) fronts the endpoint with an OAuth 2.1 AS (express + `mcpAuthRouter`) that bridges sign-in to Entra ID, because Entra lacks Dynamic Client Registration which MCP clients require. Needs `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `MCP_PUBLIC_URL`. `app.set("trust proxy", 1)` is required behind ACA ingress — without it `express-rate-limit` inside the SDK auth router throws on every request.

Both HTTP modes also serve **tool presets**: `/mcp/<preset>` registers only the domains in that preset ([src/shared/presets.ts](src/shared/presets.ts)), so a client can ask for a smaller tool list (the full set costs ~83k tokens of schema per request; `dev` costs 34k). This works precisely because the transport is stateless — the preset is a path segment, not session state. An unknown preset name is a 404, and `resolvePreset` looks the name up with `Object.hasOwn` because it comes straight from a URL.

`createConfiguredServer` passes an `instructions` string to `McpServer` ([src/shared/server-instructions.ts](src/shared/server-instructions.ts)), built from the _enabled_ domains only. MCP has no way to group tools, so this text — handed to the model next to the flat tool list — is where the server explains its own shape: what each name prefix covers, which tool answers which kind of question, and which writes are organization-wide. It costs ~1.1k tokens against ~83k for the tool schemas. **Adding a domain means adding its line to `DOMAIN_GUIDE`.**

`createConfiguredServer` wraps `server.tool` with `instrumentToolErrors` so every thrown exception **and** every `isError` result is logged to stderr with the tool name — per-tool catch blocks only return errors, they never log. Tool modules call `registerTool` (below), which delegates to `server.tool`, so they stay inside that instrumentation.

### Tools and domains

[src/tools.ts](src/tools.ts) registers each `configureXTools(server, tokenProvider, connectionProvider, userAgentProvider?)` only if its `Domain` ([src/shared/domains.ts](src/shared/domains.ts)) is enabled by `--domains`. `mcp-apps` is excluded from `all` and must be requested explicitly. Adding a domain means: enum entry in `Domain`, module in `src/tools/`, wiring in `configureAllTools`, a line in `DOMAIN_GUIDE` ([src/shared/server-instructions.ts](src/shared/server-instructions.ts)), and membership in at least one preset ([src/shared/presets.ts](src/shared/presets.ts)) — a test asserts every domain but `mcp-apps` is reachable from some preset.

Per-file convention in `src/tools/*.ts`:

- A `const X_TOOLS = { key: "prefix_tool_name" }` map at the top — the build-time validator and the ESLint rule parse this shape, so keep it.
- **Register with `registerTool(server, name, description, zodSchemaObject, handler)`** from [src/shared/tool-registration.ts](src/shared/tool-registration.ts), never `server.tool` directly. It attaches MCP annotations derived from the name: `delete`/`remove`/`unlink`/`destroy` → destructive, `list`/`get`/`show`/`search`/`find`/`query`/`my`/`read` → read-only, everything else → write. Clients bucket tools in their permission UI by these hints, so a tool whose name does not imply its real category needs an entry in `CATEGORY_OVERRIDES` (as `mcp_apps_ping` has). Handlers `try/catch` and return `{ content: [{type:"text", text}], isError: true }` on failure.
- Most tools use `connectionProvider()` → typed `azure-devops-node-api` clients. Where the node API lacks coverage tools call the REST API directly via `adoFetch` + `subdomainBaseUrl` ([src/shared/ado-rest.ts](src/shared/ado-rest.ts)) — several areas live on sibling hosts of the org URL (`vssps` for graph, `vsaex` for member entitlement, `feeds` for artifacts, `auditservice` for audit, `almsearch` for search, `analytics` for OData reporting), and `subdomainBaseUrl` handles the `dev.azure.com` / legacy `visualstudio.com` / on-prem forms. `adoFetch` also declares `charset=utf-8` on bodies, which is what fixed mangled non-ASCII work item comments. Api-version constants live in [src/utils.ts](src/utils.ts); some modules pin their own.
- Missing `project`/`team` args are resolved through [src/shared/elicitations.ts](src/shared/elicitations.ts), which first honours the `ado_mcp_project` / `ado_mcp_team` env defaults before prompting via `elicitInput`.
- **Declare `project`/`team` with the shared schemas** from [src/shared/common-params.ts](src/shared/common-params.ts) (`optionalProject`, `requiredProject`, `optionalTeam`, `requiredTeam`, or the `…With(note)` builders), never a hand-written `z.string().describe(...)`. There used to be 171 copies of that sentence, costing ~4.7k tokens of schema on every request; a test fails if one comes back. That a missing value triggers an elicitation is stated once in `instructions`, not per parameter.
- Free-text content fetched from ADO (wiki pages, work item comments, pipeline logs) is returned through `createExternalContentResponse` ([src/shared/content-safety.ts](src/shared/content-safety.ts)), which wraps it in nonce-delimited spotlighting markers. Use it for any new tool that surfaces user-authored content.
- Tool modules must not import from `src/index.ts`: it parses argv at import time, so anything that pulls it in becomes untestable. Derive hosts from `connection.serverUrl` (via `subdomainBaseUrl`) instead — `src/tools/search.ts` used to import `orgName` from there and was the one domain with no tests because of it.

### Resources

[src/resources.ts](src/resources.ts) registers MCP resources — reference material the model reads, as opposed to tools it calls. `ado://wiql-reference` is static markdown (WIQL has no metadata endpoint, and getting the syntax wrong is the most common way a work item query fails); the rest are `ResourceTemplate` views over metadata a tool already exposes (`ado://projects`, `ado://project/{project}/teams`, `.../work-item-types`, `.../fields`). Registration is domain-gated like tools, so a preset endpoint does not advertise what it cannot serve.

**Clients do not load resources automatically** — a user attaches one, or the model reads it deliberately after seeing it named in `instructions`. So nothing here may be load-bearing: every fact a resource carries must also be reachable through a tool, and a new resource needs a line in `RESOURCE_GUIDE` ([src/shared/server-instructions.ts](src/shared/server-instructions.ts)) or the model will never know it exists.

### Name validation guardrails

Claude's API requires `^[a-zA-Z0-9_.-]{1,64}$` for tool and parameter names. Validation logic lives once in [src/shared/tool-validation.ts](src/shared/tool-validation.ts) and is consumed by both [scripts/build-validate-tools.js](scripts/build-validate-tools.js) (`npm run validate-tools`, gate in CI) and [eslint-rules/tool-name-lint-rule.js](eslint-rules/tool-name-lint-rule.js) (applied to `src/tools/*.ts`). Details in [docs/TOOL-NAME-VALIDATION.md](docs/TOOL-NAME-VALIDATION.md).

### Deployment (fork-specific)

[deploy/azure/main.bicep](deploy/azure/main.bicep) + [deploy/docker-entrypoint.sh](deploy/docker-entrypoint.sh) run the HTTP transport on Azure Container Apps; the entrypoint maps `MCP_*` env vars (`MCP_TRANSPORT`, `MCP_HOST`, `MCP_PORT`, `MCP_AUTH`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `MCP_DOMAINS`) onto CLI flags. `.github/workflows/deploy-aca.yml` deploys in **oauth** mode via OIDC. One deployment serves one ADO organization. See [deploy/azure/README.md](deploy/azure/README.md).

## Constraints to respect

- **Never write to stdout.** stdio transport owns it; all logging goes through the winston `logger` ([src/logger.ts](src/logger.ts)) which streams to stderr. `LOG_LEVEL` controls verbosity.
- **Copyright header** on every `src/**/*.ts` except `src/index.ts` — enforced by `header/header` in [eslint.config.mjs](eslint.config.mjs):
  ```ts
  // Copyright (c) Microsoft Corporation.
  // Licensed under the MIT License.
  ```
- **ESM with `.js` import specifiers** (`module: Node16`). Jest runs tests as CommonJS, and `jest.config.cjs` has a `moduleNameMapper` listing specific `.js` → `.ts` rewrites (version, utils, auth, logger, elicitations, content-safety, tool-registration, ado-rest). **A new shared module imported as `../shared/foo.js` from a tested file needs its own entry there**, or the suite fails to resolve it.
- Tests live in `test/` mirroring `src/`, and typically assert on a `server = { tool: jest.fn(), server: { elicitInput: jest.fn() } }` double plus mocked ADO API objects — they verify registration and handler behaviour, not the real SDK. That bare mock works with `registerTool` only because it applies annotations via `registered?.update?.()`; keep the optional chaining when touching it.
- Regenerate [docs/TOOLSET.md](docs/TOOLSET.md) when tools change: `npm run build && npm run toolset` ([scripts/generate-toolset.mjs](scripts/generate-toolset.mjs)). Parameter lists come from the served input schemas and are rewritten every run; the one-line summaries and purpose paragraphs are hand-written and preserved, so edit those in the document itself. A new tool name prefix needs an entry in the script's `AREAS`. CI runs `npm run toolset-check` after the build, so a PR that changes a tool without regenerating the document fails.
