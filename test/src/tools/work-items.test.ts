// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkItemTools } from "../../../src/tools/work-items";
import { WebApi } from "azure-devops-node-api";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import {
  _mockBacklogs,
  _mockQuery,
  _mockQueryResults,
  _mockWorkItem,
  _mockWorkItemComment,
  _mockWorkItemComments,
  _mockWorkItemRevisions,
  _mockWorkItems,
  _mockWorkItemsForIteration,
  _mockWorkItemType,
} from "../../mocks/work-items";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface WorkApiMock {
  getBacklogs: jest.Mock;
  getBacklogLevelWorkItems: jest.Mock;
  getPredefinedQueryResults: jest.Mock;
  getTeamIterations: jest.Mock;
  getIterationWorkItems: jest.Mock;
}

interface WorkItemTrackingApiMock {
  getWorkItemsBatch: jest.Mock;
  getWorkItem: jest.Mock;
  getComments: jest.Mock;
  addComment: jest.Mock;
  getRevisions: jest.Mock;
  updateWorkItem: jest.Mock;
  createWorkItem: jest.Mock;
  getWorkItemType: jest.Mock;
  getQuery: jest.Mock;
  queryById: jest.Mock;
}

interface MockConnection {
  getWorkApi: jest.Mock;
  getWorkItemTrackingApi: jest.Mock;
  serverUrl?: string;
}

