# Azure DevOps MCP Server — Gallagher Fork

This is a fork of [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) with changes to make the local MCP server work against **Azure DevOps Server (on-premises / TFS)** using **Personal Access Token (PAT)** authentication.

For the original project documentation, see the [upstream README](https://github.com/microsoft/azure-devops-mcp/blob/main/README.md).

## Table of Contents

- [Security Disclaimer](#security-disclaimer)
- [What This Fork Adds](#what-this-fork-adds)
- [Using With Claude Code](#using-with-claude-code)
- [Using With Claude Desktop](#using-with-claude-desktop)
- [Getting Latest Updates From Upstream](#getting-latest-updates-from-upstream)
- [Further Reading](#further-reading)

## Security Disclaimer

> [!WARNING]
> **This MCP server acts as you.** Every TFS / Azure DevOps action it performs — reading work items, posting comments, creating pull requests, updating fields, voting, creating branches, linking artifacts — is authenticated with **your PAT (or your Entra identity)** and will appear in audit logs as **performed by you**. The LLM driving the server decides which tools to call, in what order, with what arguments. You are accountable for those actions.
>
> Before using this server:
>
> - **Scope your PAT to the minimum required.** Don't issue a full-access PAT if read-only work-item access is enough. PAT scope is your blast radius.
> - **Treat the PAT like a password.** Don't commit it, don't paste it into chat, don't share configs that contain it. Prefer environment variables (`ADO_PAT`) over inline JSON when possible.
> - **Review tool calls before approving them.** In Claude Code, default permission prompts surface each MCP tool call — read them. Don't blanket-allow state-changing tools (anything that writes, updates, deletes, posts, creates) unless you genuinely want autonomous operation.
> - **Be especially cautious in agent / auto modes.** Loops and auto-approve modes will execute many tools without per-call confirmation. Combined with a wide-scoped PAT, the LLM can make many changes very quickly.
> - **Rotate the PAT if it leaks** — into a log, a commit, a screenshot, a shared config — and revoke the old one immediately in Azure DevOps.
>
> The fork authors and Microsoft (upstream) take no responsibility for actions the LLM performs through this server using your credentials.

## What This Fork Adds

These are the deltas vs `microsoft/azure-devops-mcp` (`main`). For the full rationale behind each change, see [docs/FORK-ONPREM-PAT.md](./docs/FORK-ONPREM-PAT.md).

| Area                   | Change                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org input              | First positional arg now accepts either an org name (`contoso`) **or** a full on-prem collection URL (`https://ado.company.local/tfs/DefaultCollection`).              |
| Tenant discovery       | Skipped for PAT auth and on-prem URLs — only runs for hosted Entra-based flows (`interactive`, `azcli`, `env`).                                                        |
| PAT auth               | Now accepts a raw PAT via `ADO_PAT` (preferred) or `PERSONAL_ACCESS_TOKEN`. Legacy base64 `email:pat` in `PERSONAL_ACCESS_TOKEN` is still supported for compatibility. |
| PAT Basic-auth rewrite | The `Authorization` header rewriting for direct `fetch` calls now uses `Basic base64(:<pat>)`, the standard PAT form.                                                  |
| Identity API           | `src/tools/auth.ts` now picks the right identities endpoint per deployment — hosted keeps `vssps.dev.azure.com`, on-prem uses `<serverUrl>/_apis/identities`.          |
| Search tools           | Search tools detect on-prem and return a clear "unsupported on this deployment" message instead of calling hosted-only `almsearch.dev.azure.com` endpoints.            |
| New helper module      | `src/deployment.ts` — normalizes deployment context (hosted vs on-prem), derives endpoint base URLs.                                                                   |
| New fork docs          | [docs/FORK-ONPREM-PAT.md](./docs/FORK-ONPREM-PAT.md), this README.                                                                                                     |
| New tests              | `test/src/deployment.test.ts`, additions in `test/src/pat-auth.test.ts`, `test/src/tools/auth.test.ts`, `test/src/tools/search.test.ts`.                               |

### Known limitations of the fork

- `search_*` tools remain hosted-only.
- API versions are still pinned to upstream defaults (`7.2-preview.*`). Older on-prem releases may need version-compatibility work.

## Using With Claude Code

### Hosted Azure DevOps (Entra / az CLI auth)

```bash
claude mcp add azure-devops -- npx -y @azure-devops/mcp Contoso
```

Replace `Contoso` with your org name. On first use, a browser window opens for Microsoft sign-in.

### On-prem Azure DevOps Server with PAT (fork-specific)

This fork is not published to npm, so you point Claude Code at your local build.

1. Build the fork:
   ```bash
   npm install
   npm run build
   ```
2. Generate a PAT in your on-prem ADO instance (User settings → Personal access tokens) with the scopes you need.
3. Register the server with Claude Code:
   ```bash
   claude mcp add azure-devops-onprem \
     --env ADO_PAT=<your-pat> \
     -- node /absolute/path/to/azure-devops-mcp/dist/index.js \
        https://ado.company.local/tfs/DefaultCollection \
        --authentication pat \
        -d core work work-items repositories wiki pipelines test-plans
   ```

The `-d` flags load only the listed domains. Omitting them loads everything — including `search`, which will return "unsupported" messages on on-prem at call time. Excluding the `search` domain via `-d` keeps the tool surface cleaner for on-prem use.

To verify, run `claude mcp list` — `azure-devops-onprem` should show as connected. Then try a prompt like `list ADO projects on the on-prem server`.

## Using With Claude Desktop

Open **File → Settings → Developer → Edit Config** and edit `claude_desktop_config.json`.

### Hosted Azure DevOps

```json
{
  "mcpServers": {
    "ado": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "Contoso"]
    }
  }
}
```

Replace `Contoso` with your org name. Save and fully restart Claude Desktop.

### On-prem Azure DevOps Server with PAT (fork-specific)

```json
{
  "mcpServers": {
    "azure-devops-onprem": {
      "command": "node",
      "args": [
        "C:\\absolute\\path\\to\\azure-devops-mcp\\dist\\index.js",
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
      "env": {
        "ADO_PAT": "<your-pat>"
      }
    }
  }
}
```

Notes:

- On Windows, escape backslashes in JSON paths (`C:\\path\\to\\...`).
- Run `npm run build` after pulling fork updates so `dist/` is current.
- After editing the config, perform a **hard restart** of Claude Desktop (quit from the tray icon, not just close the window).

Then start a new chat, open **Search and Tools**, and the `azure-devops-onprem` toolset should appear. Try `list my ADO projects`.

## Getting Latest Updates From Upstream

The fork tracks `microsoft/azure-devops-mcp`. To pull in new upstream commits while keeping fork-specific changes:

### One-time setup

Add the upstream remote (only needed once per clone):

```bash
git remote add upstream https://github.com/microsoft/azure-devops-mcp.git
```

Confirm with `git remote -v` — you should see both `origin` (your fork) and `upstream` (Microsoft).

### Pulling updates

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

If the merge is clean, you're done. If there are conflicts:

1. `git status` shows the conflicted files.
2. For fork-specific files (anything in [What This Fork Adds](#what-this-fork-adds) — `src/auth.ts`, `src/deployment.ts`, `src/tools/auth.ts`, `src/tools/search.ts`, `src/index.ts`, fork docs), resolve in favour of the fork's behaviour, then layer upstream's changes on top if compatible.
3. For everything else, take upstream unless there's a clear reason not to.
4. After resolving: `git add <files>` then `git commit` to complete the merge.

### Validate before pushing

```bash
npm install
npm run build
npm test
```

If build and tests pass, push to your fork:

```bash
git push origin main
```

> **Note:** This fork uses **merge** (not rebase) so the on-prem/PAT commit stays as a single linear history entry. Don't `git rebase upstream/main` — it would rewrite the fork's commit hashes and cause friction for anyone tracking this fork.

## Further Reading

- [Upstream README on GitHub](https://github.com/microsoft/azure-devops-mcp/blob/main/README.md) — Microsoft's project README (always reflects upstream `main`).
- [docs/FORK-ONPREM-PAT.md](./docs/FORK-ONPREM-PAT.md) — full rationale for each fork change, plus OpenCode setup and troubleshooting.
- [docs/GETTINGSTARTED.md](./docs/GETTINGSTARTED.md) — upstream's setup guide covering VS Code, Visual Studio 2022, Cursor, Codex, Kilocode (also includes a section for this fork's on-prem PAT mode under OpenCode).
- [docs/TOOLSET.md](./docs/TOOLSET.md) — full list of MCP tools exposed by the server.
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — common issues and logging.
- [docs/FAQ.md](./docs/FAQ.md) — FAQ (includes a fork-specific PAT entry).
