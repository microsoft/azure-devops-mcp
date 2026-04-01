// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureMcpAppsTools, MCP_APPS_TOOLS } from "../../../src/tools/mcp-apps";
import { WebApi } from "azure-devops-node-api";

jest.mock("../../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface MockConnection {
  serverUrl: string;
}

describe("configureMcpAppsTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: MockConnection;

  beforeEach(() => {
    server = { tool: jest.fn(), registerTool: jest.fn(), resource: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue("test-token");
    userAgentProvider = () => "Jest";

    mockConnection = {
      serverUrl: "https://dev.azure.com/testorg",
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);

    // Reset global fetch mock before each test
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("tool registration", () => {
    it("registers mcp-apps tools on the server via registerTool", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.registerTool as jest.Mock).toHaveBeenCalled();
    });

    it("registers the post_work_item_comment tool with correct name", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.post_work_item_comment);
      expect(call).toBeDefined();
    });
  });

  describe("post_work_item_comment tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.post_work_item_comment);
      if (!call) throw new Error("wit_post_work_item_comment tool not registered");
      // registerAppTool delegates to server.registerTool(name, config, handler)
      const [, , handler] = call;
      return handler;
    }

    it("should post a comment and return the response text", async () => {
      const handler = getHandler();
      const mockResponseText = JSON.stringify({ id: 1, text: "<div>Hello world</div>" });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockResponseText),
      });

      const params = {
        project: "Contoso",
        workItemId: 42,
        comment: "Hello world",
      };

      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.content[0].text).toBe(mockResponseText);
      expect(result.isError).toBeUndefined();
    });

    it("should use correct API URL with project name and work item ID", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      });

      await handler({
        project: "MyProject",
        workItemId: 100,
        comment: "test",
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("MyProject");
      expect(fetchUrl).toContain("/workItems/100/comments");
    });

    it("should include correct authorization and content-type headers", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      });

      await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "test",
      });

      const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchOptions.method).toBe("POST");
      expect(fetchOptions.headers["Authorization"]).toBe("Bearer test-token");
      expect(fetchOptions.headers["Content-Type"]).toBe("application/json");
      expect(fetchOptions.headers["User-Agent"]).toBe("Jest");
    });

    it("should convert plain text comment to HTML before posting", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      });

      await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "Line1\nLine2",
      });

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      // toCommentHtml converts plain text lines to <div> wrapped
      expect(fetchBody.text).toContain("<div>");
      expect(fetchBody.text).toContain("Line1");
      expect(fetchBody.text).toContain("Line2");
    });

    it("should handle API errors correctly", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      const result = await handler({
        project: "Contoso",
        workItemId: 999,
        comment: "test comment",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment");
      expect(result.content[0].text).toContain("Not Found");
    });

    it("should handle connection provider errors correctly", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection failed"));

      const handler = getHandler();

      const result = await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment: Connection failed");
    });

    it("should handle token provider errors correctly", async () => {
      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token expired"));

      const handler = getHandler();

      const result = await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment: Token expired");
    });

    it("should handle unknown error type correctly", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue("string error");

      const handler = getHandler();

      const result = await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment: Unknown error occurred");
    });

    it("should handle network fetch errors correctly", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network unreachable"));

      const result = await handler({
        project: "Contoso",
        workItemId: 1,
        comment: "test",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment: Network unreachable");
    });

    it("should pass HTML comments through without wrapping in divs", async () => {
      const handler = getHandler();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      });

      const htmlComment = "<div>Already HTML</div>";
      await handler({
        project: "Contoso",
        workItemId: 1,
        comment: htmlComment,
      });

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody.text).toContain("Already HTML");
    });
  });
});
