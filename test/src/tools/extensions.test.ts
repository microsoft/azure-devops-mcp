// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureExtensionsTools, EXTENSIONS_TOOLS } from "../../../src/tools/extensions";
import { createToolServer } from "../../mocks/tool-server";

describe("configureExtensionsTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" } as unknown as WebApi);
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configureExtensionsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("lists installed extensions on the extmgmt host", async () => {
    const handler = getHandler(EXTENSIONS_TOOLS.list_installed);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({ includeDisabledExtensions: true });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://extmgmt.dev.azure.com/contoso/_apis/extensionmanagement/installedextensions?");
    expect(url).toContain("includeDisabledExtensions=true");
    expect(init.method).toBe("GET");
  });

  it("gets an installed extension by publisher and name", async () => {
    const handler = getHandler(EXTENSIONS_TOOLS.get_installed);
    mockFetch.mockResolvedValue(ok('{"extensionId":"x"}'));

    await handler({ publisherName: "ms", extensionName: "vss-code-search" });

    expect(mockFetch.mock.calls[0][0]).toBe("https://extmgmt.dev.azure.com/contoso/_apis/extensionmanagement/installedextensionsbyname/ms/vss-code-search?api-version=7.1-preview.1");
  });

  it("returns 404 as an error", async () => {
    const handler = getHandler(EXTENSIONS_TOOLS.get_installed);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ publisherName: "ms", extensionName: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
