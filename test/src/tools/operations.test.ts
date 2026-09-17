// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureOperationsTools, OPERATIONS_TOOLS } from "../../../src/tools/operations";
import { createToolServer } from "../../mocks/tool-server";

describe("configureOperationsTools", () => {
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
    configureOperationsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("gets an operation by id", async () => {
    const handler = getHandler(OPERATIONS_TOOLS.get_operation);
    mockFetch.mockResolvedValue(ok('{"status":"succeeded"}'));

    const result = await handler({ operationId: "op-1" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/operations/op-1?api-version=7.1");
    expect(init.method).toBe("GET");
    expect(result.content[0].text).toContain("succeeded");
  });

  it("includes pluginId when provided", async () => {
    const handler = getHandler(OPERATIONS_TOOLS.get_operation);
    mockFetch.mockResolvedValue(ok("{}"));

    await handler({ operationId: "op-1", pluginId: "plug" });

    expect(mockFetch.mock.calls[0][0]).toContain("pluginId=plug");
  });

  it("returns 404 as an error", async () => {
    const handler = getHandler(OPERATIONS_TOOLS.get_operation);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ operationId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
