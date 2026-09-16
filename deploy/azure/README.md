# Deploying the Azure DevOps MCP server to Azure Container Apps

This directory contains everything needed to run the MCP server's **HTTP
transport** in production on [Azure Container Apps](https://learn.microsoft.com/azure/container-apps/) (ACA).

## Architecture

```
                       HTTPS (443)
[MCP clients] ──TLS──► [ACA ingress] ──HTTP──► [container :3000 on 0.0.0.0]
  Authorization:        (managed TLS,            (token pass-through,
  Bearer <ADO token>     public FQDN)             DNS-rebinding protection)
```

- **TLS and the public hostname are provided by the ACA ingress** — there is no
  separate reverse proxy to manage.
- The container listens on `0.0.0.0:3000` so the ingress can reach it. External
  exposure is still controlled by the ingress, the bearer-token requirement, and
  Host-header (DNS rebinding) validation.
- **No Azure DevOps credentials are stored in the container.** The server uses
  token pass-through: every request must carry the caller's Azure DevOps bearer
  token, and each request acts as that user.
- `MCP_ALLOWED_HOSTS` is pinned to the app's own FQDN by the Bicep template, so
  only requests addressed to the real hostname are served.

One deployment serves **one** Azure DevOps organization (`adoOrg`). Deploy
multiple Container Apps for multiple organizations.

## Prerequisites

- Azure CLI (`az`) logged in to the target subscription.
- A resource group.
- A container registry the app can pull from (e.g. Azure Container Registry).

## 1. Build and push the image

Using Azure Container Registry (builds in the cloud, no local Docker needed):

```bash
az acr build \
  --registry <myregistry> \
  --image ado-mcp:1.0.0 \
  --file Dockerfile .
```

Or build locally and push:

```bash
docker build -t <myregistry>.azurecr.io/ado-mcp:1.0.0 .
docker push <myregistry>.azurecr.io/ado-mcp:1.0.0
```

## 2. Deploy

The image is pulled with a **user-assigned managed identity** that the template
grants the `AcrPull` role — no registry username/password is stored anywhere.

```bash
az deployment group create \
  --resource-group <my-rg> \
  --template-file deploy/azure/main.bicep \
  --parameters \
      appName=ado-mcp \
      adoOrg=<your-ado-org> \
      acrName=<myregistry> \
      containerImage=<myregistry>.azurecr.io/ado-mcp:1.0.0
```

> Creating the `AcrPull` role assignment requires the deployer to have
> permission to manage role assignments (e.g. **Owner** or **User Access
> Administrator** on the resource group). If you only have **Contributor**,
> pass `assignAcrPullRole=false` and create the assignment separately:
>
> ```bash
> APP_PID=$(az identity show -g <my-rg> -n ado-mcp-id --query principalId -o tsv)
> az role assignment create --assignee "$APP_PID" --role AcrPull \
>   --scope $(az acr show -n <myregistry> -g <my-rg> --query id -o tsv)
> ```
>
> (Run the deployment once with `assignAcrPullRole=false` to create the identity
> first, assign the role, then deploy again.)

### Reusing a registry in another resource group

If the ACR lives in a different resource group (one you may not fully control),
pass `acrResourceGroup` and assign `AcrPull` out-of-band:

```bash
# 1. Create the app identity up front so it can be granted AcrPull.
az identity create -n ado-mcp-id -g <my-rg> -l northeurope
APP_PID=$(az identity show -n ado-mcp-id -g <my-rg> --query principalId -o tsv)

# 2. A registry admin grants the identity pull access (one time):
az role assignment create --assignee-object-id "$APP_PID" \
  --assignee-principal-type ServicePrincipal --role AcrPull \
  --scope $(az acr show -n <registry> -g <registry-rg> --query id -o tsv)

# 3. Deploy, pointing at the cross-RG registry and skipping the role assignment.
az deployment group create \
  --resource-group <my-rg> \
  --template-file deploy/azure/main.bicep \
  --parameters \
      appName=ado-mcp \
      adoOrg=<your-ado-org> \
      acrName=<registry> \
      acrResourceGroup=<registry-rg> \
      assignAcrPullRole=false \
      containerImage=<registry>.azurecr.io/ado-mcp:1.0.0
```

The deployment outputs the public endpoint:

```bash
az deployment group show -g <my-rg> -n main \
  --query properties.outputs.mcpUrl.value -o tsv
# https://ado-mcp.<hash>.<region>.azurecontainerapps.io/mcp
```

> Using a **custom domain**? Add it to the allow-list by passing your own
> `MCP_ALLOWED_HOSTS` (the template defaults it to the ACA FQDN only).

## 3. Get an Azure DevOps bearer token

Clients authenticate with an Entra ID access token scoped to Azure DevOps:

```bash
az account get-access-token \
  --resource 499b84ac-1321-427f-aa17-267ca6975798 \
  --query accessToken -o tsv
```

> Note: the HTTP transport accepts **bearer tokens** (Entra ID). Personal Access
> Tokens are only supported by the local stdio transport.

## 4. Configure an MCP client

```json
{
  "servers": {
    "ado-prod": {
      "type": "http",
      "url": "https://ado-mcp.<hash>.<region>.azurecontainerapps.io/mcp",
      "headers": {
        "Authorization": "Bearer ${input:ado_token}"
      }
    }
  }
}
```

### Tool presets (a smaller tool list per endpoint)

The full server registers 336 tools, whose schemas cost roughly **83k tokens**
of the model's context on every request. Appending a preset name to the MCP path
serves only the domains that preset covers — same deployment, same sign-in, no
extra resources, and no state kept between requests:

| URL          | Tools | ~Tokens | Covers                                                          |
| ------------ | ----: | ------: | --------------------------------------------------------------- |
| `/mcp`       |   336 |     83k | everything (or whatever `MCP_DOMAINS` sets)                     |
| `/mcp/dev`   |   119 |     34k | repos, pull requests, work items, pipelines, wiki, search       |
| `/mcp/plan`  |   158 |     41k | boards, backlogs, sprints, capacity, dashboards, test plans     |
| `/mcp/ops`   |    95 |     22k | pipelines, releases, agents, service connections, feeds, alerts |
| `/mcp/admin` |    98 |     20k | process customization, identity, licences, access, audit        |

Register the endpoint a client actually needs, e.g.
`https://<app-fqdn>/mcp/dev`. An unknown preset name returns 404. The presets
themselves are defined in [src/shared/presets.ts](../../src/shared/presets.ts).

## OAuth mode (browser sign-in)

By default the server uses **token pass-through** (clients send their own Azure
DevOps bearer token). Set `authMode=oauth` to instead run a full OAuth
authorization server that bridges sign-in to Microsoft Entra ID. Clients that
support dynamic client registration (e.g. Claude) can then connect with **just a
URL** and a browser login — no manually supplied token.

How it works: the server implements DCR + the OAuth metadata/authorize/token
endpoints itself, and delegates the actual user login to Entra using a
pre-registered confidential app. The token handed back is the Entra access token
for Azure DevOps, so every request still acts as the signed-in user.

### One-time Entra app registration (admin)

An Entra admin registers a confidential app (the user can't self-register apps):

1. **App registrations → New registration.** Single tenant is fine.
2. **Redirect URI** (platform **Web**): `https://<app-fqdn>/auth/callback`
   (for the current deployment: `https://ado-mcp.<hash>.northeurope.azurecontainerapps.io/auth/callback`).
3. **API permissions → Add → Azure DevOps → Delegated → `user_impersonation`**, then **Grant admin consent**.
4. **Certificates & secrets → New client secret.** Copy the value.
5. Provide back: **tenant ID**, **client (application) ID**, **client secret**.

### Deploy in OAuth mode

```bash
az deployment group create -g <my-rg> \
  --template-file deploy/azure/main.bicep \
  --parameters \
      appName=ado-mcp adoOrg=<your-ado-org> \
      acrName=<registry> acrResourceGroup=<registry-rg> assignAcrPullRole=false \
      containerImage=<registry>.azurecr.io/ado-mcp:1.0.0 \
      authMode=oauth \
      entraTenantId=<tenant-id> \
      entraClientId=<client-id> \
      entraClientSecret=<client-secret>
```

The template stores the secret as a Container App secret, sets `MCP_PUBLIC_URL`
to the app's HTTPS URL, and **pins the app to a single replica** (OAuth state is
held in memory). Client config is then just the URL:

```json
{ "servers": { "ado": { "type": "http", "url": "https://<app-fqdn>/mcp" } } }
```

> Note: OAuth state (client registrations, authorization codes) is in-memory, so
> the app runs as one always-warm replica (no scale-to-zero). The Entra client
> secret is the only stored credential; rotate it periodically.

## CI/CD (GitHub Actions)

The workflow `.github/workflows/deploy-aca.yml` builds the image on the runner,
pushes it to the registry (`docker push`), and deploys the Bicep template. It
runs on pushes to `main` that touch the app or deployment files, and can also be
triggered manually (`workflow_dispatch`). It authenticates to Azure with **OIDC
federated credentials**, so no cloud passwords are stored in GitHub.

### Required GitHub configuration

Under **Settings → Secrets and variables → Actions**:

| Kind     | Name                    | Example / meaning                                                          |
| -------- | ----------------------- | -------------------------------------------------------------------------- |
| Secret   | `AZURE_CLIENT_ID`       | App registration (client) ID for OIDC                                      |
| Secret   | `AZURE_TENANT_ID`       | Entra tenant ID                                                            |
| Secret   | `AZURE_SUBSCRIPTION_ID` | Target subscription ID                                                     |
| Variable | `AZURE_RESOURCE_GROUP`  | RG to deploy into, e.g. `dev_sanbox`                                       |
| Variable | `ACR_NAME`              | Container Registry name, e.g. `tdsregistry`                                |
| Variable | `ACR_RESOURCE_GROUP`    | RG that holds the registry, e.g. `Kubernetes`                              |
| Variable | `CONTAINER_APP_NAME`    | `ado-mcp`                                                                  |
| Variable | `ADO_ORG`               | Your Azure DevOps organization name                                        |
| Variable | `ENTRA_TENANT_ID`       | Tenant of the OAuth app registration                                       |
| Variable | `ENTRA_CLIENT_ID`       | OAuth confidential app (client) ID                                         |
| Secret   | `ENTRA_CLIENT_SECRET`   | OAuth confidential app client secret                                       |
| Variable | `ALERT_EMAIL`           | _(optional)_ Email for the 401/403 spike alert; unset = no alert resources |

> The workflow deploys with `authMode=oauth`, so the server runs a full OAuth
> authorization server bridging sign-in to Entra ID. Before the first deploy,
> register a confidential Entra app whose **Web** redirect URI is
> `https://<app-fqdn>/auth/callback` (the FQDN is printed in the deploy run
> summary, e.g. `https://ado-mcp.<hash>.<region>.azurecontainerapps.io`), add a
> client secret, and **grant admin consent** for Azure DevOps
> (`499b84ac-1321-427f-aa17-267ca6975798`). Then set `ENTRA_TENANT_ID` /
> `ENTRA_CLIENT_ID` (variables) and `ENTRA_CLIENT_SECRET` (secret) above. MCP
> clients (e.g. Claude) connect with just the `…/mcp` URL — they self-register
> via Dynamic Client Registration, so no client ID/secret is entered in the
> client.

### One-time OIDC setup

```bash
# 1. Create an app registration (or reuse a service principal).
APP_ID=$(az ad app create --display-name "ado-mcp-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2. Federated credential matching this repo's "production" environment.
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-prod",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:DL-Solution/azure-devops-mcp:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# 3. Grant it rights.
SUB=$(az account show --query id -o tsv)
# Contributor on the deployment RG: create the env/app/identity and deploy.
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB/resourceGroups/<deploy-rg>"
# AcrPush on the registry: push the built image (data-plane push/pull only).
az role assignment create --assignee "$APP_ID" --role AcrPush \
  --scope $(az acr show -n <registry> -g <registry-rg> --query id -o tsv)
```

> The workflow deploys with `assignAcrPullRole=false`, so the CI identity does
> **not** need rights to manage role assignments. Grant the app identity
> (`ado-mcp-id`) `AcrPull` on the registry separately (see "Reusing a registry
> in another resource group" above). If instead you want the template to assign
> `AcrPull` itself, also give the CI identity **Role Based Access Control
> Administrator** on the registry and deploy with `assignAcrPullRole=true`.

Then set `AZURE_CLIENT_ID=$APP_ID`, `AZURE_TENANT_ID`, and
`AZURE_SUBSCRIPTION_ID` as repository secrets.

> The workflow targets a GitHub **Environment** named `production`. Add
> required reviewers to that environment (Settings → Environments) if you want
> a manual approval gate before each production deploy. The federated
> credential `subject` above must match the environment name.

## OAuth state storage

In OAuth mode the server is itself an authorization server: it holds the client
registrations created via DCR, the authorizations waiting on the Entra login,
and the codes it issues to clients. Keeping that in process memory means every
deploy silently invalidates it — clients then fail to refresh and report the
server as unreachable — and it pins the app to a single replica.

Set `oauthStateStorageAccountName` (workflow variable `OAUTH_STATE_STORAGE_ACCOUNT`)
and the template creates a storage account with **shared-key access disabled**
plus the `oauthstate` table. The app reads and writes it with its managed
identity (`OAUTH_STATE_TABLE_ENDPOINT` and `AZURE_CLIENT_ID` are injected), so no
storage key exists anywhere. With the state shared, `maxReplicas` applies in
OAuth mode too.

The identity needs **Storage Table Data Contributor** on that account. The
template creates the assignment unless `assignTableRole=false` (the CI workflow
passes false, since the deploy identity is only Contributor). To grant it
out-of-band:

```bash
ACCOUNT_ID=$(az storage account show -g <my-rg> -n <account> --query id -o tsv)
APP_PID=$(az identity show -g <my-rg> -n ado-mcp-id --query principalId -o tsv)
az role assignment create --assignee-object-id "$APP_PID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Table Data Contributor" --scope "$ACCOUNT_ID"
```

Leave the parameter empty to keep the old in-memory behaviour; the server logs a
warning at startup when it does.

## Configuration reference

The image is configured entirely through environment variables (see
`deploy/docker-entrypoint.sh`):

| Variable              | Default   | Description                                                 |
| --------------------- | --------- | ----------------------------------------------------------- |
| `AZURE_DEVOPS_ORG`    | —         | **Required.** Azure DevOps organization name.               |
| `MCP_TRANSPORT`       | `http`    | Transport (`stdio`/`http`).                                 |
| `MCP_HOST`            | `0.0.0.0` | Bind interface (keep `0.0.0.0` in a container).             |
| `MCP_PORT`            | `3000`    | Listen port (match the ingress target port).                |
| `MCP_ALLOWED_HOSTS`   | app FQDN  | Space-separated Host allow-list (DNS rebinding protection). |
| `MCP_ALLOWED_ORIGINS` | _(none)_  | Space-separated browser Origin allow-list.                  |
| `MCP_DOMAINS`         | `all`     | Space-separated tool domains to enable.                     |

## Security notes

- The image is pulled via a **user-assigned managed identity** with the
  `AcrPull` role — no registry password is stored. You can keep the ACR admin
  user **disabled** (`az acr update -n <myregistry> --admin-enabled false`).
- Keep ingress `allowInsecure: false` (HTTP is redirected to HTTPS).
- The server never logs tokens or request bodies.
- The template defaults to **scale-to-zero** (`minReplicas: 0`) for lowest cost:
  with no traffic there are no running replicas. The first request after an idle
  period pays a cold-start delay (a few seconds). Set `minReplicas: 1` for an
  always-warm instance (instant response, higher cost).
- Restrict who can reach the ingress with ACA IP restrictions or a private
  environment if you do not need public access.
- **Alert on failed-auth spikes.** Pass `alertEmail` to create an Azure Monitor
  action group + metric alert that emails you when 401/403 responses spike
  (credential brute force, probing, or a broken client). It uses the ingress
  `Requests` metric split by the `statusCode` dimension, so no application change
  is needed; tune `authFailureAlertThreshold` (default 25 in a 5-minute window)
  to your normal traffic. Both resources are created **only** when `alertEmail`
  is set, so the default deployment adds no monitoring cost. In CI this is the
  optional `ALERT_EMAIL` variable.

  ```bash
  az deployment group create -g <my-rg> \
    --template-file deploy/azure/main.bicep \
    --parameters \
        appName=ado-mcp adoOrg=<your-ado-org> \
        acrName=<registry> containerImage=<registry>.azurecr.io/ado-mcp:1.0.0 \
        alertEmail="secops@example.com" authFailureAlertThreshold=25
  ```

  > Console and system logs already flow to the Log Analytics workspace created
  > by this template (via the managed environment), so you can also write your
  > own KQL queries/alerts over `ContainerAppConsoleLogs_CL` and
  > `ContainerAppSystemLogs_CL` if you want log-based rules in addition to the
  > metric alert.
