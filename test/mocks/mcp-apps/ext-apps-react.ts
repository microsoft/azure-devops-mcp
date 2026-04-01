// Mock for @modelcontextprotocol/ext-apps/react
// Provides stub implementations for Jest/jsdom testing.

import React from "react";

export function useApp(options: { appInfo: any; capabilities: any; onAppCreated?: (app: any) => void }) {
  const appRef = React.useRef<any>(null);

  if (!appRef.current) {
    const mockApp: any = {
      getHostContext: () => null,
      callServerTool: jest.fn().mockResolvedValue({ content: [], isError: false }),
      openLink: jest.fn().mockResolvedValue(undefined),
      requestTeardown: jest.fn().mockResolvedValue(undefined),
      onhostcontextchanged: null,
      ontoolinput: null,
      ontoolresult: null,
      ontoolcancelled: null,
      onerror: null,
      onteardown: null,
    };
    appRef.current = mockApp;

    if (options.onAppCreated) {
      options.onAppCreated(mockApp);
    }
  }

  return { app: appRef.current, error: null };
}

export function useHostStyles(_app: any) {
  // no-op in tests
}

export function useDocumentTheme(): "light" | "dark" {
  return "dark";
}
