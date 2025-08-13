# Troubleshooting

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
   VS Code supports a maximum of 128 tools. If you exceed this limit, ensure you do not have multiple MCP Servers running. Check both your project's `mcp.json` and your VS Code `settings.json` to confirm that the MCP Server is configured in only one location—not both.

## Project-Specific Issues

1. **npm Authentication Issues for Remote Access**
   If you encounter authentication errors:
   - Ensure you are logged in to Azure DevOps using the `az` CLI:

     ```pwsh
     az login
     ```

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

### Multi-Tenant Authentication Problems

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
         "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--tenant", "${input:ado_tenant}"]
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

### Dev Container and WSL Authentication Issues

If the tenant configuration solution above doesn't resolve your authentication issues, and you're working in a **Dev Container** or **WSL (Windows Subsystem for Linux)** environment, the root cause may be different.

#### Dev Container/WSL Symptoms

- Same authorization errors as above (`TF400813: The user 'xxx' is not authorized to access this resource`)
- Tenant ID configuration didn't resolve the issue
- You're using VS Code with Dev Containers or WSL
- MCP server is configured in User Settings (global) rather than workspace settings

#### Dev Container/WSL Root Cause

When MCP servers are configured in **User Settings** (global configuration), they inherit the environment context from the **host machine**, including `az login` authentication settings. In Dev Container or WSL scenarios, this means:

- The MCP server uses the host machine's Azure authentication
- Any `az login` performed inside the Dev Container or WSL environment is ignored
- There may be a mismatch between the authentication context the MCP server expects and your development environment

#### Dev Container/WSL Solution

1. **Verify your MCP configuration location**:
   - Check if your MCP server is configured in User Settings (global) vs Workspace Settings
   - User Settings: Run `MCP: Open User Configuration` from Command Palette
   - Workspace Settings: Check for `.vscode/mcp.json` in your project

2. **For User Settings (Global) MCP configuration**:
   - Ensure you are logged into Azure from the **host machine** (not inside the Dev Container/WSL)
   - Run `az login` on the host Windows machine (outside of WSL/Dev Container)
   - Do NOT run `az login` inside the Dev Container or WSL environment
   - Restart VS Code completely

3. **Alternative: Use Workspace Settings instead**:
   - Move your MCP server configuration from User Settings to Workspace Settings
   - Create/update `.vscode/mcp.json` in your project
   - This allows the MCP server to use the authentication context from within the Dev Container/WSL environment

4. **For Dev Containers specifically**:
   - Consider configuring MCP servers directly in your `devcontainer.json` file using the `customizations.vscode.mcp` section
   - This ensures the MCP server runs within the containerized environment with the correct context
