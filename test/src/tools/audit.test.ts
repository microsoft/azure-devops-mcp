// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureAuditTools, AUDIT_TOOLS } from "../../../src/tools/audit";
import { createToolServer } from "../../mocks/tool-server";

describe("configureAuditTools", () => {
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
    configureAuditTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("queries the audit log on the auditservice host with a time range", async () => {
    const handler = getHandler(AUDIT_TOOLS.query_log);
    mockFetch.mockResolvedValue(ok('{"decoratedAuditLogEntries":[]}'));

    await handler({ startTime: "2026-01-01T00:00:00Z", endTime: "2026-02-01T00:00:00Z", batchSize: 100 });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://auditservice.dev.azure.com/contoso/_apis/audit/auditlog?");
    expect(url).toContain("startTime=2026-01-01T00%3A00%3A00Z");
    expect(url).toContain("batchSize=100");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer fake-token");
  });

  it("lists audit actions", async () => {
    const handler = getHandler(AUDIT_TOOLS.list_actions);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({});

    expect(mockFetch.mock.calls[0][0]).toBe("https://auditservice.dev.azure.com/contoso/_apis/audit/actions?api-version=7.1-preview.1");
  });

  it("surfaces errors", async () => {
    const handler = getHandler(AUDIT_TOOLS.query_log);
    mockFetch.mockResolvedValue(ok("nope", 403));

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error querying audit log");
  });
});
