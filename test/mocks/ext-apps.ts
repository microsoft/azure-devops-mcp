// Mock for @modelcontextprotocol/ext-apps
// Provides type stubs for Jest testing.

export interface App {
  getHostContext: () => any;
  callServerTool: (params: any) => Promise<any>;
  openLink: (params: any) => Promise<void>;
  requestTeardown: () => Promise<void>;
  onhostcontextchanged: ((ctx: any) => void) | null;
  ontoolinput: (() => void) | null;
  ontoolresult: ((result: any) => void) | null;
  ontoolcancelled: (() => void) | null;
  onerror: ((error: any) => void) | null;
  onteardown: (() => Promise<any>) | null;
}

export function applyDocumentTheme(_theme: "light" | "dark"): void {
  // no-op in tests
}
