// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureSearchTools } from "../../../src/tools/search";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureSearchTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue("fake-token");
    userAgentProvider = () => "Jest";
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://ado.contoso.local/tfs/DefaultCollection" } as WebApi);
  });

  it("returns a clear error for code search on on-prem deployments", async () => {
    configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider);

    const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "search_code");
    if (!call) throw new Error("search_code tool not registered");
    const [, , , handler] = call;

    const result = await handler({
      searchText: "test",
      project: undefined,
      repository: undefined,
      path: undefined,
      branch: undefined,
      includeFacets: false,
      skip: 0,
      top: 5,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("currently supported only for Azure DevOps Services");
  });
});
