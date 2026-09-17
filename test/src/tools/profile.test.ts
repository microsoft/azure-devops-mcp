// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureProfileTools, PROFILE_TOOLS } from "../../../src/tools/profile";
import { createToolServer } from "../../mocks/tool-server";

describe("configureProfileTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockConnect: jest.Mock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    mockConnect = jest.fn();
    connectionProvider = jest.fn().mockResolvedValue({
      serverUrl: "https://dev.azure.com/contoso",
      connect: mockConnect,
    } as unknown as WebApi) as () => Promise<WebApi>;
  });

  function getHandler(toolName: string) {
    configureProfileTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as () => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  it("registers the tool", () => {
    configureProfileTools(server, tokenProvider, connectionProvider);
    expect((server.tool as jest.Mock).mock.calls.map(([name]) => name)).toContain(PROFILE_TOOLS.get_me);
  });

  it("returns the authenticated user together with the connected organization", async () => {
    const handler = getHandler(PROFILE_TOOLS.get_me);
    mockConnect.mockResolvedValue({
      authenticatedUser: { id: "user-1", descriptor: "aad.abc", providerDisplayName: "Ada Lovelace" },
      authorizedUser: { id: "user-1" },
      deploymentType: 2,
      instanceId: "instance-1",
    });

    const result = await handler();

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.authenticatedUser.id).toBe("user-1");
    expect(payload.authenticatedUser.providerDisplayName).toBe("Ada Lovelace");
    expect(payload.serverUrl).toBe("https://dev.azure.com/contoso");
    expect(payload.instanceId).toBe("instance-1");
  });

  it("reports an error when the connection carries no authenticated user", async () => {
    const handler = getHandler(PROFILE_TOOLS.get_me);
    mockConnect.mockResolvedValue({});

    const result = await handler();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Could not resolve the authenticated user");
  });

  it("reports connection failures as an error result", async () => {
    const handler = getHandler(PROFILE_TOOLS.get_me);
    mockConnect.mockRejectedValue(new Error("TF400813: unauthorized"));

    const result = await handler();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("TF400813: unauthorized");
  });
});
