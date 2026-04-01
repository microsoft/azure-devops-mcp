// Mock for @modelcontextprotocol/ext-apps/server
// Provides stub implementations for Jest CommonJS compatibility.

export const RESOURCE_MIME_TYPE = "text/html";
export const RESOURCE_URI_META_KEY = "resourceUri";

export function registerAppTool(server: any, name: string, config: any, handler: any) {
  // Delegate to server.registerTool so tests can find it
  server.registerTool(name, config, handler);
}

export function registerAppResource(server: any, name: string, uri: string, config: any, readCallback: any) {
  // Delegate to server.resource so tests can verify resource registration
  server.resource(name, uri, config, readCallback);
}
