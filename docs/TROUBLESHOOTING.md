# Troubleshooting

To help you troubleshoot and debug issues, try adding the `LOG_LEVEL` to your `mcp.json`

Example

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "mcp-server-azuredevops",
      "args": ["${input:ado_org}"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Common MCP Issues

1. **Clearing VS Code Cache**
   If you encounter issues with stale configurations, reload the VS Code window:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
   - Select `Developer: Reload Window`.

   If the issue persists, you can take a more aggressive approach by clearing the following folders:
   - `%APPDATA%\Code\Cache`
   - `%APPDATA%\Code\CachedData`
   - `%APPDATA%\Code\User\workspaceStorage`
   - `%APPDATA%\Code\logs`

   Clear Node Modules Cache
   - `npm cache clean --force`

2. **Server Not Showing Up in Agent Mode**
   Ensure that the `mcp.json` file is correctly configured and includes the appropriate server definitions. Restart your MCP server and reload the VS Code window.

3. **Tools Not Loading in Agent Mode**
   If tools do not appear, click "Add Context" in Agent Mode and ensure all tools starting with `ado_` are selected.

4. **Too Many Tools Selected (Over 128 Limit)**
   Some tools have a default maximum limot of 128 tools. If you exceed this limit, ensure you do not have multiple MCP Servers running. Check both your project's `mcp.json` and your VS Code `settings.json` to confirm that the MCP Server is configured in only one location—not both.

   You can also use [Domains](../README.md?tab=readme-ov-file#-using-domains) as a way to limit the number of tools you load for the Azure DevOps MCP Server.

## Project-Specific Issues

1. **npm Authentication Issues for Remote Access**
   If you encounter authentication errors:
   - Verify your npm configuration:

     ```pwsh
     npm config get registry
     ```

     It should point to: `https://registry.npmjs.org/`

2. **Dependency Installation Errors**
   If `npm install` fails, verify that you are using Node.js version 20 or higher. You can check your Node.js version with:

   ```pwsh
   node -v
   ```

## Authentication Issues

### Token Authentication via Environment Variables

For automated scenarios or when you want to use a token stored in an environment variable, you can use the `envvar` authentication type:

1. **Set your token in the ADO_MCP_AUTH_TOKEN environment variable:**

   ```bash
   export ADO_MCP_AUTH_TOKEN="your-azure-devops-token"
   ```

2. **Use the envvar authentication type:**

   ```bash
   npx @azure-devops/mcp myorg --authentication envvar
   ```

3. **For MCP configuration files, update your `.vscode/mcp.json`:**
   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps organization name (e.g. 'contoso')"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--authentication", "envvar"]
       }
     }
   }
   ```

### GitHub Codespaces

Due to limitations of the environment default OAuth option is not available in Codespace.
Make sure you authenticate via

```sh
az login
```

in the terminal before using MCP tools.

And in case there are authorization/access errors when using the tools please check the [Multi-Tenant Authentication Problems guide](#multi-tenant-authentication-problems-when-using-azcli)

### OAuth

Recent switch to OAuth flow is supposed to simplify authentication against ADO APIs and remove additional software dependency.

It is however possible that strict tenant admin policies prevent users from successfully logging in using OAuth flow. In that case consider falling back to AZ CLI.

#### Symptoms

Upon ADO tool execution browser opens a tab/window and after login attempt an error text is displayed:

```
Error occurred: ...
```

#### Solution

Try using Azure login context instead:

1. Install [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) and **log in**:

   ```sh
   az login
   ```

2. **Configure the MCP server** with the azcli authentication option by updating your `.vscode/mcp.json`.

   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps organization name (e.g. 'contoso')"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--authentication", "azcli"]
       }
     }
   }
   ```

3. **Restart VS Code** completely to ensure the MCP server picks up the new configuration.

### Multi-Tenant Authentication Problems when using azcli

If you encounter authentication errors like `TF400813: The user 'xxx' is not authorized to access this resource`, you may be experiencing multi-tenant authentication issues.

#### Symptoms

- Azure CLI (`az devops project list`) works fine
- MCP server fails with authorization errors
- You have access to multiple Azure tenants

#### Root Cause

The MCP server may be authenticating with a different tenant than your Azure DevOps organization, especially when you have access to multiple Azure tenants. The MCP server may also be using the Azure Devops Org tenant when the user belongs to a different tenant and is added as a guest user in the Azure DevOps organization.

#### Solution

1. **Identify the correct tenant ID** for your Azure DevOps organization:

   ```pwsh
   az account list
   ```

   Look for the `tenantId` field in the output for the desired tenant (for guest accounts this will be the tenant of your organization and may be different than the Azure Devops Organization tenant).

2. **Configure the MCP server with the tenant ID** by updating your `.vscode/mcp.json`.

   🧨 Installation from Public Feed Configuration:

   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps organization name (e.g. 'contoso')"
       },
       {
         "id": "ado_tenant",
         "type": "promptString",
         "description": "Azure tenant ID (required for multi-tenant scenarios)"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--authentication", "azcli", "--tenant", "${input:ado_tenant}"]
       }
     }
   }
   ```

   🛠️ Installation from Source Configuration:

   ```json
   {
     "inputs": [
       {
         "id": "ado_org",
         "type": "promptString",
         "description": "Azure DevOps organization name (e.g. 'contoso')"
       },
       {
         "id": "ado_tenant",
         "type": "promptString",
         "description": "Azure tenant ID (required for multi-tenant scenarios)"
       }
     ],
     "servers": {
       "ado": {
         "type": "stdio",
         "command": "mcp-server-azuredevops",
         "args": ["${input:ado_org}", "--tenant", "${input:ado_tenant}"]
       }
     }
   }
   ```

3. **Restart VS Code** completely to ensure the MCP server picks up the new configuration.

4. **When prompted**, enter:
   - Your Azure DevOps organization name
   - The tenant ID from step 1

## Common Errors

1. **Incorrect Organization Name Error**

   ```
   Error fetching projects: Failed to find api location for area: Location id: e81700f7-3be2-46de-8624-2eb35882fcaa
   ```

   **Cause:** This occurs when the Azure DevOps organization name is incorrect or doesn't exist.

   **Solution:** Verify that:
   - The organization name is spelled correctly (case-sensitive)
   - The organization exists and you have access to it
   - You're using just the organization name, not the full URL (e.g., use `contoso` not `https://dev.azure.com/contoso`)
