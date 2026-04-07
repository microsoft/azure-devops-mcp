// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureMcpAppsTools, MCP_APPS_TOOLS } from "../../../src/tools/mcp-apps";
import * as authModule from "../../../src/tools/auth";
import { WebApi } from "azure-devops-node-api";
import fs from "node:fs/promises";

jest.mock("node:fs/promises");

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
  getWorkItemTrackingApi: jest.Mock;
  getWorkApi: jest.Mock;
  connect: jest.Mock;
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
      getWorkItemTrackingApi: jest.fn(),
      getWorkApi: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        authenticatedUser: { providerDisplayName: "Test User" },
      }),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);

    // Reset global fetch mock before each test
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ======== Tool Registration ========

  describe("tool registration", () => {
    it("registers mcp-apps tools on the server via registerTool", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.registerTool as jest.Mock).toHaveBeenCalled();
    });

    it("registers all expected tools", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const registeredNames = (server.registerTool as jest.Mock).mock.calls.map(([name]: [string]) => name);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.my_work_items);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.preview_work_items);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.get_work_item_type_icon);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.get_work_item_type_fields);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.search_identities);
    });
  });

  // ======== mcp_app_my_work_items Tool ========

  describe("mcp_app_my_work_items tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.my_work_items);
      if (!call) throw new Error("mcp_app_my_work_items tool not registered");
      const [, , handler] = call;
      return handler;
    }

    const sampleWorkItems = [
      {
        id: 1,
        fields: {
          "System.Id": 1,
          "System.Title": "Fix login bug",
          "System.State": "Active",
          "System.WorkItemType": "Bug",
          "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
          "Microsoft.VSTS.Common.Priority": 2,
          "System.Tags": "frontend; security",
        },
      },
      {
        id: 2,
        fields: {
          "System.Id": 2,
          "System.Title": "Add feature X",
          "System.State": "New",
          "System.WorkItemType": "User Story",
          "System.AssignedTo": { displayName: "Other User", uniqueName: "other@example.com" },
          "Microsoft.VSTS.Common.Priority": 3,
          "System.Tags": "backend",
        },
      },
    ];

    it("should return work items for assignedtome query", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toBeDefined();
      expect(parsed.displayConfig).toBeDefined();
    });

    it("should return empty array when no work items found", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [] }),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([]);
    });

    it("should use team iteration mode when team and iterationId are provided", async () => {
      const mockGetIterationWorkItems = jest.fn().mockResolvedValue({
        workItemRelations: [{ target: { id: 10 } }, { target: { id: 20 } }],
      });
      mockConnection.getWorkApi.mockResolvedValue({
        getIterationWorkItems: mockGetIterationWorkItems,
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 10,
            fields: {
              "System.Id": 10,
              "System.Title": "Sprint item",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", team: "MyTeam", iterationId: "iter-123", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      expect(mockGetIterationWorkItems).toHaveBeenCalledWith({ project: "TestProject", team: "MyTeam" }, "iter-123");
    });

    it("should format identity fields from objects to strings", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      const parsed = JSON.parse(result.content[0].text);
      const assignedTo = parsed.workItems[0].fields["System.AssignedTo"];
      expect(typeof assignedTo).toBe("string");
      expect(assignedTo).toContain("Test User");
    });

    it("should format custom identity fields from objects to strings", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
              "System.CreatedBy": { displayName: "Creator User", uniqueName: "creator@example.com" },
              "Custom.Reviewer": { displayName: "Reviewer User", uniqueName: "reviewer@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      const parsed = JSON.parse(result.content[0].text);
      const wi = parsed.workItems[0];
      // All identity fields should be converted to strings
      expect(typeof wi.fields["System.CreatedBy"]).toBe("string");
      expect(wi.fields["System.CreatedBy"]).toContain("Creator User");
      expect(typeof wi.fields["Custom.Reviewer"]).toBe("string");
      expect(wi.fields["Custom.Reviewer"]).toContain("Reviewer User");
    });

    it("should include displayConfig when columns, sort, suggestedValues are provided", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const columns = [{ field: "System.Id", label: "ID" }];
      const sort = { field: "System.Id", direction: "asc" as const };
      const suggestedValues = [{ workItemId: 1, field: "Microsoft.VSTS.Common.Priority", value: 1 }];

      const handler = getHandler();
      const result = await handler({
        project: "TestProject",
        type: "assignedtome",
        top: 50,
        includeCompleted: false,
        columns,
        sort,
        suggestedValues,
        pageSize: 25,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.displayConfig.columns).toEqual(columns);
      expect(parsed.displayConfig.sort).toEqual(sort);
      expect(parsed.displayConfig.suggestedValues).toEqual(suggestedValues);
      expect(parsed.displayConfig.pageSize).toBe(25);
    });

    it("should handle connection errors", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection failed"));

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving work items");
    });

    it("should return all fields including custom fields in a single batch call", async () => {
      const mockGetWorkItemsBatch = jest.fn().mockResolvedValue([
        {
          id: 1,
          fields: {
            "System.Id": 1,
            "System.Title": "Test",
            "System.State": "Active",
            "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            "Custom.BusinessValue": "High",
            "Custom.ReleaseTarget": "v2.0",
          },
        },
      ]);

      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: mockGetWorkItemsBatch,
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toHaveLength(1);
      // Custom fields are preserved in the result
      expect(parsed.workItems[0].fields["Custom.BusinessValue"]).toBe("High");
      expect(parsed.workItems[0].fields["Custom.ReleaseTarget"]).toBe("v2.0");
      // Only one batch call made (no separate extended fields call)
      expect(mockGetWorkItemsBatch).toHaveBeenCalledTimes(1);
    });

    it("should apply top limit for team iteration queries", async () => {
      const manyIds = Array.from({ length: 100 }, (_, i) => ({ target: { id: i + 1 } }));
      mockConnection.getWorkApi.mockResolvedValue({
        getIterationWorkItems: jest.fn().mockResolvedValue({ workItemRelations: manyIds }),
      });
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: mockBatch,
      });

      const handler = getHandler();
      await handler({ project: "TestProject", team: "MyTeam", iterationId: "iter-123", top: 5, includeCompleted: false, pageSize: 10 });

      // The IDs passed to getWorkItemsBatch should be limited to 5
      const callArgs = mockBatch.mock.calls[0][0];
      expect(callArgs.ids).toHaveLength(5);
    });

    it("should filter by stateFilter", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, stateFilter: ["Active"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["System.State"] === "Active")).toBe(true);
    });

    it("should filter by workItemType", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, workItemType: ["Bug"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["System.WorkItemType"] === "Bug")).toBe(true);
    });

    it("should filter by tags", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, tags: ["security"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBeGreaterThan(0);
      parsed.workItems.forEach((wi: any) => {
        expect(wi.fields["System.Tags"].toLowerCase()).toContain("security");
      });
    });

    it("should filter by priorityFilter", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, priorityFilter: [2] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["Microsoft.VSTS.Common.Priority"] === 2)).toBe(true);
    });

    it("should filter by searchText matching title", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, searchText: "login" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
      expect(parsed.workItems[0].fields["System.Title"]).toContain("login");
    });

    it("should filter by areaPath prefix", async () => {
      const wiWithArea = [
        { id: 1, fields: { ...sampleWorkItems[0].fields, "System.AreaPath": "Project\\Team\\Frontend", "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" } } },
        { id: 2, fields: { ...sampleWorkItems[1].fields, "System.AreaPath": "Project\\Other", "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" } } },
      ];
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(wiWithArea),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, areaPath: "Project\\Team" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
    });

    it("should filter by iterationPath prefix", async () => {
      const wiWithIter = [
        { id: 1, fields: { ...sampleWorkItems[0].fields, "System.IterationPath": "Project\\Sprint 1", "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" } } },
        { id: 2, fields: { ...sampleWorkItems[1].fields, "System.IterationPath": "Project\\Sprint 2", "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" } } },
      ];
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(wiWithIter),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10, iterationPath: "Project\\Sprint 1" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
    });

    it("should use customDisplayName fallback when providerDisplayName is absent", async () => {
      mockConnection.connect.mockResolvedValue({
        authenticatedUser: { customDisplayName: "Custom User" },
      });
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Custom User", uniqueName: "custom@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toBeDefined();
    });

    it("should handle query results as direct array", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toHaveLength(1);
    });

    it("should handle query results in results property", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toHaveLength(1);
    });

    it("should handle null workItems from batch API", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(null),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toEqual([]);
    });

    it("should handle non-Error thrown exceptions", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue("string error");

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });

    it("should handle identity field with only displayName and no uniqueName", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems[0].fields["System.AssignedTo"]).toBe("Test User");
    });

    it("should handle work item with no fields property", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([{ id: 1 }]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      expect(result.isError).toBeUndefined();
    });

    it("should omit displayConfig keys that are not provided", async () => {
      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.displayConfig.columns).toBeUndefined();
      expect(parsed.displayConfig.sort).toBeUndefined();
      expect(parsed.displayConfig.suggestedValues).toBeUndefined();
    });
  });

  // ======== get_work_item_type_icon Tool ========

  describe("get_work_item_type_icon tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.get_work_item_type_icon);
      if (!call) throw new Error("mcp_app_get_work_item_type_icon tool not registered");
      const [, , handler] = call;
      return handler;
    }

    it("should return SVG icon for a valid work item type", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7"/></svg>';
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockResolvedValue({
          icon: { url: "https://dev.azure.com/_apis/wit/workItemTypeIcons/icon_bug" },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(svgContent),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItemType).toBe("Bug");
      expect(parsed.svg).toBe(svgContent);
    });

    it("should return error when icon URL is not found", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockResolvedValue({ icon: {} }),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "UnknownType" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No icon URL found");
    });

    it("should return error when icon fetch fails", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockResolvedValue({
          icon: { url: "https://dev.azure.com/_apis/wit/workItemTypeIcons/icon_bug" },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to fetch icon");
    });

    it("should pass correct auth headers when fetching icon", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockResolvedValue({
          icon: { url: "https://dev.azure.com/_apis/wit/workItemTypeIcons/icon_task" },
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("<svg></svg>"),
      });

      const handler = getHandler();
      await handler({ project: "TestProject", workItemType: "Task" });

      const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchOptions.headers["Authorization"]).toBe("Bearer test-token");
      expect(fetchOptions.headers["User-Agent"]).toBe("Jest");
    });

    it("should handle API errors correctly", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockRejectedValue(new Error("API unavailable")),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving work item type icon");
    });

    it("should handle non-Error thrown exceptions", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockRejectedValue("unexpected"),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });

    it("should return error when icon object is missing", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemType: jest.fn().mockResolvedValue({}),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No icon URL found");
    });
  });

  // ======== mcp_app_get_work_item_type_fields Tool ========

  describe("mcp_app_get_work_item_type_fields tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.get_work_item_type_fields);
      if (!call) throw new Error("mcp_app_get_work_item_type_fields tool not registered");
      const [, , handler] = call;
      return handler;
    }

    it("should return field definitions with allowed values", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemTypeFieldsWithReferences: jest.fn().mockResolvedValue([
          { referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: [1, 2, 3, 4] },
          { referenceName: "Microsoft.VSTS.Common.Severity", name: "Severity", allowedValues: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"] },
          { referenceName: "System.Title", name: "Title", allowedValues: [] },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBeUndefined();
      const fields = JSON.parse(result.content[0].text);
      expect(fields).toHaveLength(3);
      // Integer allowed values should be converted to strings
      expect(fields[0].allowedValues).toEqual(["1", "2", "3", "4"]);
      expect(fields[1].allowedValues).toEqual(["1 - Critical", "2 - High", "3 - Medium", "4 - Low"]);
      expect(fields[2].allowedValues).toEqual([]);
    });

    it("should handle null response gracefully", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemTypeFieldsWithReferences: jest.fn().mockResolvedValue(null),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBeUndefined();
      const fields = JSON.parse(result.content[0].text);
      expect(fields).toEqual([]);
    });

    it("should handle API errors", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemTypeFieldsWithReferences: jest.fn().mockRejectedValue(new Error("API Error")),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving field definitions");
    });

    it("should be registered as an app tool", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const registeredNames = (server.registerTool as jest.Mock).mock.calls.map(([name]: [string]) => name);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.get_work_item_type_fields);
    });

    it("should handle fields with missing referenceName and name", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemTypeFieldsWithReferences: jest.fn().mockResolvedValue([{ allowedValues: ["a", "b"] }, { referenceName: "System.Title", name: "Title" }]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBeUndefined();
      const fields = JSON.parse(result.content[0].text);
      expect(fields[0].referenceName).toBe("");
      expect(fields[0].name).toBe("");
      expect(fields[0].allowedValues).toEqual(["a", "b"]);
      expect(fields[1].allowedValues).toEqual([]);
    });

    it("should handle non-Error thrown exceptions", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemTypeFieldsWithReferences: jest.fn().mockRejectedValue(42),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", workItemType: "Bug" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });
  });

  // ======== Work Items App Resource ========

  describe("work items app resource", () => {
    function getResourceHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.resource as jest.Mock).mock.calls[0];
      if (!call) throw new Error("resource not registered");
      // registerAppResource passes: name, uri, config, readCallback
      const readCallback = call[3];
      return readCallback;
    }

    it("should return fallback HTML when app file is not found", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));

      const handler = getResourceHandler();
      const result = await handler();

      expect(result.contents).toBeDefined();
      expect(result.contents[0].text).toContain("Work Items App UI not built");
    });

    it("should return HTML content when app file exists", async () => {
      const htmlContent = "<html><body>Work Items App</body></html>";
      (fs.readFile as jest.Mock).mockResolvedValue(htmlContent);

      const handler = getResourceHandler();
      const result = await handler();

      expect(result.contents).toBeDefined();
      expect(result.contents[0].text).toBe(htmlContent);
    });
  });

  // ======== mcp_app_search_identities Tool ========

  describe("mcp_app_search_identities tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.search_identities);
      if (!call) throw new Error("mcp_app_search_identities tool not registered");
      const [, , handler] = call;
      return handler;
    }

    it("should return identities from search results", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "Jane Doe",
            properties: {
              SchemaClassName: { $type: "System.String", $value: "User" },
              Mail: { $type: "System.String", $value: "jane@example.com" },
            },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "Jane" });

      expect(result.isError).toBeUndefined();
      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(1);
      expect(identities[0].displayName).toBe("Jane Doe");
      expect(identities[0].mail).toBe("jane@example.com");
    });

    it("should filter out groups", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "Jane Doe",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
          {
            id: "id-2",
            providerDisplayName: "Project Admins",
            properties: { SchemaClassName: { $type: "System.String", $value: "Group" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "Jane" });

      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(1);
      expect(identities[0].displayName).toBe("Jane Doe");
    });

    it("should search multiple terms and deduplicate", async () => {
      const searchSpy = jest.spyOn(authModule, "searchIdentities");
      searchSpy.mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "Jane Doe",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "Jane Doe" });

      // Should be called for "Jane Doe", "Jane", and "Doe"
      expect(searchSpy).toHaveBeenCalledTimes(3);
      const identities = JSON.parse(result.content[0].text);
      // Deduplicated by id
      expect(identities).toHaveLength(1);
    });

    it("should return empty results when all term searches fail", async () => {
      jest.spyOn(authModule, "searchIdentities").mockRejectedValue(new Error("Network error"));

      const handler = getHandler();
      const result = await handler({ query: "test" });

      // Individual term failures are caught silently, returns empty array
      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(0);
    });

    it("should handle empty results", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({ value: [] } as any);

      const handler = getHandler();
      const result = await handler({ query: "nonexistent" });

      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(0);
    });

    it("should sort results prioritizing full query match", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "Bob Smith",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
          {
            id: "id-2",
            providerDisplayName: "Jane Smith",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "Jane" });

      const identities = JSON.parse(result.content[0].text);
      expect(identities[0].displayName).toBe("Jane Smith");
    });

    it("should sort alphabetically when both results equally match query", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "Zoe Smith",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
          {
            id: "id-2",
            providerDisplayName: "Alice Smith",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "Smith" });

      const identities = JSON.parse(result.content[0].text);
      // Both match "Smith", so they should be sorted alphabetically
      expect(identities[0].displayName).toBe("Alice Smith");
      expect(identities[1].displayName).toBe("Zoe Smith");
    });

    it("should handle outer error in search_identities", async () => {
      // Trigger the outer catch by causing the sort comparator to fail
      // We do this by injecting a value with displayName = undefined via prototype pollution
      const searchSpy = jest.spyOn(authModule, "searchIdentities");
      let callCount = 0;
      searchSpy.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Return valid data on first call, but poison the Map afterward
          return {
            value: [
              {
                id: "id-1",
                providerDisplayName: "User",
                properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
              },
            ],
          } as any;
        }
        return { value: [] } as any;
      });

      // Override Map to throw during values() iteration to trigger outer catch
      const OriginalMap = global.Map;
      const MockMap = class extends OriginalMap {
        values(): never {
          throw new Error("Map iteration failed");
        }
      };
      global.Map = MockMap as any;

      const handler = getHandler();
      const result = await handler({ query: "User" });

      global.Map = OriginalMap;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error searching identities");
    });

    it("should handle non-Error thrown in outer search_identities catch", async () => {
      // Override Map to throw a non-Error during values() iteration
      const OriginalMap = global.Map;
      const MockMap = class extends OriginalMap {
        values(): never {
          throw 42;
        }
      };
      global.Map = MockMap as any;

      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: "id-1",
            providerDisplayName: "User",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "User" });

      global.Map = OriginalMap;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });

    it("should skip identities without id or providerDisplayName", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue({
        value: [
          {
            id: null,
            providerDisplayName: "No ID User",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
          {
            id: "id-1",
            providerDisplayName: null,
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
          {
            id: "id-2",
            providerDisplayName: "Valid User",
            properties: { SchemaClassName: { $type: "System.String", $value: "User" } },
          },
        ],
      } as any);

      const handler = getHandler();
      const result = await handler({ query: "user" });

      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(1);
      expect(identities[0].displayName).toBe("Valid User");
    });

    it("should handle null result from searchIdentities", async () => {
      jest.spyOn(authModule, "searchIdentities").mockResolvedValue(null as any);

      const handler = getHandler();
      const result = await handler({ query: "test" });

      const identities = JSON.parse(result.content[0].text);
      expect(identities).toHaveLength(0);
    });
  });

  // ======== mcp_app_preview_work_items Tool ========

  describe("mcp_app_preview_work_items tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.preview_work_items);
      if (!call) throw new Error("mcp_app_preview_work_items tool not registered");
      const [, , handler] = call;
      return handler;
    }

    const sampleWorkItems = [
      {
        id: 1,
        fields: {
          "System.Id": 1,
          "System.Title": "Fix login bug",
          "System.State": "Active",
          "System.WorkItemType": "Bug",
          "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
          "Microsoft.VSTS.Common.Priority": 2,
          "System.Tags": "frontend; security",
        },
      },
      {
        id: 2,
        fields: {
          "System.Id": 2,
          "System.Title": "Add feature X",
          "System.State": "New",
          "System.WorkItemType": "User Story",
          "System.AssignedTo": { displayName: "Other User", uniqueName: "other@example.com" },
          "Microsoft.VSTS.Common.Priority": 3,
          "System.Tags": "backend",
        },
      },
    ];

    it("should be registered as a tool", () => {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const registeredNames = (server.registerTool as jest.Mock).mock.calls.map(([name]: [string]) => name);
      expect(registeredNames).toContain(MCP_APPS_TOOLS.preview_work_items);
    });

    it("should return work items for provided IDs", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toBeDefined();
      expect(parsed.workItems).toHaveLength(2);
      expect(parsed.displayConfig).toBeDefined();
    });

    it("should not filter by current user", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10 });

      const parsed = JSON.parse(result.content[0].text);
      // Both items should be present regardless of who they are assigned to
      expect(parsed.workItems).toHaveLength(2);
      const assignees = parsed.workItems.map((wi: any) => wi.fields["System.AssignedTo"]);
      expect(assignees).toContain("Test User <test@example.com>");
      expect(assignees).toContain("Other User <other@example.com>");
    });

    it("should format identity fields from objects to strings", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          {
            id: 1,
            fields: {
              "System.Id": 1,
              "System.Title": "Test",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
              "System.CreatedBy": { displayName: "Creator", uniqueName: "creator@example.com" },
            },
          },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1], pageSize: 10 });

      const parsed = JSON.parse(result.content[0].text);
      expect(typeof parsed.workItems[0].fields["System.AssignedTo"]).toBe("string");
      expect(typeof parsed.workItems[0].fields["System.CreatedBy"]).toBe("string");
    });

    it("should include displayConfig when columns, sort, suggestedValues are provided", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const columns = [{ field: "System.Id", label: "ID" }];
      const sort = { field: "System.Id", direction: "asc" as const };
      const suggestedValues = [{ workItemId: 1, field: "Microsoft.VSTS.Common.Priority", value: 1 }];

      const handler = getHandler();
      const result = await handler({
        project: "TestProject",
        ids: [1, 2],
        columns,
        sort,
        suggestedValues,
        pageSize: 25,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.displayConfig.columns).toEqual(columns);
      expect(parsed.displayConfig.sort).toEqual(sort);
      expect(parsed.displayConfig.suggestedValues).toEqual(suggestedValues);
      expect(parsed.displayConfig.pageSize).toBe(25);
    });

    it("should filter by stateFilter", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, stateFilter: ["Active"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["System.State"] === "Active")).toBe(true);
    });

    it("should filter by workItemType", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, workItemType: ["Bug"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["System.WorkItemType"] === "Bug")).toBe(true);
    });

    it("should filter by tags", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, tags: ["security"] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBeGreaterThan(0);
      parsed.workItems.forEach((wi: any) => {
        expect(wi.fields["System.Tags"].toLowerCase()).toContain("security");
      });
    });

    it("should filter by priorityFilter", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, priorityFilter: [2] });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.every((wi: any) => wi.fields["Microsoft.VSTS.Common.Priority"] === 2)).toBe(true);
    });

    it("should handle connection errors", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue(new Error("Connection failed"));

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1], pageSize: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error previewing work items");
    });

    it("should pass IDs directly to getWorkItemsBatch", async () => {
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: mockBatch,
      });

      const handler = getHandler();
      await handler({ project: "TestProject", ids: [10, 20, 30], pageSize: 10 });

      expect(mockBatch).toHaveBeenCalledWith({ ids: [10, 20, 30], $expand: 2 }, "TestProject");
    });

    it("should not call connect() for user resolution", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      await handler({ project: "TestProject", ids: [1, 2], pageSize: 10 });

      // preview_work_items should not need to resolve the current user
      expect(mockConnection.connect).not.toHaveBeenCalled();
    });

    it("should handle null workItems from batch API", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(null),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1], pageSize: 10 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toEqual([]);
    });

    it("should handle non-Error thrown exceptions", async () => {
      (connectionProvider as jest.Mock).mockRejectedValue("string error");

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1], pageSize: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });

    it("should handle work items with no fields property", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10 });

      expect(result.isError).toBeUndefined();
    });

    it("should filter by searchText", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue(sampleWorkItems),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, searchText: "login" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
      expect(parsed.workItems[0].fields["System.Title"]).toContain("login");
    });

    it("should filter by areaPath prefix", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          { id: 1, fields: { ...sampleWorkItems[0].fields, "System.AreaPath": "Project\\Team\\Frontend" } },
          { id: 2, fields: { ...sampleWorkItems[1].fields, "System.AreaPath": "Project\\Other" } },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, areaPath: "Project\\Team" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
    });

    it("should filter by iterationPath prefix", async () => {
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: jest.fn().mockResolvedValue([
          { id: 1, fields: { ...sampleWorkItems[0].fields, "System.IterationPath": "Project\\Sprint 1" } },
          { id: 2, fields: { ...sampleWorkItems[1].fields, "System.IterationPath": "Project\\Sprint 2" } },
        ]),
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", ids: [1, 2], pageSize: 10, iterationPath: "Project\\Sprint 1" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems.length).toBe(1);
    });
  });
});
