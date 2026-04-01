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
      expect(registeredNames).toContain(MCP_APPS_TOOLS.get_work_item_type_icon);
    });
  });

  // ======== mcp_my_work_items Tool ========

  describe("mcp_my_work_items tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.my_work_items);
      if (!call) throw new Error("mcp_my_work_items tool not registered");
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

    it("should gracefully handle extended field fetch failures", async () => {
      const mockGetWorkItemsBatch = jest.fn();
      // First call succeeds (core fields), second call fails (extended fields)
      mockGetWorkItemsBatch.mockResolvedValueOnce([
        {
          id: 1,
          fields: {
            "System.Id": 1,
            "System.Title": "Test",
            "System.State": "Active",
            "System.AssignedTo": { displayName: "Test User", uniqueName: "test@example.com" },
          },
        },
      ]);
      mockGetWorkItemsBatch.mockRejectedValueOnce(new Error("Extended fields not available"));

      mockConnection.getWorkApi.mockResolvedValue({
        getPredefinedQueryResults: jest.fn().mockResolvedValue({ workItems: [{ id: 1 }] }),
      });
      mockConnection.getWorkItemTrackingApi.mockResolvedValue({
        getWorkItemsBatch: mockGetWorkItemsBatch,
      });

      const handler = getHandler();
      const result = await handler({ project: "TestProject", type: "assignedtome", top: 50, includeCompleted: false, pageSize: 10 });

      // Should still succeed despite extended field failure
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.workItems).toHaveLength(1);
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
  });

  // ======== get_work_item_type_icon Tool ========

  describe("get_work_item_type_icon tool", () => {
    function getHandler() {
      configureMcpAppsTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.registerTool as jest.Mock).mock.calls.find(([toolName]: [string]) => toolName === MCP_APPS_TOOLS.get_work_item_type_icon);
      if (!call) throw new Error("wit_get_work_item_type_icon tool not registered");
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
  });
});
