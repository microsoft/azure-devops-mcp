// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureArtifactsTools, ARTIFACTS_TOOLS } from "../../../src/tools/artifacts";
import { createToolServer } from "../../mocks/tool-server";

describe("configureArtifactsTools", () => {
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
    configureArtifactsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("lists org-scoped feeds on the feeds host", async () => {
    const handler = getHandler(ARTIFACTS_TOOLS.list_feeds);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({});

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds?");
    expect(init.method).toBe("GET");
  });

  it("lists project-scoped feeds by prefixing the project", async () => {
    const handler = getHandler(ARTIFACTS_TOOLS.list_feeds);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({ project: "MyProject" });

    expect(mockFetch.mock.calls[0][0]).toContain("https://feeds.dev.azure.com/contoso/MyProject/_apis/packaging/feeds?");
  });

  it("creates a feed with name and description", async () => {
    const handler = getHandler(ARTIFACTS_TOOLS.create_feed);
    mockFetch.mockResolvedValue(ok('{"id":"feed-new"}'));

    await handler({ name: "my-feed", description: "desc" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds?api-version=7.1-preview.1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "my-feed", description: "desc" });
  });

  it("lists packages with protocol filter and $top", async () => {
    const handler = getHandler(ARTIFACTS_TOOLS.list_packages);
    mockFetch.mockResolvedValue(ok('{"value":[]}'));

    await handler({ feedId: "my-feed", protocolType: "npm", top: 10 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/_apis/packaging/feeds/my-feed/packages?");
    expect(url).toContain("protocolType=npm");
    expect(url).toContain("%24top=10");
  });

  describe("get_feed", () => {
    it("fetches an org-scoped feed", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.get_feed);
      mockFetch.mockResolvedValue(ok('{"name":"tools"}'));

      const result = await handler({ feedId: "tools" });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://feeds.dev.azure.com/contoso/_apis/packaging/feeds/tools?api-version=7.1-preview.1");
      expect(init.method).toBe("GET");
      expect(result.content[0].text).toContain("tools");
    });

    it("prefixes the project for a project-scoped feed", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.get_feed);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ feedId: "tools", project: "Contoso" });

      expect(mockFetch.mock.calls[0][0]).toBe("https://feeds.dev.azure.com/contoso/Contoso/_apis/packaging/feeds/tools?api-version=7.1-preview.1");
    });

    it("reports a missing feed as an error", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.get_feed);
      mockFetch.mockResolvedValue(ok("", 404));

      const result = await handler({ feedId: "nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("surfaces a non-404 failure as an error result", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.get_feed);
      mockFetch.mockResolvedValue(ok("boom", 500));

      const result = await handler({ feedId: "tools" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to get feed (500)");
    });
  });

  describe("error paths of the remaining artifacts tools", () => {
    it("list_feeds surfaces failures", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.list_feeds);
      mockFetch.mockResolvedValue(ok("nope", 403));

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("403");
    });

    it("create_feed surfaces failures", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.create_feed);
      mockFetch.mockResolvedValue(ok("conflict", 409));

      const result = await handler({ name: "tools" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("409");
    });

    it("list_packages surfaces failures", async () => {
      const handler = getHandler(ARTIFACTS_TOOLS.list_packages);
      mockFetch.mockResolvedValue(ok("nope", 404));

      const result = await handler({ feedId: "tools" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("404");
    });
  });
});
