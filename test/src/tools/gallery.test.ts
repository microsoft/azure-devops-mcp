// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureGalleryTools, GALLERY_TOOLS } from "../../../src/tools/gallery";
import { createToolServer } from "../../mocks/tool-server";

describe("configureGalleryTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockGalleryApi: { queryExtensions: jest.Mock; getExtension: jest.Mock };

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockGalleryApi = { queryExtensions: jest.fn(), getExtension: jest.fn() };
    connectionProvider = jest.fn().mockResolvedValue({ getGalleryApi: jest.fn().mockResolvedValue(mockGalleryApi) } as unknown as WebApi);
  });

  function getHandler(toolName: string) {
    configureGalleryTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  it("builds a search-text extension query with the default flags", async () => {
    const handler = getHandler(GALLERY_TOOLS.query_extensions);
    mockGalleryApi.queryExtensions.mockResolvedValue({ results: [] });

    await handler({ searchText: "code coverage", top: 5 });

    expect(mockGalleryApi.queryExtensions).toHaveBeenCalledWith(
      {},
      {
        filters: [{ criteria: [{ filterType: 10, value: "code coverage" }], pageNumber: 1, pageSize: 5 }],
        flags: 512,
      }
    );
  });

  it("omits criteria when no search text is given", async () => {
    const handler = getHandler(GALLERY_TOOLS.query_extensions);
    mockGalleryApi.queryExtensions.mockResolvedValue({ results: [] });

    await handler({ top: 20 });

    const query = mockGalleryApi.queryExtensions.mock.calls[0][1] as { filters: { criteria: unknown[] }[] };
    expect(query.filters[0].criteria).toEqual([]);
  });

  it("gets an extension by publisher and name", async () => {
    const handler = getHandler(GALLERY_TOOLS.get_extension);
    mockGalleryApi.getExtension.mockResolvedValue({ extensionName: "team-build-tasks" });

    await handler({ publisherName: "ms-vsts", extensionName: "team-build-tasks" });

    expect(mockGalleryApi.getExtension).toHaveBeenCalledWith({}, "ms-vsts", "team-build-tasks", undefined, undefined);
  });

  it("returns isError when the extension is not found", async () => {
    const handler = getHandler(GALLERY_TOOLS.get_extension);
    mockGalleryApi.getExtension.mockResolvedValue(null);

    const result = await handler({ publisherName: "p", extensionName: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("surfaces query errors", async () => {
    const handler = getHandler(GALLERY_TOOLS.query_extensions);
    mockGalleryApi.queryExtensions.mockRejectedValue(new Error("boom"));

    const result = await handler({ searchText: "x" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error querying extensions: boom");
  });
});
