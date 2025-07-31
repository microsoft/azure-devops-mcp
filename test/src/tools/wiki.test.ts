import { AccessToken } from "@azure/identity";
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
  let mockConnection: { getWikiApi: jest.Mock };
  let mockWikiApi: WikiApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockWikiApi = {
      getWiki: jest.fn(),
      getAllWikis: jest.fn(),
      getPagesBatch: jest.fn(),
      getPageText: jest.fn(),
    };
    mockConnection = {
      getWikiApi: jest.fn().mockResolvedValue(mockWikiApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers wiki tools on the server", () => {
      configureWikiTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("get_wiki tool", () => {
    it("should call getWiki with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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

  describe("get_page_content tool", () => {
    it("should call getPageText with the correct parameters and return the expected result", async () => {
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
      configureWikiTools(server, tokenProvider, connectionProvider);
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
  });
});
