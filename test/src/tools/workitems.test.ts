import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkItemTools } from "../../../src/tools/workitems";
import { WebApi } from "azure-devops-node-api";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import {
  _mockBacklogs,
  _mockQuery,
  _mockQueryResults,
  _mockWorkItem,
  _mockWorkItemComment,
  _mockWorkItemComments,
  _mockWorkItems,
  _mockWorkItemsForIteration,
  _mockWorkItemType,
} from "../../mocks/work-items";

type TokenProviderMock = () => Promise<AccessToken>;
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
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags"],
        },
        params.project
      );

      expect(result.content[0].text).toBe(JSON.stringify([_mockWorkItems], null, 2));
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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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

      await expect(handler(params)).rejects.toThrow("Failed to add a work item comment: Not Found");
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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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

      await expect(handler(params)).rejects.toThrow("Unknown link type: unknown_type");
    });
  });

  describe("update_work_items_batch tool", () => {
    it("should update work items in batch successfully", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_update_work_items_batch");
      if (!call) throw new Error("wit_update_work_items_batch tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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

      await expect(handler(params)).rejects.toThrow("Failed to update work items in batch: Bad Request");
    });
  });

  describe("work_items_link tool", () => {
    it("should link work items successfully", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "wit_work_items_link");
      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      mockConnection.serverUrl = "https://dev.azure.com/contoso";
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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

      await expect(handler(params)).rejects.toThrow("Failed to update work items in batch: Unauthorized");
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
        project: "TestProject",
        repositoryId: "repo-123",
        pullRequestId: 42,
        workItemId: 1,
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
        project: "TestProject",
        repositoryId: "repo-123",
        pullRequestId: 42,
        workItemId: 1,
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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

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
});
