// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBearerHandler, WebApi } from "azure-devops-node-api";
import { BuildApi } from "azure-devops-node-api/BuildApi.js";
import { GitApi } from "azure-devops-node-api/GitApi.js";
import { WorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi.js";
import { z } from "zod";
import { Domain } from "../../src/shared/domains";
import { TOOL_ANNOTATIONS } from "../../src/shared/tool-annotations";
import { dateInputSchema } from "../../src/shared/tool-schemas";
import { configureAllTools } from "../../src/tools";

jest.mock("../../src/index", () => ({ orgName: "test-org" }));

describe("date input schema", () => {
  it.each([
    ["2026-10-28T13:00:00.000Z", "2026-10-28T13:00:00.000Z"],
    ["2026-10-28T15:00:00+02:00", "2026-10-28T13:00:00.000Z"],
    ["2026-10-28", "2026-10-28T00:00:00.000Z"],
    [new Date("2026-10-28T13:00:00.000Z"), "2026-10-28T13:00:00.000Z"],
    [0, "1970-01-01T00:00:00.000Z"],
    [null, "1970-01-01T00:00:00.000Z"],
    [false, "1970-01-01T00:00:00.000Z"],
    [true, "1970-01-01T00:00:00.001Z"],
  ])("preserves date coercion for %p", (input, expected) => {
    expect(dateInputSchema.parse(input)).toEqual(new Date(expected));
  });

  it.each([undefined, "", "not-a-date", {}, Infinity, new Date(NaN)])("rejects invalid date input %p", (input) => {
    expect(dateInputSchema.safeParse(input).success).toBe(false);
  });

  it("preserves omitted optional dates", () => {
    expect(z.object({ asOf: dateInputSchema.optional() }).parse({})).toEqual({});
  });

  it("advertises a date-time string without attempting to serialize a Date schema", () => {
    expect(z.toJSONSchema(dateInputSchema, { io: "input", target: "draft-7" })).toMatchObject({
      type: "string",
      format: "date-time",
    });
  });
});

describe("tool schemas over MCP", () => {
  let server: McpServer;
  let client: Client;
  let buildApi: BuildApi;
  let workItemApi: WorkItemTrackingApi;
  let connectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let tokenProvider: jest.MockedFunction<() => Promise<string>>;

  beforeEach(async () => {
    const connection = new WebApi("https://dev.azure.com/test-org", getBearerHandler("test-token"));
    buildApi = new BuildApi(connection.serverUrl, [connection.authHandler]);
    workItemApi = new WorkItemTrackingApi(connection.serverUrl, [connection.authHandler]);
    const gitApi = new GitApi(connection.serverUrl, [connection.authHandler]);
    jest.spyOn(connection, "getBuildApi").mockResolvedValue(buildApi);
    jest.spyOn(connection, "getWorkItemTrackingApi").mockResolvedValue(workItemApi);
    jest.spyOn(connection, "getGitApi").mockResolvedValue(gitApi);
    jest.spyOn(buildApi, "getBuilds").mockResolvedValue([]);
    jest.spyOn(buildApi, "getDefinitions").mockResolvedValue([]);
    jest.spyOn(workItemApi, "getWorkItem").mockResolvedValue({ id: 42 });
    jest.spyOn(workItemApi, "getQuery").mockResolvedValue({ id: "query-id" });
    jest.spyOn(workItemApi, "updateWorkItem").mockResolvedValue({ id: 42 });
    connectionProvider = jest.fn().mockResolvedValue(connection);
    tokenProvider = jest.fn().mockResolvedValue("test-token");

    server = new McpServer({ name: "schema-test", version: "1.0.0" });
    client = new Client({ name: "schema-client", version: "1.0.0" });
    configureAllTools(server, tokenProvider, connectionProvider, () => "Jest", new Set(Object.values(Domain)));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    try {
      await client.close();
    } finally {
      await server.close();
      jest.restoreAllMocks();
    }
  });

  it("publishes every tool with its parameters and annotations without accessing Azure DevOps", async () => {
    const { tools } = await client.listTools();

    expect(tools.map(({ name }) => name).sort()).toEqual(Object.keys(TOOL_ANNOTATIONS).sort());
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object", properties: expect.any(Object) });
      expect(tool.annotations).toEqual(TOOL_ANNOTATIONS[tool.name]);
      if (tool.name !== "mcp_apps_ping") expect(Object.keys(tool.inputSchema.properties ?? {})).not.toHaveLength(0);
    }
    expect(connectionProvider).not.toHaveBeenCalled();
    expect(tokenProvider).not.toHaveBeenCalled();
  });

  it("preserves date descriptions, enum values, optionality, and patch defaults in the catalog", async () => {
    const { tools } = await client.listTools();
    expect(tools.find(({ name }) => name === "pipelines_build")?.inputSchema).toMatchObject({
      properties: {
        minTime: { type: "string", format: "date-time", description: expect.any(String) },
        maxTime: { type: "string", format: "date-time", description: expect.any(String) },
        queryOrder: { type: "string", enum: expect.arrayContaining(["FinishTimeAscending", "QueueTimeDescending"]) },
      },
      required: ["action", "project"],
    });
    expect(tools.find(({ name }) => name === "pipelines_definition")?.inputSchema).toMatchObject({
      properties: {
        minMetricsTime: { type: "string", format: "date-time", description: expect.any(String) },
        builtAfter: { type: "string", format: "date-time", description: expect.any(String) },
        notBuiltAfter: { type: "string", format: "date-time", description: expect.any(String) },
      },
      required: ["action", "project"],
    });
    expect(tools.find(({ name }) => name === "wit_work_item")?.inputSchema).toMatchObject({
      properties: { asOf: { type: "string", format: "date-time", description: expect.any(String) } },
      required: ["action"],
    });
    expect(tools.find(({ name }) => name === "wit_work_item_write")?.inputSchema).toMatchObject({
      properties: { updates: { items: { properties: { op: { type: "string", default: "add" } } } } },
    });
  });

  it.each([
    ["pipelines_build", "minTime", 4],
    ["pipelines_build", "maxTime", 5],
    ["pipelines_definition", "minMetricsTime", 7],
    ["pipelines_definition", "builtAfter", 10],
    ["pipelines_definition", "notBuiltAfter", 11],
    ["wit_work_item", "asOf", 2],
  ] as const)("converts %s.%s into a Date before calling Azure DevOps", async (name, parameter, argumentIndex) => {
    const date = "2026-10-28T13:00:00.000Z";
    const result = await client.callTool({
      name,
      arguments: { action: name === "wit_work_item" ? "get" : "list", project: "test-project", id: "42", [parameter]: date },
    });

    expect(result.isError).not.toBe(true);
    const calls =
      name === "pipelines_build"
        ? jest.mocked(buildApi.getBuilds).mock.calls
        : name === "pipelines_definition"
          ? jest.mocked(buildApi.getDefinitions).mock.calls
          : jest.mocked(workItemApi.getWorkItem).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][argumentIndex]).toEqual(new Date(date));
  });

  it("preserves numeric date coercion and omitted dates", async () => {
    const result = await client.callTool({ name: "pipelines_build", arguments: { action: "list", project: "test-project", minTime: 0 } });

    expect(result.isError).not.toBe(true);
    expect(jest.mocked(buildApi.getBuilds).mock.calls[0][4]).toEqual(new Date(0));
    expect(jest.mocked(buildApi.getBuilds).mock.calls[0][5]).toBeUndefined();
  });

  it("applies query defaults and numeric coercion before calling Azure DevOps", async () => {
    const args = { action: "get", project: "test-project", query: "query-id" };
    expect((await client.callTool({ name: "wit_query", arguments: args })).isError).not.toBe(true);
    expect(workItemApi.getQuery).toHaveBeenLastCalledWith("test-project", "query-id", undefined, 0, false, false);

    expect((await client.callTool({ name: "wit_query", arguments: { ...args, depth: "2" } })).isError).not.toBe(true);
    expect(workItemApi.getQuery).toHaveBeenLastCalledWith("test-project", "query-id", undefined, 2, false, false);
  });

  it("preserves search input transforms, numeric coercion, and defaults", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    const result = await client.callTool({ name: "search_code", arguments: { searchText: "example", project: "test-project", top: "3" } });

    expect(result.isError).not.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ searchText: "example", includeFacets: false, $skip: 0, $top: 3, filters: { Project: ["test-project"] } }),
      })
    );
  });

  it("preserves patch defaults, case normalization, nested values, and unknown-key stripping", async () => {
    const value = { rel: "Hyperlink", attributes: { comment: "Evidence", nested: [null, true, 9, { key: "value" }] } };
    const result = await client.callTool({
      name: "wit_work_item_write",
      arguments: {
        action: "update",
        id: "42",
        updates: [
          { path: "/relations/-", value, extra: "stripped" },
          { op: "REPLACE", path: "/fields/System.Title", value: "Updated" },
          { op: "REMOVE", path: "/fields/System.Description" },
        ],
      },
    });

    expect(result.isError).not.toBe(true);
    expect(workItemApi.updateWorkItem).toHaveBeenCalledWith(
      null,
      [
        { op: "add", path: "/relations/-", value },
        { op: "replace", path: "/fields/System.Title", value: "Updated" },
        { op: "remove", path: "/fields/System.Description" },
      ],
      42
    );
  });

  it.each([
    ["pipelines_build", { action: "list", project: "test-project", minTime: "not-a-date" }],
    ["pipelines_definition", { action: "list", project: "test-project", builtAfter: "not-a-date" }],
    ["wit_work_item", { action: "get", project: "test-project", id: 42, asOf: "not-a-date" }],
    ["wit_work_item_write", { action: "update", id: 42, updates: [{ op: "invalid", path: "/fields/System.Title", value: "Updated" }] }],
  ])("rejects invalid %s inputs before accessing Azure DevOps", async (name, args) => {
    const result = await client.callTool({ name, arguments: args });

    expect(result.isError).toBe(true);
    expect(connectionProvider).not.toHaveBeenCalled();
    expect(tokenProvider).not.toHaveBeenCalled();
  });
});
