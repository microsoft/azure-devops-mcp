// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureApprovalsTools, APPROVALS_TOOLS } from "../../../src/tools/approvals";

describe("configureApprovalsTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" } as unknown as WebApi) as () => Promise<WebApi>;
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configureApprovalsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("registers all three tools", () => {
    configureApprovalsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const names = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining([APPROVALS_TOOLS.list, APPROVALS_TOOLS.get, APPROVALS_TOOLS.update]));
  });

  describe("approvals_list", () => {
    it("queries the project-scoped approvals endpoint", async () => {
      const handler = getHandler(APPROVALS_TOOLS.list);
      mockFetch.mockResolvedValue(ok('{"count":0,"value":[]}'));

      const result = await handler({ project: "Contoso" });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://dev.azure.com/contoso/Contoso/_apis/pipelines/approvals?api-version=7.2-preview.2");
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toBe("Bearer fake-token");
      expect(result.content[0].text).toContain("count");
    });

    it("passes the optional filters through as query parameters", async () => {
      const handler = getHandler(APPROVALS_TOOLS.list);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ project: "Contoso", approvalIds: ["a1", "a2"], assignedTo: ["ada@contoso.com"], state: "pending", top: 5, expand: "steps" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("approvalIds=a1%2Ca2");
      expect(url).toContain("assignedTo=ada%40contoso.com");
      expect(url).toContain("state=pending");
      expect(url).toContain("top=5");
      expect(url).toContain("%24expand=steps");
    });

    it("surfaces a failed request as an error result", async () => {
      const handler = getHandler(APPROVALS_TOOLS.list);
      mockFetch.mockResolvedValue(ok("forbidden", 403));

      const result = await handler({ project: "Contoso" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to list approvals (403)");
    });
  });

  describe("approvals_get", () => {
    it("gets a single approval by id", async () => {
      const handler = getHandler(APPROVALS_TOOLS.get);
      mockFetch.mockResolvedValue(ok('{"id":"ee14f612","status":"pending"}'));

      const result = await handler({ project: "Contoso", approvalId: "ee14f612" });

      expect(mockFetch.mock.calls[0][0]).toBe("https://dev.azure.com/contoso/Contoso/_apis/pipelines/approvals/ee14f612?api-version=7.2-preview.2");
      expect(result.content[0].text).toContain("pending");
    });

    it("reports a missing approval as an error", async () => {
      const handler = getHandler(APPROVALS_TOOLS.get);
      mockFetch.mockResolvedValue(ok("", 404));

      const result = await handler({ project: "Contoso", approvalId: "missing" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("approvals_update", () => {
    it("PATCHes an array with the approval decision", async () => {
      const handler = getHandler(APPROVALS_TOOLS.update);
      mockFetch.mockResolvedValue(ok('{"count":1,"value":[{"status":"approved"}]}'));

      const result = await handler({ project: "Contoso", approvalId: "aab27959", status: "approved", comment: "Approving" });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://dev.azure.com/contoso/Contoso/_apis/pipelines/approvals?api-version=7.2-preview.2");
      expect(init.method).toBe("PATCH");
      expect(init.headers["Content-Type"]).toBe("application/json; charset=utf-8");
      expect(JSON.parse(init.body)).toEqual([{ approvalId: "aab27959", status: "approved", comment: "Approving" }]);
      expect(result.content[0].text).toContain("approved");
    });

    it("wraps reassignTo as an identity reference and keeps deferredTo", async () => {
      const handler = getHandler(APPROVALS_TOOLS.update);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ project: "Contoso", approvalId: "a1", status: "deferred", deferredTo: "2026-10-01T00:00:00Z", reassignTo: "user-guid" });

      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual([{ approvalId: "a1", status: "deferred", deferredTo: "2026-10-01T00:00:00Z", reassignTo: { id: "user-guid" } }]);
    });

    it("surfaces a rejected update as an error result", async () => {
      const handler = getHandler(APPROVALS_TOOLS.update);
      mockFetch.mockResolvedValue(ok("not an approver", 401));

      const result = await handler({ project: "Contoso", approvalId: "a1", status: "approved" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to update approval (401)");
    });
  });
});
