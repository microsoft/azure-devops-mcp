// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureWikiTools } from "../../../src/tools/wiki";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;
interface WikiApiMock {
  getWiki: jest.Mock;
  getAllWikis: jest.Mock;
  getPagesBatch: jest.Mock;
  getPageText: jest.Mock;
}

describe("configureWikiTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: {
    getWikiApi: jest.Mock;
    serverUrl: string;
  };
  let mockWikiApi: WikiApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";
    mockWikiApi = {
      getWiki: jest.fn(),
      getAllWikis: jest.fn(),
      getPagesBatch: jest.fn(),
      getPageText: jest.fn(),
    };
    mockConnection = {
      getWikiApi: jest.fn().mockResolvedValue(mockWikiApi),
      serverUrl: "https://dev.azure.com/testorg",
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers wiki tools on the server", () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("get_wiki tool", () => {
    it("should call getWiki with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_wiki");
      if (!call) throw new Error("wiki_get_wiki tool not registered");
      const [, , , handler] = call;

      const mockWiki = { id: "wiki1", name: "Test Wiki" };
      mockWikiApi.getWiki.mockResolvedValue(mockWiki);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getWiki).toHaveBeenCalledWith("wiki1", "proj1");
      expect(result.content[0].text).toBe(JSON.stringify(mockWiki, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_wiki");
      if (!call) throw new Error("wiki_get_wiki tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Wiki not found");
      mockWikiApi.getWiki.mockRejectedValue(testError);

      const params = {
        wikiIdentifier: "nonexistent",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getWiki).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki: Wiki not found");
    });

    it("should handle null API results correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_wiki");
      if (!call) throw new Error("wiki_get_wiki tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getWiki.mockResolvedValue(null);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getWiki).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No wiki found");
    });

    it("should handle unknown error type correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_wiki");
      if (!call) throw new Error("wiki_get_wiki tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getWiki.mockRejectedValue("string error");

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getWiki).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki: Unknown error occurred");
    });
  });

  describe("list_wikis tool", () => {
    it("should call getAllWikis with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_wikis");
      if (!call) throw new Error("wiki_list_wikis tool not registered");
      const [, , , handler] = call;

      const mockWikis = [
        { id: "wiki1", name: "Wiki 1" },
        { id: "wiki2", name: "Wiki 2" },
      ];
      mockWikiApi.getAllWikis.mockResolvedValue(mockWikis);

      const params = {
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getAllWikis).toHaveBeenCalledWith("proj1");
      expect(result.content[0].text).toBe(JSON.stringify(mockWikis, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_wikis");
      if (!call) throw new Error("wiki_list_wikis tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to fetch wikis");
      mockWikiApi.getAllWikis.mockRejectedValue(testError);

      const params = {
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getAllWikis).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wikis: Failed to fetch wikis");
    });

    it("should handle null API results correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_wikis");
      if (!call) throw new Error("wiki_list_wikis tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getAllWikis.mockResolvedValue(null);

      const params = {
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getAllWikis).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No wikis found");
    });

    it("should handle unknown error type correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_wikis");
      if (!call) throw new Error("wiki_list_wikis tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getAllWikis.mockRejectedValue("string error");

      const params = {
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getAllWikis).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wikis: Unknown error occurred");
    });
  });

  describe("list_wiki_pages tool", () => {
    it("should call getPagesBatch with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_pages");
      if (!call) throw new Error("wiki_list_pages tool not registered");
      const [, , , handler] = call;
      mockWikiApi.getPagesBatch.mockResolvedValue({ value: ["page1", "page2"] });

      const params = {
        wikiIdentifier: "wiki2",
        project: "proj2",
        top: 10,
        continuationToken: "token123",
        pageViewsForDays: 7,
      };
      const result = await handler(params);
      const parsedResult = JSON.parse(result.content[0].text);

      expect(mockWikiApi.getPagesBatch).toHaveBeenCalledWith(
        {
          top: 10,
          continuationToken: "token123",
          pageViewsForDays: 7,
        },
        "proj2",
        "wiki2"
      );
      expect(parsedResult.value).toEqual(["page1", "page2"]);
      expect(result.isError).toBeUndefined();
    });

    it("should use default top parameter when not provided", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_pages");
      if (!call) throw new Error("wiki_list_pages tool not registered");
      const [, , , handler] = call;
      mockWikiApi.getPagesBatch.mockResolvedValue({ value: ["page1", "page2"] });

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
      };
      const result = await handler(params);

      expect(mockWikiApi.getPagesBatch).toHaveBeenCalledWith(
        {
          top: 20,
          continuationToken: undefined,
          pageViewsForDays: undefined,
        },
        "proj1",
        "wiki1"
      );
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_pages");
      if (!call) throw new Error("wiki_list_pages tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to fetch wiki pages");
      mockWikiApi.getPagesBatch.mockRejectedValue(testError);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        top: 10,
      };

      const result = await handler(params);

      expect(mockWikiApi.getPagesBatch).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki pages: Failed to fetch wiki pages");
    });

    it("should handle null API results correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_pages");
      if (!call) throw new Error("wiki_list_pages tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getPagesBatch.mockResolvedValue(null);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        top: 10,
      };

      const result = await handler(params);

      expect(mockWikiApi.getPagesBatch).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No wiki pages found");
    });

    it("should handle unknown error type correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_list_pages");
      if (!call) throw new Error("wiki_list_pages tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getPagesBatch.mockRejectedValue("string error");

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        top: 10,
      };

      const result = await handler(params);

      expect(mockWikiApi.getPagesBatch).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki pages: Unknown error occurred");
    });
  });

  describe("get_page tool", () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
      (tokenProvider as jest.Mock).mockResolvedValue("test-token");
    });

    it("should fetch page metadata with correct parameters", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page");
      if (!call) throw new Error("wiki_get_page tool not registered");
      const [, , , handler] = call;

      const mockPageData = {
        id: 123,
        path: "/Home",
        gitItemPath: "/Home.md",
        isParentPage: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPageData,
      });

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/Home",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/testorg/proj1/_apis/wiki/wikis/wiki1/pages?path=%2FHome&api-version=7.2-preview.1",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer test-token",
            "User-Agent": "Jest",
          }),
        })
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockPageData, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle path without leading slash", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page");
      if (!call) throw new Error("wiki_get_page tool not registered");
      const [, , , handler] = call;

      const mockPageData = { id: 456, path: "/Documentation" };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPageData,
      });

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "Documentation",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("path=%2FDocumentation"), expect.any(Object));
      expect(result.content[0].text).toContain('"id": 456');
    });

    it("should include optional parameters when provided", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page");
      if (!call) throw new Error("wiki_get_page tool not registered");
      const [, , , handler] = call;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 789 }),
      });

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/Home",
        recursionLevel: "OneLevel" as const,
      };

      await handler(params);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("recursionLevel=OneLevel");
    });

    it("should handle API errors", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page");
      if (!call) throw new Error("wiki_get_page tool not registered");
      const [, , , handler] = call;

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Page not found",
      });

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/NonExistent",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page metadata");
      expect(result.content[0].text).toContain("Failed to get wiki page (404)");
    });

    it("should handle fetch errors", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page");
      if (!call) throw new Error("wiki_get_page tool not registered");
      const [, , , handler] = call;

      mockFetch.mockRejectedValue(new Error("Network error"));

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/Home",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page metadata: Network error");
    });
  });

  describe("get_page_content tool", () => {
    it("should call getPageText with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      // Mock a stream-like object for getPageText
      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") {
            setImmediate(() => cb("mock page text"));
          }
          if (event === "end") {
            setImmediate(() => cb());
          }
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/page1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getPageText).toHaveBeenCalledWith("proj1", "wiki1", "/page1", undefined, undefined, true);
      expect(result.content[0].text).toBe('"mock page text"');
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Page not found");
      mockWikiApi.getPageText.mockRejectedValue(testError);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/nonexistent",
      };

      const result = await handler(params);

      expect(mockWikiApi.getPageText).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Page not found");
    });

    it("should handle null API results correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getPageText.mockResolvedValue(null);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/page1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getPageText).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No wiki page content found");
    });

    it("should handle stream errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      // Mock a stream that emits an error
      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (error?: Error) => void) {
          if (event === "error") {
            setImmediate(() => cb(new Error("Stream read error")));
          }
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/page1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getPageText).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Stream read error");
    });

    it("should handle unknown error type correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      mockWikiApi.getPageText.mockRejectedValue("string error");

      const params = {
        wikiIdentifier: "wiki1",
        project: "proj1",
        path: "/page1",
      };

      const result = await handler(params);

      expect(mockWikiApi.getPageText).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Unknown error occurred");
    });

    it("should retrieve content via URL with pagePath", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") setImmediate(() => cb("url path content"));
          if (event === "end") setImmediate(() => cb());
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const url = "https://dev.azure.com/org/project/_wiki/wikis/myWiki?wikiVersion=GBmain&pagePath=%2FDocs%2FIntro";
      const result = await handler({ url });

      expect(mockWikiApi.getPageText).toHaveBeenCalledWith("project", "myWiki", "/Docs/Intro", undefined, undefined, true);
      expect(result.content[0].text).toBe('"url path content"');
    });

    it("should retrieve content via URL with pageId (may fallback to root path)", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;
      // Ensure token is returned
      (tokenProvider as jest.Mock).mockResolvedValueOnce("abc");
      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") setImmediate(() => cb("# Page Title\nBody"));
          if (event === "end") setImmediate(() => cb());
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      // Mock fetch for REST page by id returning content
      const mockFetch = jest.fn();
      global.fetch = mockFetch as typeof fetch;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ content: "# Page Title\nBody" }),
      });

      const url = "https://dev.azure.com/org/project/_wiki/wikis/myWiki/123/Page-Title";
      const result = await handler({ url });

      // Current implementation may fallback to root path stream retrieval
      expect(mockWikiApi.getPageText).not.toHaveBeenCalled();
      // Content either direct or from stream JSON string wrapping
      expect(result.content[0].text).toContain("Page Title");
    });

    it("should fallback to getPageText when REST call lacks content but returns path (root path fallback)", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;
      (tokenProvider as jest.Mock).mockResolvedValueOnce("abc");

      const mockFetch = jest.fn();
      global.fetch = mockFetch as typeof fetch;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ path: "/Some/Page" }),
      });

      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") setImmediate(() => cb("fallback content"));
          if (event === "end") setImmediate(() => cb());
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const url = "https://dev.azure.com/org/project/_wiki/wikis/myWiki/999/Some-Page";
      const result = await handler({ url });

      // Implementation currently falls back to root path if path not resolved prior to fallback
      expect(mockWikiApi.getPageText).toHaveBeenCalledWith("project", "myWiki", "/Some/Page", undefined, undefined, true);
      expect(result.content[0].text).toBe('"fallback content"');
    });

    it("should error when both url and wikiIdentifier provided", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;
      const result = await handler({ url: "https://dev.azure.com/org/project/_wiki/wikis/wiki1?pagePath=%2FHome", wikiIdentifier: "wiki1", project: "project" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Provide either 'url' OR 'wikiIdentifier'");
    });

    it("should error when neither url nor identifiers provided", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;
      const result = await handler({ path: "/Home" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("You must provide either 'url' OR both 'wikiIdentifier' and 'project'");
    });

    it("should error on malformed wiki URL", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const result = await handler({ url: "https://dev.azure.com/org/project/notwiki/wikis/wiki1?pagePath=%2FHome" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: URL does not match expected wiki pattern");
    });

    it("should handle invalid URL format", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const result = await handler({ url: "not-a-valid-url" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Invalid URL format");
    });

    it("should handle URL with pageId that returns 404", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValueOnce({ token: "abc", expiresOnTimestamp: Date.now() + 10000 });

      const mockFetch = jest.fn();
      global.fetch = mockFetch as unknown as typeof fetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const url = "https://dev.azure.com/org/project/_wiki/wikis/myWiki/999/NonExistent-Page";
      const result = await handler({ url });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Page with id 999 not found");
    });

    it("should handle URL that resolves but project/wiki end up undefined", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const url = "https://dev.azure.com/org//_wiki/wikis/?pagePath=%2FHome";
      const result = await handler({ url });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching wiki page content: Could not extract project or wikiIdentifier from URL");
    });

    it("should handle URL with non-numeric pageId", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") setImmediate(() => cb("content for non-numeric path"));
          if (event === "end") setImmediate(() => cb());
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const url = "https://dev.azure.com/org/project/_wiki/wikis/myWiki/not-a-number/Some-Page";
      const result = await handler({ url });

      expect(mockWikiApi.getPageText).toHaveBeenCalledWith("project", "myWiki", "/", undefined, undefined, true);
      expect(result.content[0].text).toBe('"content for non-numeric path"');
    });

    it("should use default root path when resolvedPath is undefined", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      const mockStream = {
        setEncoding: jest.fn(),
        on: function (event: string, cb: (chunk?: unknown) => void) {
          if (event === "data") setImmediate(() => cb("root page content"));
          if (event === "end") setImmediate(() => cb());
          return this;
        },
      };
      mockWikiApi.getPageText.mockResolvedValue(mockStream as unknown);

      const result = await handler({ wikiIdentifier: "wiki1", project: "project1" });

      expect(mockWikiApi.getPageText).toHaveBeenCalledWith("project1", "wiki1", "/", undefined, undefined, true);
      expect(result.content[0].text).toBe('"root page content"');
      expect(result.isError).toBeUndefined();
    });

    it("should handle scenario where resolvedProject/Wiki become null after URL processing", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_get_page_content");
      if (!call) throw new Error("wiki_get_page_content tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValueOnce({ token: "abc", expiresOnTimestamp: Date.now() + 10000 });

      const mockFetch = jest.fn();
      global.fetch = mockFetch as unknown as typeof fetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const url = "https://dev.azure.com//_wiki/wikis//123/Page";
      const result = await handler({ url });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("URL does not match expected wiki pattern");
    });
  });

  describe("create_or_update_page tool", () => {
    let mockFetch: jest.Mock;
    //let mockAccessToken: AccessToken;
    let mockConnection: { getWikiApi: jest.Mock; serverUrl: string };

    beforeEach(() => {
      // Mock fetch for REST API calls
      mockFetch = jest.fn();
      global.fetch = mockFetch;

      tokenProvider = jest.fn().mockResolvedValue("test-token");

      mockConnection = {
        getWikiApi: jest.fn().mockResolvedValue(mockWikiApi),
        serverUrl: "https://dev.azure.com/testorg",
      };
      connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create a new wiki page successfully", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        path: "/Home",
        id: 123,
        content: "# Welcome\nThis is the home page.",
        url: "https://dev.azure.com/testorg/proj1/_apis/wiki/wikis/wiki1/pages/%2FHome",
        remoteUrl: "https://dev.azure.com/testorg/proj1/_wiki/wikis/wiki1?pagePath=%2FHome",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Welcome\nThis is the home page.",
        project: "proj1",
        comment: "Initial page creation",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/testorg/proj1/_apis/wiki/wikis/wiki1/pages?path=%2FHome&versionDescriptor.versionType=branch&versionDescriptor.version=wikiMaster&api-version=7.1",
        {
          method: "PUT",
          headers: {
            "Authorization": "Bearer test-token",
            "Content-Type": "application/json",
            "User-Agent": "Jest",
          },
          body: JSON.stringify({ content: "# Welcome\nThis is the home page." }),
        }
      );
      expect(result.content[0].text).toContain("Successfully created wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });

    it("should update an existing wiki page with ETag", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('W/"test-etag"'),
        },
      };

      const mockUpdateResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Updated Welcome\nThis is the updated home page.",
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse) // GET to retrieve ETag
        .mockResolvedValueOnce(mockUpdateResponse); // Second PUT succeeds with ETag

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome\nThis is the updated home page.",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.content[0].text).toContain("Successfully updated wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Wiki not found"),
      });

      const params = {
        wikiIdentifier: "nonexistent",
        path: "/Home",
        content: "# Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Failed to create page (404): Wiki not found");
    });

    it("should handle fetch errors correctly", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      mockFetch.mockRejectedValue(new Error("Network error"));

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Network error");
    });

    it("should get ETag from response body when not in headers", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // No ETag in headers
        },
        json: jest.fn().mockResolvedValue({
          eTag: 'W/"body-etag"', // ETag in response body
        }),
      };

      const mockUpdateResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Updated Welcome",
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse) // GET to retrieve ETag from body
        .mockResolvedValueOnce(mockUpdateResponse); // Second PUT succeeds with ETag

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.content[0].text).toContain("Successfully updated wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });

    it("should handle when ETag is found directly in headers (case-sensitive)", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockImplementation((headerName: string) => {
            if (headerName === "etag") return null;
            if (headerName === "ETag") return 'W/"header-etag"';
            return null;
          }),
        },
      };

      const mockUpdateResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Updated Welcome",
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse) // GET to retrieve ETag from headers
        .mockResolvedValueOnce(mockUpdateResponse); // Second PUT succeeds with ETag

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.content[0].text).toContain("Successfully updated wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });

    it("should handle missing ETag error when not in headers or body", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // No ETag in headers
        },
        json: jest.fn().mockResolvedValue({
          // No eTag in response body either
          path: "/Home",
          id: 123,
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse); // GET succeeds but no ETag anywhere

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Could not retrieve ETag for existing page");
    });

    it("should update existing page when ETag is provided as parameter", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockUpdateResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Updated Welcome",
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockUpdateResponse); // Second PUT succeeds with provided ETag

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
        etag: 'W/"provided-etag"', // ETag provided, should skip line 208
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should NOT call GET to retrieve ETag since one was provided
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("pages?path="), {
        method: "PUT",
        headers: {
          "Authorization": "Bearer test-token",
          "Content-Type": "application/json",
          "If-Match": 'W/"provided-etag"',
          "User-Agent": "Jest",
        },
        body: JSON.stringify({ content: "# Updated Welcome" }),
      });
      expect(result.content[0].text).toContain("Successfully updated wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });

    it("should handle missing ETag error when neither headers nor body contain ETag", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // No ETag in headers
        },
        json: jest.fn().mockResolvedValue({
          // No eTag in response body either
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse); // GET fails to retrieve ETag

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Could not retrieve ETag for existing page");
    });

    it("should handle update failure after getting ETag", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('W/"test-etag"'),
        },
      };

      const mockUpdateResponse = {
        ok: false,
        status: 412, // Precondition failed
        text: jest.fn().mockResolvedValue("ETag mismatch"),
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse) // GET to retrieve ETag
        .mockResolvedValueOnce(mockUpdateResponse); // Second PUT fails with 412

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Failed to update page (412): ETag mismatch");
    });

    it("should handle non-Error exceptions", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      // Throw a non-Error object
      mockFetch.mockRejectedValue("String error message");

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Unknown error occurred");
    });

    it("should handle path without leading slash", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Welcome",
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params = {
        wikiIdentifier: "wiki1",
        path: "Home", // No leading slash
        content: "# Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/testorg/proj1/_apis/wiki/wikis/wiki1/pages?path=%2FHome&versionDescriptor.versionType=branch&versionDescriptor.version=wikiMaster&api-version=7.1",
        expect.any(Object)
      );
      expect(result.content[0].text).toContain("Successfully created wiki page at path: /Home");
    });

    it("should handle missing project parameter", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          path: "/Home",
          id: 123,
          content: "# Welcome",
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Welcome",
        // project parameter omitted
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/testorg//_apis/wiki/wikis/wiki1/pages?path=%2FHome&versionDescriptor.versionType=branch&versionDescriptor.version=wikiMaster&api-version=7.1",
        expect.any(Object)
      );
      expect(result.content[0].text).toContain("Successfully created wiki page at path: /Home");
    });

    it("should handle failed GET request for ETag", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockCreateResponse = {
        ok: false,
        status: 409, // Conflict - page exists
      };

      const mockGetResponse = {
        ok: false, // GET fails
        status: 404,
      };

      mockFetch
        .mockResolvedValueOnce(mockCreateResponse) // First PUT fails with 409
        .mockResolvedValueOnce(mockGetResponse); // GET fails

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Updated Welcome",
        project: "proj1",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating/updating wiki page: Could not retrieve ETag for existing page");
    });

    it("should use custom branch when specified", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wiki_create_or_update_page");
      if (!call) throw new Error("wiki_create_or_update_page tool not registered");
      const [, , , handler] = call;

      const mockResponse = {
        path: "/Home",
        id: 123,
        content: "# Welcome",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const params = {
        wikiIdentifier: "wiki1",
        path: "/Home",
        content: "# Welcome",
        project: "proj1",
        branch: "main",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/testorg/proj1/_apis/wiki/wikis/wiki1/pages?path=%2FHome&versionDescriptor.versionType=branch&versionDescriptor.version=main&api-version=7.1",
        {
          method: "PUT",
          headers: {
            "Authorization": "Bearer test-token",
            "Content-Type": "application/json",
            "User-Agent": "Jest",
          },
          body: JSON.stringify({ content: "# Welcome" }),
        }
      );
      expect(result.content[0].text).toContain("Successfully created wiki page at path: /Home");
      expect(result.isError).toBeUndefined();
    });
  });
});
