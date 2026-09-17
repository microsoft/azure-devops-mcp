// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureServiceHooksTools, SERVICE_HOOKS_TOOLS } from "../../../src/tools/service-hooks";
import { createToolServer } from "../../mocks/tool-server";

describe("configureServiceHooksTools", () => {
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
    configureServiceHooksTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("lists subscriptions with optional filters", async () => {
    const handler = getHandler(SERVICE_HOOKS_TOOLS.list_subscriptions);
    mockFetch.mockResolvedValue(ok('{"value":[]}'));

    await handler({ publisherId: "tfs", eventType: "git.push" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://dev.azure.com/contoso/_apis/hooks/subscriptions?");
    expect(url).toContain("publisherId=tfs");
    expect(url).toContain("eventType=git.push");
    expect(init.method).toBe("GET");
  });

  it("returns 404 as an error for get", async () => {
    const handler = getHandler(SERVICE_HOOKS_TOOLS.get_subscription);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ subscriptionId: "sub1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("creates a subscription passing the body through", async () => {
    const handler = getHandler(SERVICE_HOOKS_TOOLS.create_subscription);
    mockFetch.mockResolvedValue(ok('{"id":"sub-new"}'));

    const subscription = { publisherId: "tfs", eventType: "git.push", consumerId: "webHooks", consumerActionId: "httpRequest", consumerInputs: { url: "https://hook" } };
    await handler({ subscription });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/hooks/subscriptions?api-version=7.1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(subscription);
  });

  it("deletes a subscription", async () => {
    const handler = getHandler(SERVICE_HOOKS_TOOLS.delete_subscription);
    mockFetch.mockResolvedValue(ok(""));

    const result = await handler({ subscriptionId: "sub1" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/hooks/subscriptions/sub1?api-version=7.1");
    expect(init.method).toBe("DELETE");
    expect(result.content[0].text).toContain("deleted");
  });

  describe("error paths", () => {
    it("list_subscriptions surfaces failures", async () => {
      const handler = getHandler(SERVICE_HOOKS_TOOLS.list_subscriptions);
      mockFetch.mockResolvedValue(ok("nope", 403));

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
    });

    it("get_subscription surfaces failures", async () => {
      const handler = getHandler(SERVICE_HOOKS_TOOLS.get_subscription);
      mockFetch.mockResolvedValue(ok("boom", 500));

      const result = await handler({ subscriptionId: "sub-1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("500");
    });

    it("create_subscription posts the subscription definition through untouched", async () => {
      const handler = getHandler(SERVICE_HOOKS_TOOLS.create_subscription);
      mockFetch.mockResolvedValue(ok('{"id":"sub-2"}'));

      const subscription = { publisherId: "tfs", eventType: "workitem.created", consumerId: "webHooks", consumerActionId: "httpRequest", consumerInputs: { url: "https://example.invalid/hook" } };
      const result = await handler({ subscription });

      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(subscription);
      expect(result.content[0].text).toContain("sub-2");
    });

    it("create_subscription surfaces failures", async () => {
      const handler = getHandler(SERVICE_HOOKS_TOOLS.create_subscription);
      mockFetch.mockResolvedValue(ok("bad request", 400));

      const result = await handler({ subscription: {} });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("400");
    });

    it("delete_subscription surfaces failures", async () => {
      const handler = getHandler(SERVICE_HOOKS_TOOLS.delete_subscription);
      mockFetch.mockResolvedValue(ok("nope", 404));

      const result = await handler({ subscriptionId: "sub-1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("404");
    });
  });
});
