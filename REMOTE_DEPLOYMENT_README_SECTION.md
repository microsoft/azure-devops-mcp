# Remote Deployment (Azure Container Apps)

Add this section to the main README.

---

## Remote Deployment (Azure Container Apps)

You can run the MCP server over **Streamable HTTP** in Azure Container Apps, with authentication handled by **Azure Entra ID (Easy Auth)** at the platform. The recommended production configuration is **OAuth identity passthrough** with **delegated Entra user tokens** for Azure DevOps, using **On-Behalf-Of (OBO)** token exchange inside the MCP server.

### Running the HTTP server locally

```bash
# Build
npm run build

# Run with OAuth passthrough
node dist/http.js myorg --domains all --authentication passthrough

# Or use the script
npm run start:http -- myorg --domains all
```

- **Optional:** `PORT` – HTTP port (default `3000`). Can also use `--port 3000`.
- **Optional:** `ALLOWED_EMAILS` – Comma-separated list of user emails allowed to call the server. If set, only these users (from Easy Auth) can use `/mcp`.
- **Optional (local only):** `MCP_HTTP_SKIP_EASY_AUTH=1` – Skip Easy Auth so clients can connect without the `x-ms-client-principal` header. Use only for local development; do not set in production.
- **Required for OBO:** `ADO_MCP_OBO_CLIENT_ID` – Entra app registration client ID for the MCP server.
- **Required for OBO:** `ADO_MCP_OBO_CLIENT_SECRET` – Client secret for the MCP server app registration.
- **Required for OBO:** `ADO_MCP_OBO_TENANT_ID` – Tenant ID used for OBO token exchange.

If the incoming access token already has Azure DevOps as its audience, the MCP server can use it directly. In typical Foundry deployments the incoming token audience is your MCP app, so the OBO settings above are required.

Endpoints:

- `GET /healthz` – Health check (returns 200 OK).
- `POST /mcp` and `GET /mcp` – MCP Streamable HTTP protocol. Requests must include the `x-ms-client-principal` header (set by Easy Auth) unless `MCP_HTTP_SKIP_EASY_AUTH=1` is set for local use. If `ALLOWED_EMAILS` is set, the principal’s email must be in that list.

### HTTP vs stdio: Backlog and work items

Over **Streamable HTTP**, clients may send fewer or different tool-call sequences than over stdio. The **list_backlog_work_items** tool is designed to return full work item details (title, state, assigned to, etc.) in a single call by default, so you get the same rich backlog data over HTTP as over stdio. If you only need references (id, url), call it with `includeWorkItemDetails: false`.

### Connecting from clients (local server)

When running locally, set `MCP_HTTP_SKIP_EASY_AUTH=1` so clients can call `/mcp` without Easy Auth, then point the client at `http://localhost:3000/mcp`.

**PowerShell (one session):**
```powershell
$env:MCP_HTTP_SKIP_EASY_AUTH = "1"
node dist/http.js myorg --domains all --authentication passthrough
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
docker run -e ADO_MCP_OBO_CLIENT_ID=<client-id> -e ADO_MCP_OBO_CLIENT_SECRET=<client-secret> -e ADO_MCP_OBO_TENANT_ID=<tenant-id> -p 3000:3000 azure-devops-mcp-http node dist/http.js myorg --domains all --authentication passthrough
```

Override the default org by passing args after the image name.

### Azure Container Apps

1. Build and push the image to a container registry, then deploy to Azure Container Apps.
2. In Container Apps, **enable Authentication** (Easy Auth) with **Entra ID** and require login.
3. Configure the app with:
   - **Required:** `ADO_MCP_OBO_CLIENT_ID` (app registration client ID).
   - **Required:** `ADO_MCP_OBO_CLIENT_SECRET` (secret or Key Vault reference).
   - **Required:** `ADO_MCP_OBO_TENANT_ID` (tenant ID).
   - **Optional:** `PORT` (default 3000), `ALLOWED_EMAILS`.

Do not expose the server publicly without authentication; Easy Auth should be used to require Entra ID sign-in before requests reach the app.

### Foundry OAuth Identity Passthrough

This is the recommended production setup when the MCP server is consumed from Azure AI Foundry.

#### 1. Register an Entra app for the MCP server

Create an Entra application that represents the remote MCP server.

