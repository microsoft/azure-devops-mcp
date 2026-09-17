// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureFeatureManagementTools, FEATURE_MANAGEMENT_TOOLS, featureStatePath } from "../../../src/tools/feature-management";
import { createToolServer } from "../../mocks/tool-server";

describe("featureStatePath", () => {
  it("uses the scoped route when a named scope is provided", () => {
    expect(featureStatePath("ms.feed.feed", "host", "project", "proj-1")).toBe("featuremanagement/featurestatesforscope/host/project/proj-1/ms.feed.feed");
  });

  it("uses the host route when no scope is provided", () => {
    expect(featureStatePath("ms.feed.feed", "me")).toBe("featuremanagement/featurestates/me/ms.feed.feed");
  });
});

describe("configureFeatureManagementTools", () => {
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
    configureFeatureManagementTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("gets a feature state for a project scope", async () => {
    const handler = getHandler(FEATURE_MANAGEMENT_TOOLS.get_feature_state);
    mockFetch.mockResolvedValue(ok('{"state":"enabled"}'));

    await handler({ featureId: "ms.feed.feed", scopeName: "project", scopeValue: "proj-1" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/featuremanagement/featurestatesforscope/host/project/proj-1/ms.feed.feed?api-version=7.1-preview.1");
    expect(init.method).toBe("GET");
  });

  it("returns 404 as an error", async () => {
    const handler = getHandler(FEATURE_MANAGEMENT_TOOLS.get_feature_state);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ featureId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("sets a feature state with the encoded enabled value and scope body", async () => {
    const handler = getHandler(FEATURE_MANAGEMENT_TOOLS.set_feature_state);
    mockFetch.mockResolvedValue(ok('{"state":2}'));

    await handler({ featureId: "ms.feed.feed", state: "enabled", scopeName: "project", scopeValue: "proj-1" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://dev.azure.com/contoso/_apis/featuremanagement/featurestatesforscope/host/project/proj-1/ms.feed.feed?api-version=7.1-preview.1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      featureId: "ms.feed.feed",
      state: 2,
      scope: { settingScope: "project", userScoped: false },
    });
  });

  it("requires scopeValue when scopeName is given", async () => {
    const handler = getHandler(FEATURE_MANAGEMENT_TOOLS.set_feature_state);

    const result = await handler({ featureId: "f", state: "disabled", scopeName: "project" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("scopeValue is required");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
