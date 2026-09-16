// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureServiceEndpointTools, SERVICE_ENDPOINT_TOOLS } from "../../../src/tools/service-endpoint";

describe("configureServiceEndpointTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" } as unknown as WebApi);
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configureServiceEndpointTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("lists endpoints scoped to the project on the org host", async () => {
    const handler = getHandler(SERVICE_ENDPOINT_TOOLS.list_service_endpoints);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({ project: "MyProject", type: "azurerm" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://dev.azure.com/contoso/MyProject/_apis/serviceendpoint/endpoints?");
    expect(url).toContain("type=azurerm");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer fake-token");
  });

  it("returns 404 as an error for get", async () => {
    const handler = getHandler(SERVICE_ENDPOINT_TOOLS.get_service_endpoint);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ project: "MyProject", endpointId: "ep1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("creates an endpoint at the org level passing the body through", async () => {
    const handler = getHandler(SERVICE_ENDPOINT_TOOLS.create_service_endpoint);
    mockFetch.mockResolvedValue(ok('{"id":"new"}'));

    await handler({ endpoint: { name: "conn", type: "generic", url: "https://x" } });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/serviceendpoint/endpoints?api-version=7.1-preview.4");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "conn", type: "generic", url: "https://x" });
  });

  it("deletes an endpoint with projectIds query", async () => {
    const handler = getHandler(SERVICE_ENDPOINT_TOOLS.delete_service_endpoint);
    mockFetch.mockResolvedValue(ok(""));

    const result = await handler({ endpointId: "ep1", projectIds: ["p1", "p2"] });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("_apis/serviceendpoint/endpoints/ep1?");
    expect(url).toContain("projectIds=p1%2Cp2");
    expect(init.method).toBe("DELETE");
    expect(result.content[0].text).toContain("deleted");
  });

  describe("error paths", () => {
    it("list_service_endpoints surfaces failures", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.list_service_endpoints);
      mockFetch.mockResolvedValue(ok("nope", 403));

      const result = await handler({ project: "Contoso" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
    });

    it("get_service_endpoint surfaces failures", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.get_service_endpoint);
      mockFetch.mockResolvedValue(ok("boom", 500));

      const result = await handler({ project: "Contoso", endpointId: "ep-1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("500");
    });

    it("create_service_endpoint surfaces failures", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.create_service_endpoint);
      mockFetch.mockResolvedValue(ok("bad request", 400));

      const result = await handler({ endpoint: { name: "svc" } });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("400");
    });

    it("delete_service_endpoint names the projects it removed the endpoint from", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.delete_service_endpoint);
      mockFetch.mockResolvedValue(ok("", 204));

      const result = await handler({ endpointId: "ep-1", projectIds: ["p1", "p2"] });

      expect(mockFetch.mock.calls[0][0]).toContain("projectIds=p1%2Cp2");
      expect(result.content[0].text).toContain("p1, p2");
    });

    it("delete_service_endpoint surfaces failures", async () => {
      const handler = getHandler(SERVICE_ENDPOINT_TOOLS.delete_service_endpoint);
      mockFetch.mockResolvedValue(ok("nope", 403));

      const result = await handler({ endpointId: "ep-1", projectIds: ["p1"] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
    });
  });
});
