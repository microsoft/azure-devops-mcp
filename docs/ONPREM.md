# Azure DevOps Server (On-Premises): Read-Only Pull Request Review

The local MCP server targets Azure DevOps Services by default. Passing `--server-url` switches it to a separate, read-only mode for **Azure DevOps Server** (2019 and later). This mode is for reviewing pull requests. It does not expose the cloud toolset.

> [!NOTE]
> In this mode the server never calls cloud-only endpoints such as tenant discovery or Microsoft Entra sign-in. It loads only the tools listed below. Write operations are not available. Cloud behavior does not change when you omit `--server-url`.

## Usage

```bash
node dist/index.js <collection> --server-url <server-root> [-a windows|pat] [--api-version 5.0] [-d repositories]
```

| Argument               | Description                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<collection>`         | Project collection name (for example `DefaultCollection`). In on-prem mode this positional argument replaces the organization name.                                         |
| `--server-url`         | Server root without the collection, for example `https://ado.contoso.com` or `https://ado.contoso.com/tfs`. Do not put credentials, query strings, or fragments in the URL. |
| `-a, --authentication` | `windows` (default in this mode) or `pat`. No other authentication types are accepted with `--server-url`.                                                                  |
| `--api-version`        | REST API version sent with every request. Defaults to `5.0` (Azure DevOps Server 2019). Newer servers accept higher versions such as `7.0`.                                 |
| `-d, --domains`        | Must include `repositories` (the default `all` does). Other domains are ignored and a warning is logged.                                                                    |

The collection URL is `<server-root>/<collection>`. To list the collections your account can see, open `<server-root>/_apis/projectCollections?api-version=5.0` in a browser.

## Authentication

### Windows integrated authentication (`windows`, default)

Requests are sent from a persistent, hidden Windows PowerShell worker. The worker uses .NET `HttpClient` with `UseDefaultCredentials`. NTLM or Negotiate (Kerberos) runs through Windows SSPI with the identity of the signed-in user. Neither Node.js nor the MCP configuration ever holds a password or token.

- Windows only. `powershell.exe` must be on `PATH`.
- PowerShell Constrained Language Mode or application control policies can block the worker. If that happens, the worker's error message is returned in the tool result.
- Redirects are not followed. Requests are restricted to the configured collection URL, so integrated credentials are never sent to another host.

### Personal access token (`pat`)

Set `PERSONAL_ACCESS_TOKEN` in the environment that starts the MCP client to the base64 encoding of `<username>:<pat>`, the same format used in cloud `pat` mode. The token is sent with HTTP Basic authentication. The server must have PAT authentication enabled. Do not put the token in the MCP configuration file.

## Tools

All tools are read-only. Their output is wrapped as untrusted content, as in cloud mode.

| Tool                         | Actions                                              | Purpose                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onprem_project_list`        | —                                                    | List projects in the collection.                                                                                                                                                    |
| `onprem_repository`          | `list`, `get`                                        | List or get Git repositories in a project.                                                                                                                                          |
| `onprem_pull_request`        | `list`, `get`, `commits`, `iterations`, `work_items` | Search pull requests, read metadata (reviewers, votes, branches, merge status), commits, iterations (pushes), and linked work items.                                                |
| `onprem_pull_request_change` | `list`, `diff`, `content`                            | List changed files for an iteration. Produce a unified diff of one file against the merge base. Read file content from the source, base, or target side, or from a specific commit. |
| `onprem_pull_request_thread` | —                                                    | Read discussion threads, including file and line anchors. System threads and deleted comments are excluded by default.                                                              |

Diffs are computed locally from the two file versions, because Azure DevOps Server does not provide a text diff REST API. Changes use the latest iteration by default. Pass `iterationId` and `compareTo` to review a single push.

## GitHub Copilot CLI

Build from source as described in [Run from Source](./GETTINGSTARTED.md#run-from-source). This mode is not in published npm releases until it is merged and released. Then add the server to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "ado-server": {
      "command": "node",
      "args": ["C:\\path\\to\\azure-devops-mcp\\dist\\index.js", "{Collection}", "--server-url", "https://{server}", "-a", "windows"],
      "tools": ["*"]
    }
  }
}
```

Example prompt: `Review pull request 123 in {Project}: summarize the change, inspect each changed file's diff, and account for open review threads.`

## Limitations

- Pull request review only. Work item, pipeline, wiki, search, and test plan tools are not available in this mode.
- Windows integrated authentication requires Windows. Use `pat` on other platforms.
- Very large files can produce a non-minimal diff. When that happens, the changed region is shown as one replacement and the output includes a `note`.
