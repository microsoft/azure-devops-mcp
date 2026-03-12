# Remote Deployment (Azure Container Apps)

Add this section to the main README.

---

## Remote Deployment (Azure Container Apps)

You can run the MCP server over **Streamable HTTP** in Azure Container Apps, with authentication handled by **Azure Entra ID (Easy Auth)** at the platform. The server uses a **PAT** from the environment for Azure DevOps calls.

### Running the HTTP server locally

```bash
# Build
npm run build

# Run (PAT must be set)
set ADO_MCP_AUTH_TOKEN=your_pat
node dist/http.js myorg --domains all --authentication envvar

# Or use the script
npm run start:http -- myorg --domains all
```

- **Required:** `ADO_MCP_AUTH_TOKEN` – Azure DevOps Personal Access Token (when using `--authentication envvar`).
- **Optional:** `PORT` – HTTP port (default `3000`). Can also use `--port 3000`.
- **Optional:** `ALLOWED_EMAILS` – Comma-separated list of user emails allowed to call the server. If set, only these users (from Easy Auth) can use `/mcp`.
- **Optional (local only):** `MCP_HTTP_SKIP_EASY_AUTH=1` – Skip Easy Auth so clients can connect without the `x-ms-client-principal` header. Use only for local development; do not set in production.

Endpoints:

- `GET /healthz` – Health check (returns 200 OK).
- `POST /mcp` and `GET /mcp` – MCP Streamable HTTP protocol. Requests must include the `x-ms-client-principal` header (set by Easy Auth) unless `MCP_HTTP_SKIP_EASY_AUTH=1` is set for local use. If `ALLOWED_EMAILS` is set, the principal’s email must be in that list.

### HTTP vs stdio: Backlog and work items

Over **Streamable HTTP**, clients may send fewer or different tool-call sequences than over stdio. The **list_backlog_work_items** tool is designed to return full work item details (title, state, assigned to, etc.) in a single call by default, so you get the same rich backlog data over HTTP as over stdio. If you only need references (id, url), call it with `includeWorkItemDetails: false`.

### Connecting from clients (local server)

When running locally, set `MCP_HTTP_SKIP_EASY_AUTH=1` so clients can call `/mcp` without Easy Auth, then point the client at `http://localhost:3000/mcp`.

**PowerShell (one session):**
```powershell
$env:ADO_MCP_AUTH_TOKEN = "your_pat"
$env:MCP_HTTP_SKIP_EASY_AUTH = "1"
node dist/http.js myorg --domains all --authentication envvar
```