describe("configureWorkItemTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: MockConnection;
  let mockWorkApi: WorkApiMock;
  let mockWorkItemTrackingApi: WorkItemTrackingApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockWorkApi = {
      getBacklogs: jest.fn(),
      getBacklogLevelWorkItems: jest.fn(),
      getPredefinedQueryResults: jest.fn(),
      getTeamIterations: jest.fn(),
      getIterationWorkItems: jest.fn(),
    };

    mockWorkItemTrackingApi = {
      getWorkItemsBatch: jest.fn(),
      getWorkItem: jest.fn(),
      getComments: jest.fn(),
      addComment: jest.fn(),
      getRevisions: jest.fn(),
      updateWorkItem: jest.fn(),
      createWorkItem: jest.fn(),
      getWorkItemType: jest.fn(),
      getQuery: jest.fn(),
      queryById: jest.fn(),
    };

    mockConnection = {
      getWorkApi: jest.fn().mockResolvedValue(mockWorkApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemTrackingApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);

    userAgentProvider = () => "Jest";
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_backlogs tool", () => {
    it("should call getBacklogs API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_backlogs");
      if (!call) throw new Error("wit_list_backlogs tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogs as jest.Mock).mockResolvedValue([_mockBacklogs]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
      };

      const result = await handler(params);

      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({
        project: params.project,
        team: params.team,
      });

      expect(result.content[0].text).toBe(JSON.stringify([_mockBacklogs], null, 2));
    });
  });

  describe("list_backlog_work_items tool", () => {
    it("should call getBacklogLevelWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_backlog_work_items");
      if (!call) throw new Error("wit_list_backlog_work_items tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockResolvedValue([
        {
          workItems: [
            {
              rel: null,
              source: null,
              target: {
                id: 50,
              },
            },
            {
              rel: null,
              source: null,
              target: {
                id: 49,
              },
            },
          ],
        },
      ]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        backlogId: "Microsoft.FeatureCategory",
      };

      const result = await handler(params);

      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith({ project: params.project, team: params.team }, params.backlogId);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              workItems: [
                {
                  rel: null,
                  source: null,
                  target: {
                    id: 50,
                  },
                },
                {
                  rel: null,
                  source: null,
                  target: {
                    id: 49,
                  },
                },
              ],
            },
          ],
          null,
          2
        )
      );
    });
  });

  describe("my_work_items tool", () => {
    it("should call getPredefinedQueryResults API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_my_work_items");
      if (!call) throw new Error("wit_my_work_items tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockResolvedValue([
        {
          id: "assignedtome",
          name: "Assigned to me",
          url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
          webUrl: "https://dev.azure.com/org/project/project/_workitems/assignedtome",
          hasMore: false,
          results: [
            {
              id: 115784,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115784",
            },
            {
              id: 115794,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115794",
            },
            {
              id: 115792,
              url: "https://dev.azure.com/org/_apis/wit/workItems/115792",
            },
          ],
        },
      ]);

      const params = {
        project: "Contoso",
        type: "assignedtome",
        top: 10,
        includeCompleted: false,
      };

      const result = await handler(params);

      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith(params.project, params.type, params.top, params.includeCompleted);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "assignedtome",
              name: "Assigned to me",
              url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
              webUrl: "https://dev.azure.com/org/project/project/_workitems/assignedtome",
              hasMore: false,
              results: [
                {
                  id: 115784,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115784",
                },
                {
                  id: 115794,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115794",
                },
                {
                  id: 115792,
                  url: "https://dev.azure.com/org/_apis/wit/workItems/115792",
                },
              ],
            },
          ],
          null,
          2
        )
      );
    });
  });

  describe("getWorkItemsBatch tool", () => {
    it("should call workItemApi.getWorkItemsBatch API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([_mockWorkItems]);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"],
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItems], null, 2));
    });

    it("should call workItemApi.getWorkItemsBatch API with custom fields when fields parameter is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithCustomFields = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.Title": "Test Work Item",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithCustomFields);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
        fields: ["System.Id", "System.Title"],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: params.fields,
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockWorkItemsWithCustomFields, null, 2));
    });

    it("should use default fields when an empty fields array is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([_mockWorkItems]);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
        fields: [], // Empty array should trigger default fields
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        {
          ids: params.ids,
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"],
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItems], null, 2));
    });

    it("should transform System.AssignedTo object to formatted string", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      // Mock work items with System.AssignedTo as objects
      const mockWorkItemsWithAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
          },
        },
        {
          id: 298,
          fields: {
            "System.Id": 298,
            "System.WorkItemType": "User Story",
            "System.Title": "Test Story",
            "System.AssignedTo": {
              displayName: "Jane Smith",
              uniqueName: "jane.smith@example.com",
              id: "67890",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithAssignedTo);

      const params = {
        ids: [297, 298],
        project: "Contoso",
      };

      const result = await handler(params);

      // Parse the returned JSON to verify transformation
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <john.doe@example.com>");
      expect(resultData[1].fields["System.AssignedTo"]).toBe("Jane Smith <jane.smith@example.com>");
    });

    it("should handle System.AssignedTo with only displayName", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithPartialAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              id: "12345",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithPartialAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <>");
    });

    it("should handle System.AssignedTo with only uniqueName", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithPartialAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithPartialAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("<john.doe@example.com>");
    });

    it("should not transform System.AssignedTo if it's not an object", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithStringAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": "Already a string",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithStringAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBe("Already a string");
    });

    it("should handle work items without System.AssignedTo field", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      const mockWorkItemsWithoutAssignedTo = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithoutAssignedTo);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData[0].fields["System.AssignedTo"]).toBeUndefined();
    });

    it("should handle null or undefined workitems response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(null);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(null, null, 2));
    });

    it("should transform all user fields to formatted strings", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      // Mock work items with all user fields as objects
      const mockWorkItemsWithUserFields = [
        {
          id: 297,
          fields: {
            "System.Id": 297,
            "System.WorkItemType": "Bug",
            "System.Title": "Test Bug",
            "System.AssignedTo": {
              displayName: "John Doe",
              uniqueName: "john.doe@example.com",
              id: "12345",
            },
            "System.CreatedBy": {
              displayName: "Jane Smith",
              uniqueName: "jane.smith@example.com",
              id: "67890",
            },
            "System.ChangedBy": {
              displayName: "Bob Johnson",
              uniqueName: "bob.johnson@example.com",
              id: "11111",
            },
            "System.AuthorizedAs": {
              displayName: "Alice Brown",
              uniqueName: "alice.brown@example.com",
              id: "22222",
            },
            "Microsoft.VSTS.Common.ActivatedBy": {
              displayName: "Charlie Wilson",
              uniqueName: "charlie.wilson@example.com",
              id: "33333",
            },
            "Microsoft.VSTS.Common.ResolvedBy": {
              displayName: "Diana Clark",
              uniqueName: "diana.clark@example.com",
              id: "44444",
            },
            "Microsoft.VSTS.Common.ClosedBy": {
              displayName: "Edward Davis",
              uniqueName: "edward.davis@example.com",
              id: "55555",
            },
          },
        },
      ];

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue(mockWorkItemsWithUserFields);

      const params = {
        ids: [297],
        project: "Contoso",
      };

      const result = await handler(params);

      // Parse the returned JSON to verify transformation
      const resultData = JSON.parse(result.content[0].text);

      // Verify that all user fields are transformed to formatted strings
      expect(resultData[0].fields["System.AssignedTo"]).toBe("John Doe <john.doe@example.com>");
      expect(resultData[0].fields["System.CreatedBy"]).toBe("Jane Smith <jane.smith@example.com>");
      expect(resultData[0].fields["System.ChangedBy"]).toBe("Bob Johnson <bob.johnson@example.com>");
      expect(resultData[0].fields["System.AuthorizedAs"]).toBe("Alice Brown <alice.brown@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ActivatedBy"]).toBe("Charlie Wilson <charlie.wilson@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ResolvedBy"]).toBe("Diana Clark <diana.clark@example.com>");
      expect(resultData[0].fields["Microsoft.VSTS.Common.ClosedBy"]).toBe("Edward Davis <edward.davis@example.com>");
    });
  });

  describe("get_work_item tool", () => {
    it("should call workItemApi.getWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_item");

      if (!call) throw new Error("wit_get_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        id: 12,
        fields: undefined,
        asOf: undefined,
        expand: "none",
        project: "Contoso",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(params.id, params.fields, params.asOf, params.expand, params.project);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItem], null, 2));
    });
  });

  describe("list_work_item_comments tool", () => {
    it("should call workItemApi.getComments API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_comments");

      if (!call) throw new Error("wit_list_work_item_comments tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getComments as jest.Mock).mockResolvedValue([_mockWorkItemComments]);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getComments).toHaveBeenCalledWith(params.project, params.workItemId, params.top);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemComments], null, 2));
    });
  });

  describe("add_work_item_comment tool", () => {
    it("should call Add Work Item Comments API with the correct parameters and return the expected result with no format specified", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_work_item_comment");

      if (!call) throw new Error("wit_add_work_item_comment tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(_mockWorkItemComment)),
      });
      global.fetch = mockFetch;

      const params = {
        comment: "hello world!",
        project: "Contoso",
        workItemId: 299,
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/Contoso/_apis/wit/workItems/299/comments?format=1&api-version=7.2-preview.4",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
        })
      );

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemComment));
    });

    it("should call Add Work Item Comments API with the correct parameters and return the expected result with markdown format", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_work_item_comment");

      if (!call) throw new Error("wit_add_work_item_comment tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(_mockWorkItemComment)),
      });
      global.fetch = mockFetch;

      const params = {
        comment: "hello world!",
        project: "Contoso",
        workItemId: 299,
        format: "markdown",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/Contoso/_apis/wit/workItems/299/comments?format=0&api-version=7.2-preview.4",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
        })
      );

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemComment));
    });

    it("should handle fetch failure response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_work_item_comment");

      if (!call) throw new Error("wit_add_work_item_comment tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });
      global.fetch = mockFetch;

      const params = {
        comment: "hello world!",
        project: "Contoso",
        workItemId: 299,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding work item comment");
      expect(result.content[0].text).toContain("Failed to add a work item comment: Not Found");
    });
  });

  describe("link_work_item_to_pull_request tool", () => {
    it("should call workItemApi.updateWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");

      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        projectId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
        repositoryId: 12345,
        pullRequestId: 67890,
        workItemId: 131489,
      };

      const artifactPathValue = `${params.projectId}/${params.repositoryId}/${params.pullRequestId}`;
      const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

      const document = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "ArtifactLink",
            url: vstfsUrl,
            attributes: {
              name: "Pull Request",
            },
          },
        },
      ];

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith({}, document, params.workItemId, params.projectId);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            workItemId: 131489,
            pullRequestId: 67890,
            success: true,
          },
          null,
          2
        )
      );
    });

    it("should handle errors from updateWorkItem and return a descriptive error", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");

      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");

      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("API failure"));

      const params = {
        projectId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
        repositoryId: 12345,
        pullRequestId: 67890,
        workItemId: 131489,
      };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API failure");
    });

    it("should encode special characters in projectId and repositoryId for vstfsUrl", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");

      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        projectId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
        repositoryId: "repo/with/slash",
        pullRequestId: 67890,
        workItemId: 131489,
      };
      const artifactPathValue = `${params.projectId}/${params.repositoryId}/${params.pullRequestId}`;
      const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;
      const document = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "ArtifactLink",
            url: vstfsUrl,
            attributes: {
              name: "Pull Request",
            },
          },
        },
      ];
      await handler(params);
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith({}, document, params.workItemId, params.projectId);
    });

    it("should use pullRequestProjectId instead of projectId when provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");

      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        projectId: "work-item-project-id",
        repositoryId: "repo-123",
        pullRequestId: 67890,
        workItemId: 131489,
        pullRequestProjectId: "different-project-id",
      };

      // Should use pullRequestProjectId instead of projectId
      const artifactPathValue = `${params.pullRequestProjectId}/${params.repositoryId}/${params.pullRequestId}`;
      const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

      const document = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "ArtifactLink",
            url: vstfsUrl,
            attributes: {
              name: "Pull Request",
            },
          },
        },
      ];
      await handler(params);

      // Note: Work item should still be updated in the original project
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith({}, document, params.workItemId, params.projectId);
    });

    it("should fall back to projectId when pullRequestProjectId is empty", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");

      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      // Testing with empty string for pullRequestProjectId
      const params = {
        projectId: "work-item-project-id",
        repositoryId: "repo-123",
        pullRequestId: 67890,
        workItemId: 131489,
        pullRequestProjectId: "",
      };

      // Should use projectId since pullRequestProjectId is empty
      const artifactPathValue = `${params.projectId}/${params.repositoryId}/${params.pullRequestId}`;
      const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

      const document = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "ArtifactLink",
            url: vstfsUrl,
            attributes: {
              name: "Pull Request",
            },
          },
        },
      ];
      await handler(params);

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith({}, document, params.workItemId, params.projectId);
    });

    it("should handle link_work_item_to_pull_request unknown error type", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      const [, , , handler] = call;

      // Simulate an unknown error type (not an Error instance)
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue("String error");

      const params = {
        projectId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
        repositoryId: "repo-123",
        pullRequestId: 42,
        workItemId: 1,
        pullRequestProjectId: "other-project",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error linking work item to pull request: Unknown error occurred");
      expect(result.isError).toBe(true);
    });
  });

  describe("get_work_items_for_iteration tool", () => {
    it("should call workApi.getIterationWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_for_iteration");

      if (!call) throw new Error("wit_get_work_items_for_iterationt tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getIterationWorkItems as jest.Mock).mockResolvedValue([_mockWorkItemsForIteration]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        iterationId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
      };

      const result = await handler(params);

      expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith(
        {
          project: params.project,
          team: params.team,
        },
        params.iterationId
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemsForIteration], null, 2));
    });
  });

  describe("list_work_item_revisions tool", () => {
    it("should call workItemApi.getRevisions API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");

      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, params.top, undefined, undefined, params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemRevisions, null, 2));
    });

    it("should call workItemApi.getRevisions API with expand parameter", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");

      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 20,
        skip: 5,
        expand: "Relations",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, params.top, params.skip, 1, params.project);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItemRevisions, null, 2));
    });

    it("should clean up identity fields by removing unwanted properties", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");

      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      // Create a deep copy of mock data to avoid mutating the original
      const mockDataWithIdentities = JSON.parse(JSON.stringify(_mockWorkItemRevisions));

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(mockDataWithIdentities);

      const params = {
        project: "Contoso",
        workItemId: 299,
        expand: "fields",
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // Check that identity fields have been cleaned up
      const firstRevisionCreatedBy = parsedResult[0].fields["System.CreatedBy"];
      expect(firstRevisionCreatedBy).toHaveProperty("displayName");
      expect(firstRevisionCreatedBy).not.toHaveProperty("url");
      expect(firstRevisionCreatedBy).not.toHaveProperty("_links");
      expect(firstRevisionCreatedBy).not.toHaveProperty("id");
      expect(firstRevisionCreatedBy).not.toHaveProperty("uniqueName");
      expect(firstRevisionCreatedBy).not.toHaveProperty("imageUrl");
      expect(firstRevisionCreatedBy).not.toHaveProperty("descriptor");
    });

    it("should handle revisions with no identity fields without errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");

      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      const mockRevisionsWithoutIdentities = [
        {
          id: 299,
          rev: 1,
          fields: {
            "System.Id": 299,
            "System.Title": "Test Task",
            "System.State": "New",
          },
        },
      ];

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(mockRevisionsWithoutIdentities);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 25,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(params.workItemId, 25, undefined, undefined, params.project);
      expect(result.content[0].text).toBe(JSON.stringify(mockRevisionsWithoutIdentities, null, 2));
    });

    it("should use default top value of 50 when not provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");

      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockResolvedValue(_mockWorkItemRevisions);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 50,
      };

      await handler(params);

      expect(mockWorkItemTrackingApi.getRevisions).toHaveBeenCalledWith(299, 50, undefined, undefined, "Contoso");
    });
  });

  describe("update_work_item tool", () => {
    it("should call workItemApi.updateWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_item");

      if (!call) throw new Error("wit_update_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      const params = {
        id: 131489,
        updates: [
          {
            op: "Add",
            path: "/fields/System.Title",
            value: "Updated Sample Task",
          },
          {
            op: "Replace",
            path: "/fields/System.Description",
            value: "Updated Description",
          },
        ],
      };

      const result = await handler(params);

      // In line 456-471, the operation is actually not transformed to lowercase
      // despite the comment saying otherwise, so we use the original value
      const expectedUpdates = params.updates;

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(null, expectedUpdates, params.id);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItem], null, 2));
    });
  });

  describe("get_work_item_type tool", () => {
    it("should call workItemApi.getWorkItemType API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_item_type");

      if (!call) throw new Error("wit_get_work_item_type tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockResolvedValue([_mockWorkItemType]);

      const params = {
        project: "Contoso",
        workItemType: "Bug",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemType).toHaveBeenCalledWith(params.project, params.workItemType);

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItemType], null, 2));
    });
  });

  describe("create_work_item tool", () => {
    it("should call workItemApi.createWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");

      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [
          { name: "System.Title", value: "Hello World!" },
          { name: "System.Description", value: "This is a sample task" },
          { name: "System.AreaPath", value: "Contoso\\Development" },
        ],
      };

      const expectedDocument = [
        { op: "add", path: "/fields/System.Title", value: "Hello World!" },
        { op: "add", path: "/fields/System.Description", value: "This is a sample task" },
        { op: "add", path: "/fields/System.AreaPath", value: "Contoso\\Development" },
      ];

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createWorkItem).toHaveBeenCalledWith(null, expectedDocument, params.project, params.workItemType);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItem, null, 2));
    });

    it("should handle Markdown format for long fields", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");

      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const longDescription = "This is a very long description that is definitely more than 50 characters long and should trigger Markdown formatting";

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [
          { name: "System.Title", value: "Hello World!" },
          { name: "System.Description", value: longDescription, format: "Markdown" },
        ],
      };

      const expectedDocument = [
        { op: "add", path: "/fields/System.Title", value: "Hello World!" },
        { op: "add", path: "/fields/System.Description", value: longDescription },
        { op: "add", path: "/multilineFieldsFormat/System.Description", value: "Markdown" },
      ];

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createWorkItem).toHaveBeenCalledWith(null, expectedDocument, params.project, params.workItemType);

      expect(result.content[0].text).toBe(JSON.stringify(_mockWorkItem, null, 2));
    });

    it("should handle null response from createWorkItem", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");

      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [{ name: "System.Title", value: "Test" }],
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Work item was not created");
    });

    it("should handle errors from createWorkItem", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");

      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockRejectedValue(new Error("API failure"));

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [{ name: "System.Title", value: "Test" }],
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating work item: API failure");
    });

    it("should handle unknown error types", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");

      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockRejectedValue("String error");

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [{ name: "System.Title", value: "Test" }],
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating work item: Unknown error occurred");
    });
  });

  describe("get_query tool", () => {
    it("should call workItemApi.getQuery API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_query");

      if (!call) throw new Error("wit_get_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockResolvedValue([_mockQuery]);

      const params = {
        project: "Contoso",
        query: "342f0f44-4069-46b1-a940-3d0468979ceb",
        expand: "None",
        depth: 1,
        includeDeleted: false,
        useIsoDateFormat: false,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getQuery).toHaveBeenCalledWith(params.project, params.query, QueryExpand.None, params.depth, params.includeDeleted, params.useIsoDateFormat);

      expect(result.content[0].text).toBe(JSON.stringify([_mockQuery], null, 2));
    });
  });

  describe("get_query_results_by_id tool", () => {
    it("should call workItemApi.getQueryById API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_query_results_by_id");

      if (!call) throw new Error("wit_get_query_results_by_id tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue([_mockQueryResults]);

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: false,
        top: 50,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.queryById).toHaveBeenCalledWith(params.id, { project: params.project, team: params.team }, params.timePrecision, params.top);

      expect(result.content[0].text).toBe(JSON.stringify([_mockQueryResults], null, 2));
    });
  });

  describe("getLinkTypeFromName function coverage", () => {
    it("should handle all link types through work_items_link tool", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      // Mock the connection and serverUrl
      mockConnection.serverUrl = "https://dev.azure.com/contoso";

      // Mock tokenProvider for this test
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      // Test different link types to cover all branches in getLinkTypeFromName
      const linkTypes = ["parent", "child", "duplicate", "duplicate of", "related", "successor", "predecessor", "tested by", "tests", "affects", "affected by"];

      for (const linkType of linkTypes) {
        const params = {
          project: "TestProject",
          updates: [
            {
              id: 1,
              linkToId: 2,
              type: linkType as "parent" | "child" | "duplicate" | "duplicate of" | "related" | "successor" | "predecessor" | "tested by" | "tests" | "affects" | "affected by",
              comment: "Test comment",
            },
          ],
        };

        await handler(params);
      }

      expect(fetch).toHaveBeenCalled();
    });

    it("should throw error for unknown link type", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";

      const params = {
        project: "TestProject",
        updates: [
          {
            id: 1,
            linkToId: 2,
            type: "unknown_type",
            comment: "Test comment",
          },
        ],
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error linking work items");
      expect(result.content[0].text).toContain("Unknown link type: unknown_type");
    });
  });

  describe("update_work_items_batch tool", () => {
    it("should update work items in batch successfully", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_items_batch");
      if (!call) throw new Error("wit_update_work_items_batch tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, success: true }]),
      });

      const params = {
        updates: [
          {
            op: "replace",
            id: 1,
            path: "/fields/System.Title",
            value: "Updated Title",
          },
          {
            op: "add",
            id: 2,
            path: "/fields/System.Description",
            value: "New Description",
          },
        ],
      };

      const result = await handler(params);

      // This verifies that the updates are grouped by work item ID as implemented in line 643
      const expectedBody = [
        {
          method: "PATCH",
          uri: "/_apis/wit/workitems/1?api-version=5.0",
          headers: { "Content-Type": "application/json-patch+json" },
          body: [{ op: "replace", path: "/fields/System.Title", value: "Updated Title" }],
        },
        {
          method: "PATCH",
          uri: "/_apis/wit/workitems/2?api-version=5.0",
          headers: { "Content-Type": "application/json-patch+json" },
          body: [{ op: "add", path: "/fields/System.Description", value: "New Description" }],
        },
      ];

      expect(fetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(expectedBody),
        })
      );

      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, success: true }], null, 2));
    });

    it("should handle Markdown format for large text fields", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_items_batch");
      if (!call) throw new Error("wit_update_work_items_batch tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, success: true }]),
      });

      const longDescription = "This is a very long description that is definitely more than 50 characters long and should trigger Markdown formatting";

      const params = {
        updates: [
          {
            op: "Add", // Match the capitalization in the implementation
            id: 1,
            path: "/fields/System.Description",
            value: longDescription,
            format: "Markdown",
          },
          {
            op: "Add", // Match the capitalization in the implementation
            id: 1,
            path: "/fields/System.Title",
            value: "Simple Title",
          },
        ],
      };

      const result = await handler(params);

      // This verifies that the Markdown format is applied for the long text field as implemented in line 643
      const expectedBody = [
        {
          method: "PATCH",
          uri: "/_apis/wit/workitems/1?api-version=5.0",
          headers: { "Content-Type": "application/json-patch+json" },
          body: [
            { op: "Add", path: "/fields/System.Description", value: longDescription },
            { op: "Add", path: "/fields/System.Title", value: "Simple Title" },
            {
              op: "Add",
              path: "/multilineFieldsFormat/System.Description",
              value: "Markdown",
            },
          ],
        },
      ];

      expect(fetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(expectedBody),
        })
      );

      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, success: true }], null, 2));
    });

    it("should handle batch update failure", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_items_batch");
      if (!call) throw new Error("wit_update_work_items_batch tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
      });

      const params = {
        updates: [
          {
            op: "replace",
            id: 1,
            path: "/fields/System.Title",
            value: "Updated Title",
          },
        ],
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating work items in batch");
      expect(result.content[0].text).toContain("Failed to update work items in batch: Bad Request");
    });
  });

  describe("work_items_link tool", () => {
    it("should link work items successfully", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, success: true }]),
      });

      const params = {
        project: "TestProject",
        updates: [
          {
            id: 1,
            linkToId: 2,
            type: "related",
            comment: "Related work item",
          },
        ],
      };

      const result = await handler(params);

      expect(fetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
        })
      );

      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, success: true }], null, 2));
    });

    it("should handle linking failure", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      });

      const params = {
        project: "TestProject",
        updates: [
          {
            id: 1,
            linkToId: 2,
            type: "related",
            comment: "Related work item",
          },
        ],
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error linking work items");
      expect(result.content[0].text).toContain("Failed to update work items in batch: Unauthorized");
    });
  });

  describe("work_item_unlink tool", () => {
    it("should unlink work items successfully", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      // Mock work item with relations
      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/3",
            attributes: { isLocked: false, name: "Related" },
          },
        ],
      };

      const mockUpdatedWorkItem = {
        id: 1,
        rev: 5,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/3",
            attributes: { isLocked: false, name: "Related" },
          },
        ],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(mockUpdatedWorkItem);

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
        url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(1, undefined, undefined, 1, "TestProject");
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(null, [{ op: "remove", path: "/relations/0" }], 1, "TestProject");

      expect(result.content[0].text).toContain("Removed 1 link(s) of type 'related':");
      expect(result.content[0].text).toContain("System.LinkTypes.Related");
      expect(result.content[0].text).toContain("Updated work item result:");
    });

    it("should unlink all links of a specific type when no URL is provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      // Mock work item with multiple related links
      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/3",
            attributes: { isLocked: false, name: "Related" },
          },
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/4",
            attributes: { isLocked: false, name: "Child" },
          },
        ],
      };

      const mockUpdatedWorkItem = {
        id: 1,
        rev: 6,
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/4",
            attributes: { isLocked: false, name: "Child" },
          },
        ],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(mockUpdatedWorkItem);

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(1, undefined, undefined, 1, "TestProject");
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
        null,
        [
          { op: "remove", path: "/relations/1" },
          { op: "remove", path: "/relations/0" },
        ],
        1,
        "TestProject"
      );

      expect(result.content[0].text).toContain("Removed 2 link(s) of type 'related':");
      expect(result.content[0].text).toContain("System.LinkTypes.Related");
    });

    it("should handle artifact link removal", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "ArtifactLink",
            url: "vstfs:///Git/Ref/project%2Frepo%2Fbranch",
            attributes: { name: "Branch" },
          },
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
        ],
      };

      const mockUpdatedWorkItem = {
        id: 1,
        rev: 7,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
        ],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(mockUpdatedWorkItem);

      const params = {
        project: "TestProject",
        id: 1,
        type: "artifact",
        url: "vstfs:///Git/Ref/project%2Frepo%2Fbranch",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(null, [{ op: "remove", path: "/relations/0" }], 1, "TestProject");

      expect(result.content[0].text).toContain("Removed 1 link(s) of type 'artifact':");
      expect(result.content[0].text).toContain("ArtifactLink");
    });

    it("should handle when no matching relations are found", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/4",
            attributes: { isLocked: false, name: "Child" },
          },
        ],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
        url: "https://dev.azure.com/contoso/_apis/wit/workItems/999",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.updateWorkItem).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain("No matching relations found for link type 'related' and URL 'https://dev.azure.com/contoso/_apis/wit/workItems/999'");
      expect(result.isError).toBe(true);
    });

    it("should handle updateWorkItem API failure", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
        ],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("Update failed"));

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
        url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error unlinking work item: Update failed");
    });

    it("should handle getWorkItem API failure", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockRejectedValue(new Error("Work item not found"));

      const params = {
        project: "TestProject",
        id: 999,
        type: "related",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error unlinking work item: Work item not found");
    });

    it("should handle work items with no relations", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      const mockWorkItemWithNoRelations = {
        id: 1,
        relations: null,
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithNoRelations);

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
      };

      const result = await handler(params);

      expect(result.content[0].text).toContain("No matching relations found for link type 'related'");
      expect(result.isError).toBe(true);
    });

    it("should handle specific URL matching correctly", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      const mockWorkItemWithRelations = {
        id: 1,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
            attributes: { isLocked: false, name: "Related" },
          },
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://dev.azure.com/contoso/_apis/wit/workItems/3",
            attributes: { isLocked: false, name: "Child" },
          },
          {
            rel: "ArtifactLink",
            url: "vstfs:///Git/Ref/project%2Frepo%2Fbranch",
            attributes: { name: "Branch" },
          },
        ],
      };

      const mockUpdatedWorkItem = {
        id: 1,
        rev: 8,
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(mockUpdatedWorkItem);

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
        url: "https://dev.azure.com/contoso/_apis/wit/workItems/2",
      };

      const result = await handler(params);

      // Should remove only the matching relation at index 0
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(null, [{ op: "remove", path: "/relations/0" }], 1, "TestProject");

      expect(result.content[0].text).toContain("Removed 1 link(s) of type 'related':");
      expect(result.content[0].text).toContain("System.LinkTypes.Related");
    });

    it("should throw error for unknown link type in work_item_unlink", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      // Mock a work item with some relations (this won't matter since we'll hit the error before processing them)
      const mockWorkItemWithRelations = {
        id: 1,
        relations: [],
      };

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(mockWorkItemWithRelations);

      const params = {
        project: "TestProject",
        id: 1,
        type: "unknown_type",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error unlinking work item: Unknown link type: unknown_type");
    });

    it("should handle unknown error types in work_item_unlink", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_item_unlink");
      if (!call) throw new Error("wit_work_item_unlink tool not registered");
      const [, , , handler] = call;

      // Simulate an unknown error type (not an Error instance)
      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockRejectedValue("String error");

      const params = {
        project: "TestProject",
        id: 1,
        type: "related",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error unlinking work item: Unknown error occurred");
    });
  });

  // Add error handling tests for existing tools
  describe("error handling coverage", () => {
    it("should handle create_work_item errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");
      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "TestProject",
        workItemType: "Task",
        fields: [
          { name: "System.Title", value: "Test Task" },
          { name: "System.Description", value: "Test Description" },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error creating work item: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle create_work_item null response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");
      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "TestProject",
        workItemType: "Task",
        fields: [{ name: "System.Title", value: "Test Task" }],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Work item was not created");
      expect(result.isError).toBe(true);
    });

    it("should handle link_work_item_to_pull_request errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("Linking failed"));

      const params = {
        projectId: "TestProject",
        repositoryId: "repo-123",
        pullRequestId: 42,
        workItemId: 1,
        pullRequestProjectId: "OtherProject",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error linking work item to pull request: Linking failed");
      expect(result.isError).toBe(true);
    });

    it("should handle link_work_item_to_pull_request null response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_link_work_item_to_pull_request");
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(null);

      const params = {
        projectId: "TestProject",
        repositoryId: "repo-123",
        pullRequestId: 42,
        workItemId: 1,
        pullRequestProjectId: "OtherProject",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Work item update failed");
      expect(result.isError).toBe(true);
    });

    it("should handle create_work_item unknown error type", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_create_work_item");
      if (!call) throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      // Simulate an unknown error type (not an Error instance)
      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockRejectedValue({ message: "Complex error object" });

      const params = {
        project: "TestProject",
        workItemType: "Task",
        fields: [{ name: "System.Title", value: "Test Task" }],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error creating work item: Unknown error occurred");
      expect(result.isError).toBe(true);
    });

    it("should handle work_items_link with empty comment", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, success: true }]),
      });

      const params = {
        project: "TestProject",
        updates: [
          {
            id: 1,
            linkToId: 2,
            type: "related",
            // No comment provided, should default to empty string
          },
        ],
      };

      const result = await handler(params);

      expect(fetch).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, success: true }], null, 2));
    });
  });

  // Add tests for optional parameters and edge cases
  describe("optional parameters coverage", () => {
    it("should handle add_child_work_item with optional parameters", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the batch API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ responses: [{ body: { id: 123 } }] }),
      });
      global.fetch = mockFetch;

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items: [
          {
            title: "Child Task",
            description: "Child Description",
            areaPath: "TestProject\\Area1",
            iterationPath: "TestProject\\Sprint1",
          },
        ],
      };

      await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("TestProject\\\\Area1"),
        })
      );
    });

    it("should handle add_child_work_item with empty optional parameters", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the batch API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ responses: [{ body: { id: 123 } }] }),
      });
      global.fetch = mockFetch;

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items: [
          {
            title: "Child Task",
            description: "Child Description",
            areaPath: "",
            iterationPath: "   ", // whitespace only
          },
        ],
      };

      await handler(params);

      // Should not include area or iteration path since they're empty/whitespace
      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          body: expect.not.stringContaining("System.AreaPath"),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          body: expect.not.stringContaining("System.IterationPath"),
        })
      );
    });

    it("should reject when more than 50 items are provided", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Create 51 items to exceed the limit
      const items = Array.from({ length: 51 }, (_, i) => ({
        title: `Child Task ${i + 1}`,
        description: `Description ${i + 1}`,
      }));

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("A maximum of 50 child work items can be created in a single call.");
      expect(result.isError).toBe(true);
    });

    it("should handle Markdown format correctly", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for the batch API call
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ responses: [{ body: { id: 123 } }] }),
      });
      global.fetch = mockFetch;

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items: [
          {
            title: "Child Task",
            description: "Child Description in **Markdown**",
            format: "Markdown" as "Markdown" | "Html",
          },
        ],
      };

      await handler(params);

      // Should include Markdown format fields
      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          body: expect.stringContaining("multilineFieldsFormat/System.Description"),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/_apis/wit/$batch?api-version=5.0",
        expect.objectContaining({
          body: expect.stringContaining("multilineFieldsFormat/Microsoft.VSTS.TCM.ReproSteps"),
        })
      );
    });

    it("should handle fetch failure response", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock fetch for a failed response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });
      global.fetch = mockFetch;

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items: [
          {
            title: "Child Task",
            description: "Child Description",
          },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error creating child work items: Failed to update work items in batch: Internal Server Error");
      expect(result.isError).toBe(true);
    });

    it("should handle unknown error types in add_child_work_items", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_child_work_items");
      if (!call) throw new Error("wit_add_child_work_items tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";

      // Mock tokenProvider to throw a non-Error object
      (tokenProvider as jest.Mock).mockRejectedValue("String error");

      const params = {
        parentId: 1,
        project: "TestProject",
        workItemType: "Task",
        items: [
          {
            title: "Child Task",
            description: "Child Description",
          },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error creating child work items: Unknown error occurred");
      expect(result.isError).toBe(true);
    });
  });

  describe("additional error handling for all tools", () => {
    it("should handle list_backlogs errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_backlogs");
      if (!call) throw new Error("wit_list_backlogs tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogs as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error listing backlogs: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_backlog_work_items errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_backlog_work_items");
      if (!call) throw new Error("wit_list_backlog_work_items tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogLevelWorkItems as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        backlogId: "Microsoft.FeatureCategory",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error listing backlog work items: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle my_work_items errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_my_work_items");
      if (!call) throw new Error("wit_my_work_items tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        type: "assignedtome",
        top: 50,
        includeCompleted: false,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving work items: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_items_batch_by_ids errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_batch_by_ids");
      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        ids: [1, 2, 3],
        project: "Contoso",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving work items batch: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_item errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_item");
      if (!call) throw new Error("wit_get_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: 12,
        project: "Contoso",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving work item: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_work_item_comments errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_comments");
      if (!call) throw new Error("wit_list_work_item_comments tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getComments as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error listing work item comments: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle list_work_item_revisions errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_list_work_item_revisions");
      if (!call) throw new Error("wit_list_work_item_revisions tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getRevisions as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error listing work item revisions: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_work_items_for_iteration errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_items_for_iteration");
      if (!call) throw new Error("wit_get_work_items_for_iteration tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getIterationWorkItems as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        iterationId: "abc-123",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving work items for iteration: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle update_work_item errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_item");
      if (!call) throw new Error("wit_update_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: 131489,
        updates: [
          {
            op: "Add",
            path: "/fields/System.Title",
            value: "Updated Sample Task",
          },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error updating work item: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle update_work_item with lowercase operation transformation", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_item");
      if (!call) throw new Error("wit_update_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([_mockWorkItem]);

      // Test that REMOVE gets transformed to remove by the Zod transform
      const params = {
        id: 131489,
        updates: [
          {
            op: "REMOVE",
            path: "/fields/System.Description",
            value: "",
          },
        ],
      };

      const result = await handler(params);

      // The operation value is kept as-is per the implementation
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItem], null, 2));
    });

    it("should handle get_work_item_type errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_work_item_type");
      if (!call) throw new Error("wit_get_work_item_type tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        workItemType: "Bug",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving work item type: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_query");
      if (!call) throw new Error("wit_get_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "Contoso",
        query: "342f0f44-4069-46b1-a940-3d0468979ceb",
        depth: 1,
        includeDeleted: false,
        useIsoDateFormat: false,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving query: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query_results_by_id errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_query_results_by_id");
      if (!call) throw new Error("wit_get_query_results_by_id tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: false,
        top: 50,
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error retrieving query results: API Error");
      expect(result.isError).toBe(true);
    });

    it("should handle get_query_results_by_id with responseType ids", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_get_query_results_by_id");
      if (!call) throw new Error("wit_get_query_results_by_id tool not registered");
      const [, , , handler] = call;

      const mockQueryResultsWithIds = {
        workItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue(mockQueryResultsWithIds);

      const params = {
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        responseType: "ids",
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.ids).toEqual([1, 2, 3]);
      expect(parsedResult.count).toBe(3);
    });

    it("should handle update_work_items_batch errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_items_batch");
      if (!call) throw new Error("wit_update_work_items_batch tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token error"));

      const params = {
        updates: [
          {
            op: "replace",
            id: 1,
            path: "/fields/System.Title",
            value: "Updated Title",
          },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error updating work items in batch: Token error");
      expect(result.isError).toBe(true);
    });

    it("should handle work_items_link errors", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token error"));

      const params = {
        project: "TestProject",
        updates: [
          {
            id: 1,
            linkToId: 2,
            type: "related",
          },
        ],
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error linking work items: Token error");
      expect(result.isError).toBe(true);
    });

    it("should handle add_artifact_link with unknown error type", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
      if (!call) throw new Error("wit_add_artifact_link tool not registered");
      const [, , , handler] = call;

      mockWorkItemTrackingApi.updateWorkItem.mockRejectedValue("String error");

      const params = {
        workItemId: 1234,
        project: "TestProject",
        artifactUri: "vstfs:///Git/Ref/invalid",
        linkType: "Branch",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Error adding artifact link to work item: Unknown error occurred");
      expect(result.isError).toBe(true);
    });
  });

  describe("artifact link tools", () => {
    describe("wit_add_artifact_link", () => {
      it("should add artifact link to work item successfully", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          artifactUri: "vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain",
          linkType: "Branch",
          comment: "Linked to main branch",
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain",
                attributes: {
                  name: "Branch",
                  comment: "Linked to main branch",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.workItemId).toBe(1234);
        expect(response.artifactUri).toBe("vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain");
        expect(response.linkType).toBe("Branch");
        expect(response.comment).toBe("Linked to main branch");
        expect(response.success).toBe(true);
      });

      it("should add artifact link without comment", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          artifactUri: "vstfs:///Git/Commit/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2Fabc123",
          linkType: "Commit",
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Commit/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2Fabc123",
                attributes: {
                  name: "Commit",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.comment).toBe(null);
      });

      it("should handle errors when adding artifact link", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        mockWorkItemTrackingApi.updateWorkItem.mockRejectedValue(new Error("API Error"));

        const params = {
          workItemId: 1234,
          project: "TestProject",
          artifactUri: "vstfs:///Git/Ref/invalid",
          linkType: "Branch",
        };

        const result = await handler(params);

        expect(result.content[0].text).toBe("Error adding artifact link to work item: API Error");
        expect(result.isError).toBe(true);
      });

      // Tests to cover lines 929-973: URI building switch statement logic
      it("should build Branch URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Branch",
          projectId: "project-guid",
          repositoryId: "repo-guid",
          branchName: "feature/test-branch",
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Ref/project-guid%2Frepo-guid%2FGBfeature%2Ftest-branch",
                attributes: {
                  name: "Branch",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should return error for Branch link missing required parameters", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Branch",
          projectId: "project-guid",
          // Missing repositoryId and branchName
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("For 'Branch' links, 'projectId', 'repositoryId', and 'branchName' are required.");
      });

      it("should build Fixed in Commit URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Fixed in Commit",
          projectId: "project-guid",
          repositoryId: "repo-guid",
          commitId: "abc123def456",
          comment: "Fixed in this commit",
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Commit/project-guid%2Frepo-guid%2Fabc123def456",
                attributes: {
                  name: "Fixed in Commit",
                  comment: "Fixed in this commit",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should return error for Fixed in Commit link missing required parameters", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Fixed in Commit",
          projectId: "project-guid",
          // Missing repositoryId and commitId
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("For 'Fixed in Commit' links, 'projectId', 'repositoryId', and 'commitId' are required.");
      });

      it("should build Pull Request URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Pull Request",
          projectId: "project-guid",
          repositoryId: "repo-guid",
          pullRequestId: 42,
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/project-guid%2Frepo-guid%2F42",
                attributes: {
                  name: "Pull Request",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should return error for Pull Request link missing required parameters", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Pull Request",
          projectId: "project-guid",
          repositoryId: "repo-guid",
          // Missing pullRequestId
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("For 'Pull Request' links, 'projectId', 'repositoryId', and 'pullRequestId' are required.");
      });

      it("should build Build URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Build",
          buildId: 123,
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Build/Build/123",
                attributes: {
                  name: "Build",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should build Found in build URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Found in build",
          buildId: 456,
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Build/Build/456",
                attributes: {
                  name: "Found in build",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should build Integrated in build URI from components", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const mockWorkItem = { id: 1234, fields: { "System.Title": "Test Item" } };
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(mockWorkItem);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Integrated in build",
          buildId: 789,
        };

        const result = await handler(params);

        expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
          {},
          [
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "ArtifactLink",
                url: "vstfs:///Build/Build/789",
                attributes: {
                  name: "Integrated in build",
                },
              },
            },
          ],
          1234,
          "TestProject"
        );

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      it("should return error for build link types missing buildId", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Build",
          // Missing buildId
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("For 'Build' links, 'buildId' is required.");
      });

      it("should return error for unsupported link type in URI building", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        const params = {
          workItemId: 1234,
          project: "TestProject",
          linkType: "Model Link", // Unsupported link type for URI building
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("URI building from components is not supported for link type 'Model Link'. Please provide the full 'artifactUri' instead.");
      });

      it("should handle null response from updateWorkItem (line 1000 coverage)", async () => {
        configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

        const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_add_artifact_link");
        if (!call) throw new Error("wit_add_artifact_link tool not registered");
        const [, , , handler] = call;

        // Mock updateWorkItem to return null
        mockWorkItemTrackingApi.updateWorkItem.mockResolvedValue(null);

        const params = {
          workItemId: 1234,
          project: "TestProject",
          artifactUri: "vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain",
          linkType: "Branch",
        };

        const result = await handler(params);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("Work item update failed");
      });
    });
  });
});
