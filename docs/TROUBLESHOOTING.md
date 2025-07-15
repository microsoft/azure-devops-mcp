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
