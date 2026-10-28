// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { Domain } from "../../src/shared/domains";
import { configureAllTools } from "../../src/tools";
import * as coreTools from "../../src/tools/core";

jest.mock("../../src/index", () => ({ orgName: "test-org" }));
jest.mock("../../src/logger", () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

describe("tool registration", () => {
  let server: McpServer;
  let client: Client;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;

  beforeEach(() => {
    server = new McpServer({ name: "registration-test", version: "1.0.0" });
    client = new Client({ name: "registration-client", version: "1.0.0" });
    tokenProvider = jest.fn();
    connectionProvider = jest.fn();
  });

  afterEach(async () => {
    try {
      await client.close();
    } finally {
      await server.close();
      jest.restoreAllMocks();
    }
  });

  async function connect() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  }

  it("does not register tools when every domain is disabled", async () => {
    const tool = jest.spyOn(server, "tool");
    const registerTool = jest.spyOn(server, "registerTool");
    configureAllTools(server, tokenProvider, connectionProvider, () => "Jest", new Set());

    expect(tool).not.toHaveBeenCalled();
    expect(registerTool).not.toHaveBeenCalled();
    expect(connectionProvider).not.toHaveBeenCalled();
    expect(tokenProvider).not.toHaveBeenCalled();
    await connect();
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
    await expect(client.listTools()).rejects.toMatchObject({ code: -32601 });
  });

  it("only registers enabled domains and restores registration methods", async () => {
    const tool = server.tool;
    const registerTool = server.registerTool;
    configureAllTools(server, tokenProvider, connectionProvider, () => "Jest", new Set([Domain.CORE]));

    expect(server.tool).toBe(tool);
    expect(server.registerTool).toBe(registerTool);
    await connect();
    expect((await client.listTools()).tools.map(({ name }) => name).sort()).toEqual(["core_get_identity_ids", "core_list_project_teams", "core_list_projects"]);
  });

  it("wraps external responses registered through registerTool", async () => {
    jest.spyOn(coreTools, "configureCoreTools").mockImplementation((provider) => {
      provider.registerTool("registration_fixture", { description: "Test response wrapping", inputSchema: {} }, async () => ({
        content: [{ type: "text", text: "External response" }],
      }));
    });
    configureAllTools(server, tokenProvider, connectionProvider, () => "Jest", new Set([Domain.CORE]));
    await connect();

    const result = await client.callTool({ name: "registration_fixture", arguments: {} });

    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringMatching(/UNTRUSTED AZURE DEVOPS CORE CONTENT[\s\S]*External response/),
      }),
    ]);
  });

  it("forwards invalid registrations to the SDK and restores methods when configuration throws", () => {
    const tool = server.tool;
    const registerTool = server.registerTool;
    jest.spyOn(coreTools, "configureCoreTools").mockImplementation((provider) => {
      Reflect.apply(provider.registerTool, provider, ["registration_fixture", { inputSchema: {} }]);
      provider.registerTool("registration_fixture", { inputSchema: {} }, async () => ({ content: [] }));
    });

    expect(() => configureAllTools(server, tokenProvider, connectionProvider, () => "Jest", new Set([Domain.CORE]))).toThrow("already registered");
    expect(server.tool).toBe(tool);
    expect(server.registerTool).toBe(registerTool);
  });
});
