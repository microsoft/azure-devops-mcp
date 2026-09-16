// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { configureSearchTools, SEARCH_TOOLS } from "../../../src/tools/search";

describe("configureSearchTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockFetch: jest.Mock;
  let mockGitApi: { getItem: jest.Mock; getItems: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    mockGitApi = { getItem: jest.fn(), getItems: jest.fn() };
    connectionProvider = jest.fn().mockResolvedValue({
      serverUrl: "https://dev.azure.com/contoso",
      getGitApi: jest.fn().mockResolvedValue(mockGitApi),
    } as unknown as WebApi) as () => Promise<WebApi>;
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configureSearchTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: () => Promise.resolve(body),
  });

  it("registers all three search tools", () => {
    configureSearchTools(server, tokenProvider, connectionProvider, () => "Jest");
    const names = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining([SEARCH_TOOLS.search_code, SEARCH_TOOLS.search_wiki, SEARCH_TOOLS.search_workitem]));
  });

  describe("search_wiki", () => {
    it("posts to the almsearch host with the search text and paging", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_wiki);
      mockFetch.mockResolvedValue(ok('{"count":0,"results":[]}'));

      const result = await handler({ searchText: "onboarding", includeFacets: false, skip: 0, top: 10 });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://almsearch.dev.azure.com/contoso/_apis/search/wikisearchresults?api-version=7.2-preview.1");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer fake-token");
      expect(JSON.parse(init.body)).toMatchObject({ searchText: "onboarding", $skip: 0, $top: 10 });
      expect(result.content[0].text).toContain("count");
    });

    it("sends project and wiki filters only when provided", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_wiki);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ searchText: "release", project: ["Contoso"], wiki: ["Docs"], includeFacets: true, skip: 5, top: 20 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.filters).toEqual({ Project: ["Contoso"], Wiki: ["Docs"] });
      expect(body.includeFacets).toBe(true);
      expect(body.$skip).toBe(5);
    });

    it("omits the filters object when no filter is given", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_wiki);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ searchText: "release", includeFacets: false, skip: 0, top: 10 });

      expect(JSON.parse(mockFetch.mock.calls[0][1].body).filters).toBeUndefined();
    });

    it("throws when the search API rejects the request", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_wiki);
      mockFetch.mockResolvedValue(ok("", 403));

      await expect(handler({ searchText: "secret", includeFacets: false, skip: 0, top: 10 })).rejects.toThrow(/403/);
    });
  });

  describe("search_workitem", () => {
    it("posts the work item query with its filters", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_workitem);
      mockFetch.mockResolvedValue(ok('{"count":1,"results":[]}'));

      const result = await handler({
        searchText: "login fails",
        project: ["Contoso"],
        areaPath: ["Contoso\\Web"],
        workItemType: ["Bug"],
        state: ["Active"],
        assignedTo: ["ada@contoso.com"],
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain("/_apis/search/workitemsearchresults");
      const body = JSON.parse(init.body);
      expect(body.searchText).toBe("login fails");
      expect(body.filters).toEqual({
        "System.TeamProject": ["Contoso"],
        "System.AreaPath": ["Contoso\\Web"],
        "System.WorkItemType": ["Bug"],
        "System.State": ["Active"],
        "System.AssignedTo": ["ada@contoso.com"],
      });
      expect(result.content[0].text).toContain("count");
    });

    it("throws when the search API rejects the request", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_workitem);
      mockFetch.mockResolvedValue(ok("", 500));

      await expect(handler({ searchText: "x", includeFacets: false, skip: 0, top: 10 })).rejects.toThrow(/500/);
    });
  });

  describe("search_code", () => {
    it("normalizes a single project string into an array filter", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_code);
      mockFetch.mockResolvedValue(ok('{"results":[]}'));

      await handler({ searchText: "TODO", project: ["Contoso"], includeFacets: false, skip: 0, top: 5 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.filters).toEqual({ Project: ["Contoso"] });
    });

    it("throws when the code search API rejects the request", async () => {
      const handler = getHandler(SEARCH_TOOLS.search_code);
      mockFetch.mockResolvedValue(ok("", 401));

      await expect(handler({ searchText: "TODO", includeFacets: false, skip: 0, top: 5 })).rejects.toThrow(/401/);
    });
  });
});