- Record the **Application (client) ID** and **Directory (tenant) ID**.
- Create a **client secret** for the app.
- Configure the app as a **web/API** app and expose it through Azure Container Apps authentication.
- If your organization restricts user assignment, assign the users or groups who should be able to call the MCP.

#### 2. Give the MCP app delegated Azure DevOps permission

In the MCP app registration:

- Go to **API permissions**.
- Add a permission for **Azure DevOps**.
- Choose the **delegated** permission needed for Azure DevOps user access.
- Grant **admin consent** for the tenant.

The MCP server requests an Azure DevOps delegated token for resource app ID `499b84ac-1321-427f-aa17-267ca6975798`.

#### 3. Configure Azure Container Apps authentication

In your Container App:

- Enable **Authentication**.
- Add **Microsoft** as the identity provider.
- Use the MCP app registration created above.
- Set **Unauthenticated requests** to require authentication.
- Enable token forwarding / token store so the validated user access token is forwarded to the container. The MCP server reads either:
  - `x-ms-token-aad-access-token`, or
  - `Authorization: Bearer <token>`

Easy Auth validates the incoming user token before the request reaches `/mcp`.

#### 4. Configure container environment variables

Set these app settings on the Container App:

```text
ADO_MCP_OBO_CLIENT_ID=<application-client-id-of-mcp-app>
ADO_MCP_OBO_CLIENT_SECRET=<client-secret-for-mcp-app>
ADO_MCP_OBO_TENANT_ID=<entra-tenant-id>
ALLOWED_EMAILS=user1@contoso.com,user2@contoso.com    # optional
PORT=3000                                             # optional
```

Start the server with:

```bash
node dist/http.js <your-org> --domains all --authentication passthrough
```

#### 5. Configure the Foundry connector

In Azure AI Foundry, create the MCP connector pointing at:

```text
https://<your-container-app-fqdn>/mcp
```

Use:

- **Authentication type:** OAuth
- **Identity mode:** OAuth identity passthrough
- **Audience / resource:** the MCP app registration used by Container Apps authentication

With this configuration, Foundry sends the signed-in user’s Entra token to the MCP endpoint. The MCP server then:

1. Receives the delegated user token.
2. Detects whether it is already an Azure DevOps token.
3. If not, performs an **On-Behalf-Of** exchange for Azure DevOps.
4. Calls Azure DevOps with the user’s delegated token.

This means Azure DevOps authorization is evaluated per user, not with a shared PAT.

#### 6. Validate the end-to-end flow

Use a test user who has access to both:

- the Foundry project / connector
- the target Azure DevOps organization

Then verify:

- The request reaches the Container App only after Entra sign-in.
- The MCP server can list Azure DevOps projects without `ADO_MCP_AUTH_TOKEN`.
- A user without Azure DevOps access receives an Azure DevOps authorization failure.
- A user outside `ALLOWED_EMAILS` receives a 403 from the MCP server.

#### 7. Troubleshooting

- If Foundry sends a token for the MCP app instead of Azure DevOps, that is expected. OBO is what converts it to an Azure DevOps delegated token.
- If OBO fails, check:
  - `ADO_MCP_OBO_CLIENT_ID`
  - `ADO_MCP_OBO_CLIENT_SECRET`
  - `ADO_MCP_OBO_TENANT_ID`
  - Azure DevOps delegated API permission on the MCP app
  - tenant admin consent
- If the app sees no token at all, verify Container Apps authentication is forwarding the validated access token to the container.
- If Azure DevOps returns authorization errors, confirm the signed-in user actually has access inside the Azure DevOps organization.

### Connecting to the Container App

After deployment, your MCP endpoint is:

- **URL:** `https://<your-app-name>.<optional-revision-domain>.azurecontainerapps.io/mcp`  
  (Use the app’s FQDN from the Azure portal or CLI, then add `/mcp`.)

**Authentication:** The app is protected by Entra ID (Easy Auth). Requests must be authenticated.

- **Browser:** Opening the app URL in a browser redirects to Entra sign-in; after login, the session is cookie-based. MCP desktop clients do not use this session; they need a Bearer token (below).

- **Programmatic clients (Claude Desktop, Cursor, ChatGPT):** Send an **Entra ID access token** in the request. Get a token with audience set to your MCP app registration / Container App authentication app. The MCP server will exchange it On-Behalf-Of for an Azure DevOps token when needed.

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
