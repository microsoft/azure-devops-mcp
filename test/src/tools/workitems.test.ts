import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkItemTools } from "../../../src/tools/workitems";
import { WebApi } from "azure-devops-node-api";
import { _mockBacklogs, _mockQuery, _mockQueryResults, _mockWorkItem, _mockWorkItemComment, _mockWorkItemComments, _mockWorkItems, _mockWorkItemsForIteration, _mockWorkItemType, _mockWorkItemWithRelations, _mockWorkItemWithNoRelations } from "../../mocks/work-items";

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

describe("configureWorkItemTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;  let mockConnection: {
    getWorkApi: jest.Mock;
    getWorkItemTrackingApi: jest.Mock;
    serverUrl?: string;
  };
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
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_backlogs tool", () => {
    it("should call getBacklogs API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_list_backlogs"
      );
      if (!call) throw new Error("wit_list_backlogs tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getBacklogs as jest.Mock).mockResolvedValue([
        _mockBacklogs,
      ]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
      };

      const result = await handler(params);

      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({
        project: params.project,
        team: params.team,
      });

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockBacklogs,
          ],
          null,
          2
        )
      );
    });
  });

  describe("list_backlog_work_items tool", () => {
    it("should call getBacklogLevelWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_list_backlog_work_items"
      );
      if (!call)
        throw new Error("wit_list_backlog_work_items tool not registered");
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

      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith(
        { project: params.project, team: params.team },
        params.backlogId
      );

      expect(result.content[0].text).toBe(
        JSON.stringify([
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
          }],
          null,
          2
        )
      );
    });
  });

  describe("my_work_items tool", () => {
    it("should call getPredefinedQueryResults API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_my_work_items"
      );
      if (!call)
        throw new Error("wit_my_work_items tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getPredefinedQueryResults as jest.Mock).mockResolvedValue([
        {
          id: "assignedtome",
          name: "Assigned to me",
          url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
          webUrl:"https://dev.azure.com/org/project/project/_workitems/assignedtome",
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

      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith(
        params.project,
        params.type,
        params.top,
        params.includeCompleted
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify([
           {
          id: "assignedtome",
          name: "Assigned to me",
          url: "https://dev.azure.com/org/project/_apis/work/predefinedQueries/assignedtome",
          webUrl:"https://dev.azure.com/org/project/project/_workitems/assignedtome",
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
        },],
          null,
          2
        )
      );
    });
  });

  describe("getWorkItemsBatch tool", () => {
    it("should call workItemApi.getWorkItemsBatch API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_work_items_batch_by_ids"
      );

      if (!call) throw new Error("wit_get_work_items_batch_by_ids tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemsBatch as jest.Mock).mockResolvedValue([
        _mockWorkItems,
      ]);

      const params = {
        ids: [297, 299, 300],
        project: "Contoso",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemsBatch).toHaveBeenCalledWith(
        { 
          ids: params.ids, 
          fields: ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags"] 
        },
        params.project
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
           _mockWorkItems,
          ],
          null,
          2
        )
      );
    });
  });

  describe("get_work_item tool", () => {
    it("should call workItemApi.getWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_work_item"
      );

      if (!call) throw new Error("wit_get_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue([
        _mockWorkItem
      ]);

      const params = {
        id: 12,
        fields: undefined,
        asOf: undefined,
        expand: "none",
        project: "Contoso", 
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledWith(
        params.id,
        params.fields,
        params.asOf,
        params.expand,
        params.project,     
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItem,
          ],
          null,
          2
        )
      );
    });
  });

  describe("list_work_item_comments tool", () => {
    it("should call workItemApi.getComments API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_list_work_item_comments"
      );

      if (!call)throw new Error("wit_list_work_item_comments tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getComments as jest.Mock).mockResolvedValue([
        _mockWorkItemComments
      ]);

      const params = {
        project: "Contoso",
        workItemId: 299,
        top: 10,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getComments).toHaveBeenCalledWith(
        params.project,
        params.workItemId,
        params.top,      
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItemComments,
          ],
          null,
          2
        )
      );
    });
  });

  describe("add_work_item_comment tool", () => {
    it("should call workItemApi.addComment API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_add_work_item_comment"
      );

      if (!call)throw new Error("wit_add_work_item_comment tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.addComment as jest.Mock).mockResolvedValue([
        _mockWorkItemComment,
      ]);

      const params = {
        comment: "hello world!",
        project: "Contoso",
        workItemId: 299,       
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.addComment).toHaveBeenCalledWith(
        {text: params.comment},
        params.project,
        params.workItemId,
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItemComment
          ],
          null,
          2
        )
      );
    });
  });

  describe("add_child_work_item tool", () => {
    it("should call workItemApi.add_child_work_item API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_add_child_work_item"
      );

      if (!call)throw new Error("wit_add_child_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue([
        _mockWorkItem,
      ]);

      const params = {
        parentId: 299,
        project: "Contoso",
        workItemType: "Task",   
        title: "Sample task",
        description: "This is a sample task",
        areaPath: "Contoso\\Development",
        iterationPath: "Contoso\\Sprint 1",    
      };

        const document = [
          { 
            op: "add", 
            path: "/fields/System.Title", 
            value: params.title 
          },
          { 
            op: "add", 
            path: "/fields/System.Description", 
            value: params.description 
          },       
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "System.LinkTypes.Hierarchy-Reverse",
              url: `undefined/${params.project}/_apis/wit/workItems/${params.parentId}`,
            },
          },
          {
            op: "add",
            path: "/fields/System.AreaPath",
            value: params.areaPath,
          },
          {
            op: "add",
            path: "/fields/System.IterationPath",
            value: params.iterationPath,
          }
        ];

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createWorkItem).toHaveBeenCalledWith(
        null,
        document,
        params.project,
        params.workItemType,
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItem
          ],
          null,
          2
        )
      );
    });
  });

  describe("link_work_item_to_pull_request tool", () => {
    it("should call workItemApi.updateWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_link_work_item_to_pull_request"
      );

      if (!call)throw new Error("wit_link_work_item_to_pull_request tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([
          _mockWorkItem,
      ]);

      const params = {
        project: "Contoso",
        repositoryId: 12345,
        pullRequestId: 67890,
        workItemId: 131489,
      };

      const artifactPathValue = `${params.project}/${params.repositoryId}/${params.pullRequestId}`;
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

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        document,
        params.workItemId,
        params.project,       
      );
      
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
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_link_work_item_to_pull_request"
      );
      
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      
      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("API failure"));
      
      const params = {
        project: "Contoso",
        repositoryId: 12345,
        pullRequestId: 67890,
        workItemId: 131489,
      };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API failure");
    });

    it("should encode special characters in project and repositoryId for vstfsUrl", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_link_work_item_to_pull_request"
      );
      if (!call) throw new Error("wit_link_work_item_to_pull_request tool not registered");
      
      const [, , , handler] = call;
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([
        _mockWorkItem,
      ]);
      
      const params = {
        project: "Contoso Project",
        repositoryId: "repo/with/slash",
        pullRequestId: 67890,
        workItemId: 131489,
      };
      const artifactPathValue = `${params.project}/${params.repositoryId}/${params.pullRequestId}`;
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
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        document,
        params.workItemId,
        params.project,
      );
    });
  });

  describe("get_work_items_for_iteration tool", () => {
    it("should call workApi.getIterationWorkItems API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_work_items_for_iteration"
      );

      if (!call)throw new Error("wit_get_work_items_for_iterationt tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getIterationWorkItems as jest.Mock).mockResolvedValue([        
          _mockWorkItemsForIteration,
      ]);

      const params = {
        project: "Contoso",
        team: "Fabrikam",
        iterationId: "6bfde89e-b22e-422e-814a-e8db432f5a58",
      };     

      const result = await handler(params);

      expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith(
        { 
          project: params.project, 
          team: params.team 
        },
        params.iterationId,       
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItemsForIteration,
          ],
          null,
          2
        )
      );
    });
  });

  describe("update_work_item tool", () => {
    it("should call workItemApi.updateWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_update_work_item"
      );

      if (!call)throw new Error("wit_update_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue([        
          _mockWorkItem,
      ]);

      const params = {
        id : 131489,
        updates: [
          { 
            op: "add",
            path: "/fields/System.Title",
            value: "Updated Sample Task"
          }
        ]
      };     

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledWith(
        null,
        params.updates,
        params.id,      
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItem
          ],
          null,
          2
        )
      );
    });
  });

  describe("get_work_item_type tool", () => {
    it("should call workItemApi.getWorkItemType API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_work_item_type"
      );

      if (!call)throw new Error("wit_get_work_item_type tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItemType as jest.Mock).mockResolvedValue([        
          _mockWorkItemType,
      ]);

      const params = {
       project: "Contoso",
        workItemType: "Bug",
      };     

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getWorkItemType).toHaveBeenCalledWith(
        params.project,
        params.workItemType,      
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItemType
          ],
          null,
          2
        )
      );
    });
  });

  describe("create_work_item tool", () => {
    it("should call workItemApi.createWorkItem API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_create_work_item"
      );

      if (!call)throw new Error("wit_create_work_item tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createWorkItem as jest.Mock).mockResolvedValue([        
          _mockWorkItem,
      ]);

      const params = {
        project: "Contoso",
        workItemType: "Task",
        fields: [ 
          "System.Title", "Hello World!",
          "System.Description", "This is a sample task",
          "System.AreaPath", "Contoso\\Development",
        ]
      };     

      const document = Object.entries(params.fields).map(([key, value]) => ({
        op: "add",
        path: `/fields/${key}`,
        value,
      }));

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createWorkItem).toHaveBeenCalledWith(
        null,
        document,
        params.project,
        params.workItemType,     
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockWorkItem
          ],
          null,
          2
        )
      );
    });
  });

  describe("get_query tool", () => {
    it("should call workItemApi.getQuery API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_query"
      );

      if (!call)throw new Error("wit_get_query tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getQuery as jest.Mock).mockResolvedValue([        
        _mockQuery,
      ]);

      const params = {
        project: "Contoso",
        query: "342f0f44-4069-46b1-a940-3d0468979ceb",
        expand: "none",
        depth: 1,
        includeDeleted: false,
        useIsoDateFormat: false,
      };     

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getQuery).toHaveBeenCalledWith(
        params.project,
        params.query,
        params.expand,
        params.depth,
        params.includeDeleted,
        params.useIsoDateFormat,      
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockQuery,
          ],
          null,
          2
        )
      );
    });
  });

  describe("get_query_results_by_id tool", () => {
    it("should call workItemApi.getQueryById API with the correct parameters and return the expected result", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_get_query_results_by_id"
      );

      if (!call)throw new Error("wit_get_query_results_by_id tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.queryById as jest.Mock).mockResolvedValue([        
        _mockQueryResults,
      ]);

      const params = {        
        id: "342f0f44-4069-46b1-a940-3d0468979ceb",
        project: "Contoso",
        team: "Fabrikam",
        timePrecision: false,
        top: 50,
      };     

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.queryById).toHaveBeenCalledWith(
        params.id,
        { project: params.project, team: params.team },
        params.timePrecision,
        params.top     
      );
      
      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            _mockQueryResults,
          ],
          null,
          2
        )
      );
    });
  });

  describe("work_items_link tool", () => {
    let originalFetch: typeof global.fetch;    beforeEach(() => {
      originalFetch = global.fetch;
      // Add serverUrl to mockConnection 
      mockConnection.serverUrl = "https://dev.azure.com/fabrikam";
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should successfully link work items in batch", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      const mockBatchResponse = {
        count: 2,
        value: [
          { code: 200, body: { id: 131489 } },
          { code: 200, body: { id: 131490 } }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBatchResponse),
      } as Response);

      (tokenProvider as jest.Mock).mockResolvedValue({
        token: "mock-access-token",
      });

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 123456,
            operation: "link" as const,
            type: "related" as const,
            comment: "Linking related work items"
          },
          {
            id: 131490,
            linkToId: 789012,
            operation: "link" as const,
            type: "child" as const,
            comment: "Adding child work item"
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.totalOperations).toBe(2);
      expect(response.successful).toBe(2);
      expect(response.failed).toBe(0);
      expect(response.linkOperations).toBe(2);
      expect(response.unlinkOperations).toBe(0);
      expect(response.results).toHaveLength(2);
      expect(response.linkBatchResponse).toEqual(mockBatchResponse);
    });

    it("should successfully unlink work items in batch", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock)
        .mockResolvedValueOnce(_mockWorkItemWithRelations)
        .mockResolvedValueOnce(_mockWorkItemWithRelations);

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock)
        .mockResolvedValueOnce(_mockWorkItem)
        .mockResolvedValueOnce(_mockWorkItem);

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 123456,
            operation: "unlink" as const,
            type: "related" as const
          },
          {
            id: 131489,
            linkToId: 789012,
            operation: "unlink" as const,
            type: "child" as const
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledTimes(1); // Groups by work item ID
      expect(mockWorkItemTrackingApi.updateWorkItem).toHaveBeenCalledTimes(1);
      
      expect(response.totalOperations).toBe(2);
      expect(response.successful).toBe(2);
      expect(response.failed).toBe(0);
      expect(response.linkOperations).toBe(0);
      expect(response.unlinkOperations).toBe(2);
      expect(response.results).toHaveLength(2);
    });

    it("should handle mixed link and unlink operations", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      const mockBatchResponse = {
        count: 1,
        value: [
          { code: 200, body: { id: 131489 } }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBatchResponse),
      } as Response);

      (tokenProvider as jest.Mock).mockResolvedValue({
        token: "mock-access-token",
      });

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItemWithRelations);
      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock).mockResolvedValue(_mockWorkItem);

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 999999,
            operation: "link" as const,
            type: "related" as const,
            comment: "New link"
          },
          {
            id: 131489,
            linkToId: 123456,
            operation: "unlink" as const,
            type: "related" as const
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.totalOperations).toBe(2);
      expect(response.linkOperations).toBe(1);
      expect(response.unlinkOperations).toBe(1);
      expect(response.results).toHaveLength(2);
    });

    it("should handle different link types correctly", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      const mockBatchResponse = {
        count: 1,
        value: [{ code: 200, body: { id: 131489 } }]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBatchResponse),
      } as Response);

      (tokenProvider as jest.Mock).mockResolvedValue({
        token: "mock-access-token",
      });

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 123456,
            operation: "link" as const,
            type: "parent" as const,
            comment: "Parent relationship"
          }
        ]
      };

      await handler(params);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody[0].body[0].value.rel).toBe("System.LinkTypes.Hierarchy-Reverse");
    });

    it("should handle fetch error for link operations", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
      } as Response);

      (tokenProvider as jest.Mock).mockResolvedValue({
        token: "mock-access-token",
      });

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 123456,
            operation: "link" as const,
            type: "related" as const
          }
        ]
      };

      await expect(handler(params)).rejects.toThrow(
        "Failed to process work item operations: Failed to process link operations: Bad Request"
      );
    });

    it("should handle unlink operation when work item has no relations", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItemWithNoRelations);

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131490,
            linkToId: 123456,
            operation: "unlink" as const,
            type: "related" as const
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.totalOperations).toBe(1);
      expect(response.successful).toBe(0);
      expect(response.failed).toBe(1);
      expect(response.results[0].success).toBe(false);
      expect(response.results[0].error).toContain("has no relations to unlink");
    });

    it("should handle unlink operation when relation is not found", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock).mockResolvedValue(_mockWorkItemWithRelations);

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489,
            linkToId: 999999, // Non-existent relation
            operation: "unlink" as const,
            type: "related" as const
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.totalOperations).toBe(1);
      expect(response.successful).toBe(0);
      expect(response.failed).toBe(1);
      expect(response.results[0].success).toBe(false);
      expect(response.results[0].error).toContain("No relation found");
    });

    it("should handle empty updates array", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "Contoso",
        updates: []
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      expect(response.totalOperations).toBe(0);
      expect(response.successful).toBe(0);
      expect(response.failed).toBe(0);
      expect(response.linkOperations).toBe(0);
      expect(response.unlinkOperations).toBe(0);
      expect(response.results).toHaveLength(0);
    });

    it("should properly group operations by work item ID for unlink", async () => {
      configureWorkItemTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "wit_work_items_link"
      );

      if (!call) throw new Error("wit_work_items_link tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getWorkItem as jest.Mock)
        .mockResolvedValueOnce(_mockWorkItemWithRelations)
        .mockResolvedValueOnce(_mockWorkItemWithRelations);

      (mockWorkItemTrackingApi.updateWorkItem as jest.Mock)
        .mockResolvedValueOnce(_mockWorkItem)
        .mockResolvedValueOnce(_mockWorkItem);

      const params = {
        project: "Contoso",
        updates: [
          {
            id: 131489, // Same work item
            linkToId: 123456,
            operation: "unlink" as const,
            type: "related" as const
          },
          {
            id: 131489, // Same work item
            linkToId: 789012,
            operation: "unlink" as const,
            type: "child" as const
          },
          {
            id: 131490, // Different work item
            linkToId: 555666,
            operation: "unlink" as const,
            type: "related" as const
          }
        ]
      };

      const result = await handler(params);
      const response = JSON.parse(result.content[0].text);

      // Should call getWorkItem once per unique work item ID (131489 and 131490)
      expect(mockWorkItemTrackingApi.getWorkItem).toHaveBeenCalledTimes(2);
      expect(response.totalOperations).toBe(3);
    });
  });
});