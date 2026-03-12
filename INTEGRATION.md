# Integration notes for Remote MCP (HTTP) entrypoint

Apply these changes to the existing `microsoft/azure-devops-mcp` repo so that `npm run build` produces `dist/http.js` and you can run the HTTP server.

## 1. package.json

- **Add dependency:** `"express": "^5.2.0"` (or compatible 5.x) in `dependencies`.
- **Add script:** `"start:http": "node dist/http.js"` in `scripts`.
- **Optional bin entry:** add `"mcp-server-azuredevops-http": "dist/http.js"` under `bin` if you want a separate CLI name for the HTTP server.

Example snippet:

```json
"scripts": {
  "start:http": "node dist/http.js",
  ...
},
"dependencies": {
  "express": "^5.2.0",
  ...
}
```

## 2. TypeScript / build

- `tsconfig.json` already includes `"./src/**/*"` and `outDir: "dist"`, so `npm run build` will compile `src/http.ts` to `dist/http.js`. No tsconfig change required.

## 3. New files added by this implementation

- `src/auth/easyauth.ts` – Easy Auth principal parsing and middleware
- `src/http.ts` – HTTP entrypoint with Streamable HTTP transport
- `Dockerfile` – Container image for Azure Container Apps
- (Optional) Test: `src/auth/__tests__/easyauth.test.ts`

## 4. README: Remote Deployment section

Add the following section to the main README (see REMOTE_DEPLOYMENT_README_SECTION.md for the exact block).