- **Claude Desktop** – Claude Desktop talks to MCP over stdio, not HTTP. Use a bridge that speaks Streamable HTTP, e.g. the stdio→Streamable HTTP adapter. In `claude_desktop_config.json` (see [Claude config location](https://docs.anthropic.com/en/docs/build-with-claude/claude-desktop-config)):
  ```json
  {
    "mcpServers": {
      "azure-devops": {
        "command": "npx",
        "args": ["-y", "@pyroprompts/mcp-stdio-to-streamable-http-adapter"],
        "env": {
          "URI": "http://localhost:3000/mcp"
        }
      }
    }
  }
  ```
  Install the adapter once: `npm install -g @pyroprompts/mcp-stdio-to-streamable-http-adapter` (or rely on `npx`). Restart Claude Desktop after changing config.

- **Cursor / VS Code** – In Cursor: **Settings → Tools & MCP → Add new MCP server**. Choose type **Streamable HTTP**, URL `http://localhost:3000/mcp`. Alternatively, in `.cursor/mcp.json` (project or user):
  ```json
  {
    "mcpServers": {
      "azure-devops": {
        "url": "http://localhost:3000/mcp",
        "transport": "streamableHttp"
      }
    }
  }
  ```
  Quit and restart Cursor after editing.

- **ChatGPT for Windows** – ChatGPT expects a **public HTTPS** connector URL. For a server on your machine, expose it with a tunnel (e.g. [ngrok](https://ngrok.com)): `ngrok http 3000`, then in ChatGPT **Settings → Apps & Connectors → Create connector** use the ngrok URL plus `/mcp` (e.g. `https://abc123.ngrok-free.app/mcp`). Do not use `MCP_HTTP_SKIP_EASY_AUTH` when the URL is public; use proper auth (e.g. Easy Auth or a reverse proxy with auth) instead.

### Docker

Build and run with the included Dockerfile:

```bash
docker build -t azure-devops-mcp-http .
docker run -e ADO_MCP_AUTH_TOKEN=your_pat -p 3000:3000 azure-devops-mcp-http node dist/http.js myorg --domains all --authentication envvar
```

Override the default org by passing args after the image name.

### Azure Container Apps

1. Build and push the image to a container registry, then deploy to Azure Container Apps.
2. In Container Apps, **enable Authentication** (Easy Auth) with **Entra ID** and require login.
3. Configure the app with:
   - **Required:** `ADO_MCP_AUTH_TOKEN` (secret or Key Vault reference).
   - **Optional:** `PORT` (default 3000), `ALLOWED_EMAILS`.

Do not expose the server publicly without authentication; Easy Auth should be used to require Entra ID sign-in before requests reach the app.

### Connecting to the Container App

After deployment, your MCP endpoint is:

- **URL:** `https://<your-app-name>.<optional-revision-domain>.azurecontainerapps.io/mcp`  
  (Use the app’s FQDN from the Azure portal or CLI, then add `/mcp`.)

**Authentication:** The app is protected by Entra ID (Easy Auth). Requests must be authenticated.

- **Browser:** Opening the app URL in a browser redirects to Entra sign-in; after login, the session is cookie-based. MCP desktop clients do not use this session; they need a Bearer token (below).

- **Programmatic clients (Claude Desktop, Cursor, ChatGPT):** Send an **Entra ID access token** in the request. Get a token with audience set to your Container App’s Entra app registration (the one used by Easy Auth).

**Getting a token (examples):**

- **Azure CLI** (user signs in with `az login`):
  ```bash
  az account get-access-token --resource <client-id-of-your-container-app-app-registration>
  ```
  Use the **Application (client) ID** of the Entra app that is linked to your Container App’s authentication. The token is in the output (`accessToken`); it typically expires in about one hour.

- **PowerShell** (same idea, after `az login`):
  ```powershell
  (az account get-access-token --resource <client-id> --query accessToken -o tsv)
  ```

**Configuring clients to use the Container App URL and token:**

- **Claude Desktop** (via stdio→Streamable HTTP adapter) – use the remote URL and, if the adapter supports it, a Bearer token:
  ```json
  {
    "mcpServers": {
      "azure-devops": {
        "command": "npx",
        "args": ["-y", "@pyroprompts/mcp-stdio-to-streamable-http-adapter"],
        "env": {
          "URI": "https://<your-app>.azurecontainerapps.io/mcp",
          "BEARER_TOKEN": "<paste-access-token-here>"
        }
      }
    }
  }
  ```
  Replace `<your-app>` with your Container App hostname and `<paste-access-token-here>` with the token from the command above. Tokens expire; refresh and update `BEARER_TOKEN` when needed, or use a script/tool that obtains a fresh token and sets the env var before starting Claude.

- **Cursor** – Add a Streamable HTTP MCP server with URL `https://<your-app>.azurecontainerapps.io/mcp`. If Cursor supports custom headers for that server, set `Authorization: Bearer <access-token>`. Otherwise, use a local bridge (e.g. the same adapter as Claude) that points at the Container App URL and passes the token.

- **ChatGPT** – In **Settings → Apps & Connectors**, create a connector with URL `https://<your-app>.azurecontainerapps.io/mcp`. If the connector configuration allows an API key or Bearer token, use the Entra access token there. ChatGPT expects HTTPS; the Container App URL is already HTTPS.

**Restricting who can call the server:** Set the `ALLOWED_EMAILS` environment variable on the Container App to a comma-separated list of user emails (e.g. `user1@contoso.com,user2@contoso.com`). Only those users (identified by Easy Auth / the token) can use the `/mcp` endpoint.
