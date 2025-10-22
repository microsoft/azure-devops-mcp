import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkTools } from "../../../src/tools/work";
import { WebApi } from "azure-devops-node-api";
import { TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface WorkApiMock {
  getTeamIterations: jest.Mock;
  postTeamIteration: jest.Mock;
}

interface WorkItemTrackingApiMock {
  createOrUpdateClassificationNode: jest.Mock;
}

describe("configureWorkTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getWorkApi: jest.Mock; getWorkItemTrackingApi: jest.Mock };
  let mockWorkApi: WorkApiMock;
  let mockWorkItemTrackingApi: WorkItemTrackingApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockWorkApi = {
      getTeamIterations: jest.fn(),
      postTeamIteration: jest.fn(),
    };

    mockWorkItemTrackingApi = {
      createOrUpdateClassificationNode: jest.fn(),
    };

    mockConnection = {
      getWorkApi: jest.fn().mockResolvedValue(mockWorkApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemTrackingApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureWorkTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_team_iterations tool", () => {
    it("should call getTeamIterations API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamIterations as jest.Mock).mockResolvedValue([
        {
          id: "a589a806-bf11-4d4f-a031-c19813331553",
          name: "Sprint 2",
          attributes: {
            startDate: null,
            finishDate: null,
          },
          url: "https://dev.azure.com/fabrikam/6d823a47-2d51-4f31-acff-74927f88ee1e/748b18b6-4b3c-425a-bcae-ff9b3e703012/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553",
        },
      ]);

      const params = {
        project: "fabrikam",
        team: undefined,
        timeframe: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({ project: "fabrikam", team: undefined }, undefined);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "a589a806-bf11-4d4f-a031-c19813331553",
              name: "Sprint 2",
              attributes: {
                startDate: null,
                finishDate: null,
              },
              url: "https://dev.azure.com/fabrikam/6d823a47-2d51-4f31-acff-74927f88ee1e/748b18b6-4b3c-425a-bcae-ff9b3e703012/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve iterations");
      (mockWorkApi.getTeamIterations as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "fabrikam",
        team: "Fabrikam Team",
        timeframe: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching team iterations: Failed to retrieve iterations");
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamIterations as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "fabrikam",
        team: "Fabrikam Team",
        timeframe: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations found");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamIterations as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "fabrikam",
        team: "Fabrikam Team",
        timeframe: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching team iterations: Unknown error occurred");
    });
  });

  describe("assign_iterations", () => {
    it("should call postTeamIteration API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_assign_iterations");

      if (!call) throw new Error("work_assign_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.postTeamIteration as jest.Mock).mockResolvedValue({
        id: "a589a806-bf11-4d4f-a031-c19813331553",
        name: "Sprint 2",
        path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
        attributes: {
          startDate: null,
          finishDate: null,
        },
        url: "https://dev.azure.com/fabrikam/6d823a47-2d51-4f31-acff-74927f88ee1e/748b18b6-4b3c-425a-bcae-ff9b3e703012/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553",
      });

      const params = {
        project: "Fabrikam",
        team: "Fabrikam Team",
        iterations: [
          {
            identifier: "a589a806-bf11-4d4f-a031-c19813331553",
            path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.postTeamIteration).toHaveBeenCalledWith(
        {
          id: "a589a806-bf11-4d4f-a031-c19813331553",
          path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
        },
        {
          project: "Fabrikam",
          team: "Fabrikam Team",
        }
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "a589a806-bf11-4d4f-a031-c19813331553",
              name: "Sprint 2",
              path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
              attributes: {
                startDate: null,
                finishDate: null,
              },
              url: "https://dev.azure.com/fabrikam/6d823a47-2d51-4f31-acff-74927f88ee1e/748b18b6-4b3c-425a-bcae-ff9b3e703012/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_assign_iterations");

      if (!call) throw new Error("work_assign_iterations tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to assign iteration");
      (mockWorkApi.postTeamIteration as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "Fabrikam",
        team: "Fabrikam Team",
        iterations: [
          {
            identifier: "a589a806-bf11-4d4f-a031-c19813331553",
            path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.postTeamIteration).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error assigning iterations: Failed to assign iteration");
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_assign_iterations");

      if (!call) throw new Error("work_assign_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.postTeamIteration as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        team: "Fabrikam Team",
        iterations: [
          {
            identifier: "a589a806-bf11-4d4f-a031-c19813331553",
            path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.postTeamIteration).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations were assigned to the team");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_assign_iterations");

      if (!call) throw new Error("work_assign_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.postTeamIteration as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "Fabrikam",
        team: "Fabrikam Team",
        iterations: [
          {
            identifier: "a589a806-bf11-4d4f-a031-c19813331553",
            path: "Fabrikam-Fiber\\Release 1\\Sprint 2",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.postTeamIteration).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error assigning iterations: Unknown error occurred");
    });
  });

  describe("create_iterations", () => {
    it("should call createOrUpdateClassificationNode API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_create_iterations");

      if (!call) throw new Error("work_create_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createOrUpdateClassificationNode as jest.Mock).mockResolvedValue({
        id: 126391,
        identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
        name: "Web",
        structureType: "area",
        hasChildren: false,
        path: "\\fabrikam\\fiber\\tfvc\\area",
        _links: {
          self: {
            href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas/Web",
          },
          parent: {
            href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas",
          },
        },
        url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas/Web",
      });

      const params = {
        project: "Fabrikam",
        iterations: [
          {
            iterationName: "Sprint 2",
            startDate: "2025-06-02T00:00:00Z",
            finishDate: "2025-06-13T00:00:00Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalledWith(
        {
          name: "Sprint 2",
          attributes: {
            startDate: new Date("2025-06-02T00:00:00Z"),
            finishDate: new Date("2025-06-13T00:00:00Z"),
          },
        },
        "Fabrikam",
        TreeStructureGroup.Iterations
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: 126391,
              identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
              name: "Web",
              structureType: "area",
              hasChildren: false,
              path: "\\fabrikam\\fiber\\tfvc\\area",
              _links: {
                self: {
                  href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas/Web",
                },
                parent: {
                  href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas",
                },
              },
              url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/classificationNodes/Areas/Web",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_create_iterations");

      if (!call) throw new Error("work_create_iterations tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to create iteration");
      (mockWorkItemTrackingApi.createOrUpdateClassificationNode as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "Fabrikam",
        iterations: [
          {
            iterationName: "Sprint 2",
            startDate: "2025-06-02T00:00:00Z",
            finishDate: "2025-06-13T00:00:00Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating iterations: Failed to create iteration");
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_create_iterations");

      if (!call) throw new Error("work_create_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createOrUpdateClassificationNode as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        iterations: [
          {
            iterationName: "Sprint 2",
            startDate: "2025-06-02T00:00:00Z",
            finishDate: "2025-06-13T00:00:00Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations were created");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_create_iterations");

      if (!call) throw new Error("work_create_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createOrUpdateClassificationNode as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "Fabrikam",
        iterations: [
          {
            iterationName: "Sprint 2",
            startDate: "2025-06-02T00:00:00Z",
            finishDate: "2025-06-13T00:00:00Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating iterations: Unknown error occurred");
    });

    it("should handle iterations without start and finish dates", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_create_iterations");

      if (!call) throw new Error("work_create_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.createOrUpdateClassificationNode as jest.Mock).mockResolvedValue({
        id: 126391,
        identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
        name: "Sprint 3",
        structureType: "iteration",
        hasChildren: false,
        path: "\\fabrikam\\fiber\\tfvc\\iteration",
      });

      const params = {
        project: "Fabrikam",
        iterations: [
          {
            iterationName: "Sprint 3",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).toHaveBeenCalledWith(
        {
          name: "Sprint 3",
          attributes: {
            startDate: undefined,
            finishDate: undefined,
          },
        },
        "Fabrikam",
        TreeStructureGroup.Iterations
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: 126391,
              identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
              name: "Sprint 3",
              structureType: "iteration",
              hasChildren: false,
              path: "\\fabrikam\\fiber\\tfvc\\iteration",
            },
          ],
          null,
          2
        )
      );
    });
  });
});
