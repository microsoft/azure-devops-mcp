// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureWorkTools } from "../../../src/tools/work";
import { WebApi } from "azure-devops-node-api";
import { TreeStructureGroup, TreeNodeStructureType } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface WorkApiMock {
  getTeamIterations: jest.Mock;
  postTeamIteration: jest.Mock;
  getCapacitiesWithIdentityRefAndTotals: jest.Mock;
  updateCapacityWithIdentityRef: jest.Mock;
  getTotalIterationCapacities: jest.Mock;
  getTeamSettings: jest.Mock;
  getTeamFieldValues: jest.Mock;
  getPlans: jest.Mock;
  getPlan: jest.Mock;
  createPlan: jest.Mock;
  updatePlan: jest.Mock;
  deletePlan: jest.Mock;
  updateTeamFieldValues: jest.Mock;
  getBoards: jest.Mock;
  getBoardColumns: jest.Mock;
  getBoardRows: jest.Mock;
  getBacklogConfigurations: jest.Mock;
  getTeamDaysOff: jest.Mock;
  updateTeamDaysOff: jest.Mock;
  updateBoardColumns: jest.Mock;
  updateBoardRows: jest.Mock;
  getBoardCardSettings: jest.Mock;
  updateBoardCardSettings: jest.Mock;
  getBoardCardRuleSettings: jest.Mock;
  updateBoardCardRuleSettings: jest.Mock;
  getBoardCharts: jest.Mock;
  getBoardChart: jest.Mock;
  updateBoardChart: jest.Mock;
  getBacklogs: jest.Mock;
  getBacklog: jest.Mock;
  getBacklogLevelWorkItems: jest.Mock;
  getIterationWorkItems: jest.Mock;
  deleteTeamIteration: jest.Mock;
  reorderBacklogWorkItems: jest.Mock;
  reorderIterationWorkItems: jest.Mock;
  getBoard: jest.Mock;
  getBoardUserSettings: jest.Mock;
  getDeliveryTimelineData: jest.Mock;
  getProcessConfiguration: jest.Mock;
  getPredefinedQueries: jest.Mock;
  getPredefinedQueryResults: jest.Mock;
  getColumns: jest.Mock;
  updateColumns: jest.Mock;
  getWorkItemColumns: jest.Mock;
  updateWorkItemColumn: jest.Mock;
  updateTaskboardCardSettings: jest.Mock;
  updateTaskboardCardRuleSettings: jest.Mock;
  getColumnSuggestedValues: jest.Mock;
  getRowSuggestedValues: jest.Mock;
  getBoardMappingParentItems: jest.Mock;
  getCapacityWithIdentityRef: jest.Mock;
  replaceCapacitiesWithIdentityRef: jest.Mock;
  updateAutomationRule: jest.Mock;
}

interface WorkItemTrackingApiMock {
  createOrUpdateClassificationNode: jest.Mock;
  getClassificationNodes: jest.Mock;
  updateClassificationNode: jest.Mock;
  deleteClassificationNode: jest.Mock;
}

interface CoreApiMock {
  getProjects: jest.Mock;
  getTeams: jest.Mock;
}

describe("configureWorkTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getWorkApi: jest.Mock;
    getWorkItemTrackingApi: jest.Mock;
    getCoreApi: jest.Mock;
    rest: { create: jest.Mock; update: jest.Mock; del: jest.Mock };
    vsoClient: { resolveUrl: jest.Mock };
  };
  let mockWorkApi: WorkApiMock;
  let mockWorkItemTrackingApi: WorkItemTrackingApiMock;
  let mockCoreApi: CoreApiMock;

  beforeEach(() => {
    server = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockWorkApi = {
      getTeamIterations: jest.fn(),
      postTeamIteration: jest.fn(),
      getCapacitiesWithIdentityRefAndTotals: jest.fn(),
      updateCapacityWithIdentityRef: jest.fn(),
      getTotalIterationCapacities: jest.fn(),
      getTeamSettings: jest.fn(),
      getTeamFieldValues: jest.fn(),
      getPlans: jest.fn(),
      getPlan: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      deletePlan: jest.fn(),
      updateTeamFieldValues: jest.fn(),
      getBoards: jest.fn(),
      getBoardColumns: jest.fn(),
      getBoardRows: jest.fn(),
      getBacklogConfigurations: jest.fn(),
      getTeamDaysOff: jest.fn(),
      updateTeamDaysOff: jest.fn(),
      updateBoardColumns: jest.fn(),
      updateBoardRows: jest.fn(),
      getBoardCardSettings: jest.fn(),
      updateBoardCardSettings: jest.fn(),
      getBoardCardRuleSettings: jest.fn(),
      updateBoardCardRuleSettings: jest.fn(),
      getBoardCharts: jest.fn(),
      getBoardChart: jest.fn(),
      updateBoardChart: jest.fn(),
      getBacklogs: jest.fn(),
      getBacklog: jest.fn(),
      getBacklogLevelWorkItems: jest.fn(),
      getIterationWorkItems: jest.fn(),
      deleteTeamIteration: jest.fn(),
      reorderBacklogWorkItems: jest.fn(),
      reorderIterationWorkItems: jest.fn(),
      getBoard: jest.fn(),
      getBoardUserSettings: jest.fn(),
      getDeliveryTimelineData: jest.fn(),
      getProcessConfiguration: jest.fn(),
      getPredefinedQueries: jest.fn(),
      getPredefinedQueryResults: jest.fn(),
      getColumns: jest.fn(),
      updateColumns: jest.fn(),
      getWorkItemColumns: jest.fn(),
      updateWorkItemColumn: jest.fn(),
      updateTaskboardCardSettings: jest.fn(),
      updateTaskboardCardRuleSettings: jest.fn(),
      getColumnSuggestedValues: jest.fn(),
      getRowSuggestedValues: jest.fn(),
      getBoardMappingParentItems: jest.fn(),
      getCapacityWithIdentityRef: jest.fn(),
      replaceCapacitiesWithIdentityRef: jest.fn(),
      updateAutomationRule: jest.fn(),
    };

    mockWorkItemTrackingApi = {
      createOrUpdateClassificationNode: jest.fn(),
      getClassificationNodes: jest.fn(),
      updateClassificationNode: jest.fn(),
      deleteClassificationNode: jest.fn(),
    };

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
    };

    mockConnection = {
      getWorkApi: jest.fn().mockResolvedValue(mockWorkApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWorkItemTrackingApi),
      getCoreApi: jest.fn().mockResolvedValue(mockCoreApi),
      rest: { create: jest.fn(), update: jest.fn(), del: jest.fn() },
      vsoClient: { resolveUrl: jest.fn((relativeUrl: string) => `https://dev.azure.com/org${relativeUrl}`) },
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
        team: "Fabrikam Team",
        timeframe: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({ project: "fabrikam", team: "Fabrikam Team" }, undefined);

      expect(result.content[0].text).toBe("Project: fabrikam, Team: Fabrikam Team");
      expect(result.content[1].text).toBe(
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

    it("should elicit project and team when not provided and user accepts", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } }).mockResolvedValueOnce({ action: "accept", content: { team: "Team One" } });

      (mockWorkApi.getTeamIterations as jest.Mock).mockResolvedValue([{ id: "iter-1", name: "Sprint 1" }]);

      const result = await handler({ project: undefined, team: undefined, timeframe: undefined });

      expect(elicitMock).toHaveBeenCalledTimes(2);
      expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({ project: "ProjectAlpha", team: "Team One" }, undefined);
      expect(result.content[0].text).toBe("Project: ProjectAlpha, Team: Team One");
      expect(result.content[1].text).toContain("Sprint 1");
    });

    it("should return cancellation when project elicitation is declined", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, team: undefined, timeframe: undefined });

      expect(result.content[0].text).toBe("Project selection cancelled.");
      expect(mockWorkApi.getTeamIterations).not.toHaveBeenCalled();
    });

    it("should return cancellation when team elicitation is declined", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } }).mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, team: undefined, timeframe: undefined });

      expect(result.content[0].text).toBe("Team selection cancelled.");
      expect(mockWorkApi.getTeamIterations).not.toHaveBeenCalled();
    });

    it("should return error when no teams are available for elicitation", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_team_iterations");
      if (!call) throw new Error("work_list_team_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } });

      const result = await handler({ project: undefined, team: undefined, timeframe: undefined });

      expect(elicitMock).toHaveBeenCalledTimes(1);
      expect(mockWorkApi.getTeamIterations).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No teams found to select from.");
    });
  });

  describe("list_iterations tool", () => {
    it("should call getClassificationNodes API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126391,
          identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
          name: "Area",
          structureType: TreeNodeStructureType.Area,
          hasChildren: true,
          path: "\\fabrikam\\area",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Areas",
          children: [],
        },
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
              attributes: {
                startDate: "2025-01-01T00:00:00Z",
                finishDate: "2025-01-14T23:59:59Z",
              },
            },
            {
              id: 126394,
              identifier: "d8f9b6a2-6571-7g95-ca4f-h9ej5797g669",
              name: "Sprint 2",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 2",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%202",
              attributes: {
                startDate: "2025-01-15T00:00:00Z",
                finishDate: "2025-01-28T23:59:59Z",
              },
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 2);

      const expectedResult = [
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
              attributes: {
                startDate: "2025-01-01T00:00:00Z",
                finishDate: "2025-01-14T23:59:59Z",
              },
            },
            {
              id: 126394,
              identifier: "d8f9b6a2-6571-7g95-ca4f-h9ej5797g669",
              name: "Sprint 2",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 2",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%202",
              attributes: {
                startDate: "2025-01-15T00:00:00Z",
                finishDate: "2025-01-28T23:59:59Z",
              },
            },
          ],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should use default depth of 1 when depth parameter is not provided", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [],
        },
      ]);

      const params = {
        project: "Fabrikam",
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);

      const expectedResult = [
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should filter out non-iteration nodes and return only iteration nodes", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126391,
          identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
          name: "Area",
          structureType: TreeNodeStructureType.Area,
          hasChildren: true,
          path: "\\fabrikam\\area",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Areas",
          children: [],
        },
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: false,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);

      // Should only return the iteration node, filtering out the area node
      const expectedResult = [
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: false,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle case when no iteration nodes are found", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126391,
          identifier: "a5c68379-3258-4d62-971c-71c1c459336e",
          name: "Area",
          structureType: TreeNodeStructureType.Area,
          hasChildren: true,
          path: "\\fabrikam\\area",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Areas",
          children: [],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations were found");
    });

    it("should handle empty API response", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([]);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations were found");
    });

    it("should handle null API response", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iterations were found");
    });

    it("should handle iteration node with undefined children", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: false,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: undefined,
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 1);

      const expectedResult = [
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: false,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve iterations");
      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching iterations: Failed to retrieve iterations");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "Fabrikam",
        depth: 1,
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching iterations: Unknown error occurred");
    });

    it("should properly map child iterations with all expected properties", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
              attributes: {
                startDate: "2025-01-01T00:00:00Z",
                finishDate: "2025-01-14T23:59:59Z",
              },
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // Verify that child has all expected properties but no extra ones
      expect(parsedResult[0].children[0]).toEqual({
        id: 126393,
        identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
        name: "Sprint 1",
        structureType: TreeNodeStructureType.Iteration,
        hasChildren: false,
        path: "\\fabrikam\\iteration\\Sprint 1",
        url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
        attributes: {
          startDate: "2025-01-01T00:00:00Z",
          finishDate: "2025-01-14T23:59:59Z",
        },
      });
    });

    it("should filter out iterations by excludedIds parameter", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
              attributes: {
                startDate: "2025-01-01T00:00:00Z",
                finishDate: "2025-01-14T23:59:59Z",
              },
            },
            {
              id: 126394,
              identifier: "d8f9b6a2-6571-7g95-ca4f-h9ej5797g669",
              name: "Sprint 2",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 2",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%202",
              attributes: {
                startDate: "2025-01-15T00:00:00Z",
                finishDate: "2025-01-28T23:59:59Z",
              },
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
        excludedIds: [126394],
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 2);

      const expectedResult = [
        {
          id: 126392,
          identifier: "b6d79480-4359-5e73-a82d-f7cg3575e447",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "c7e8a591-5460-6f84-b93e-g8di4686f558",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
              attributes: {
                startDate: "2025-01-01T00:00:00Z",
                finishDate: "2025-01-14T23:59:59Z",
              },
            },
          ],
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should recursively filter out iterations and their children by excludedIds", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "root-iteration",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "level-1-a",
              name: "Level 1 A",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: true,
              path: "\\fabrikam\\iteration\\Level 1 A",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Level%201%20A",
              children: [
                {
                  id: 126395,
                  identifier: "sprint-1",
                  name: "Sprint 1",
                  structureType: TreeNodeStructureType.Iteration,
                  hasChildren: false,
                  path: "\\fabrikam\\iteration\\Level 1 A\\Sprint 1",
                  url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Level%201%20A/Sprint%201",
                },
                {
                  id: 126396,
                  identifier: "sprint-2",
                  name: "Sprint 2",
                  structureType: TreeNodeStructureType.Iteration,
                  hasChildren: false,
                  path: "\\fabrikam\\iteration\\Level 1 A\\Sprint 2",
                  url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Level%201%20A/Sprint%202",
                },
              ],
            },
            {
              id: 126394,
              identifier: "archived-folder",
              name: "Archived",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: true,
              path: "\\fabrikam\\iteration\\Archived",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Archived",
              children: [
                {
                  id: 126397,
                  identifier: "old-sprint-1",
                  name: "Old Sprint 1",
                  structureType: TreeNodeStructureType.Iteration,
                  hasChildren: false,
                  path: "\\fabrikam\\iteration\\Archived\\Old Sprint 1",
                  url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Archived/Old%20Sprint%201",
                },
                {
                  id: 126398,
                  identifier: "old-sprint-2",
                  name: "Old Sprint 2",
                  structureType: TreeNodeStructureType.Iteration,
                  hasChildren: false,
                  path: "\\fabrikam\\iteration\\Archived\\Old Sprint 2",
                  url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Archived/Old%20Sprint%202",
                },
              ],
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 3,
        excludedIds: [126394], // Exclude "Archived" folder
      };

      const result = await handler(params);

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Fabrikam", [], 3);

      const parsedResult = JSON.parse(result.content[0].text);

      // Root should still be present
      expect(parsedResult[0].id).toBe(126392);
      expect(parsedResult[0].name).toBe("Iteration");

      // Level 1 A should still be present
      expect(parsedResult[0].children).toHaveLength(1);
      expect(parsedResult[0].children[0].id).toBe(126393);
      expect(parsedResult[0].children[0].name).toBe("Level 1 A");

      // Sprint 1 and Sprint 2 under Level 1 A should still be present
      expect(parsedResult[0].children[0].children).toHaveLength(2);
      expect(parsedResult[0].children[0].children[0].id).toBe(126395);
      expect(parsedResult[0].children[0].children[0].name).toBe("Sprint 1");
      expect(parsedResult[0].children[0].children[1].id).toBe(126396);
      expect(parsedResult[0].children[0].children[1].name).toBe("Sprint 2");

      // Archived folder and its children should be completely removed
      const archivedFolder = parsedResult[0].children.find((child: { id: number }) => child.id === 126394);
      expect(archivedFolder).toBeUndefined();
    });

    it("should handle multiple excludedIds filtering", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "root-iteration",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "sprint-1",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
            },
            {
              id: 126394,
              identifier: "sprint-2",
              name: "Sprint 2",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 2",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%202",
            },
            {
              id: 126395,
              identifier: "sprint-3",
              name: "Sprint 3",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 3",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%203",
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
        excludedIds: [126393, 126395], // Exclude Sprint 1 and Sprint 3
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // Root should still be present
      expect(parsedResult[0].id).toBe(126392);

      // Only Sprint 2 should remain
      expect(parsedResult[0].children).toHaveLength(1);
      expect(parsedResult[0].children[0].id).toBe(126394);
      expect(parsedResult[0].children[0].name).toBe("Sprint 2");
    });

    it("should handle empty excludedIds array without filtering", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "root-iteration",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: 126393,
              identifier: "sprint-1",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
        excludedIds: [],
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // All iterations should be present
      expect(parsedResult[0].id).toBe(126392);
      expect(parsedResult[0].children).toHaveLength(1);
      expect(parsedResult[0].children[0].id).toBe(126393);
    });

    it("should handle excludedIds filtering with nodes that have no id property", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 126392,
          identifier: "root-iteration",
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: true,
          path: "\\fabrikam\\iteration",
          url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations",
          children: [
            {
              id: undefined, // Node with no id
              identifier: "no-id-node",
              name: "No ID Node",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\No ID Node",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/No%20ID%20Node",
            },
            {
              id: 126394,
              identifier: "sprint-1",
              name: "Sprint 1",
              structureType: TreeNodeStructureType.Iteration,
              hasChildren: false,
              path: "\\fabrikam\\iteration\\Sprint 1",
              url: "https://dev.azure.com/fabrikam/_apis/wit/classificationNodes/Iterations/Sprint%201",
            },
          ],
        },
      ]);

      const params = {
        project: "Fabrikam",
        depth: 2,
        excludedIds: [126394],
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // Root should be present
      expect(parsedResult[0].id).toBe(126392);

      // Only the node with no id should remain (it can't be filtered out)
      expect(parsedResult[0].children).toHaveLength(1);
      expect(parsedResult[0].children[0].id).toBeUndefined();
      expect(parsedResult[0].children[0].name).toBe("No ID Node");
    });

    it("should elicit project when not provided and user accepts", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } });

      (mockWorkItemTrackingApi.getClassificationNodes as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: "Iteration",
          structureType: TreeNodeStructureType.Iteration,
          hasChildren: false,
          children: [],
        },
      ]);

      const result = await handler({ project: undefined, depth: 2 });

      expect(elicitMock).toHaveBeenCalledTimes(1);
      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("ProjectAlpha", [], 2);
      expect(result.content[0].text).toContain("Iteration");
    });

    it("should return cancellation when project elicitation is declined", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_list_iterations");
      if (!call) throw new Error("work_list_iterations tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, depth: 2 });

      expect(result.content[0].text).toBe("Project selection cancelled.");
      expect(mockWorkItemTrackingApi.getClassificationNodes).not.toHaveBeenCalled();
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

  describe("get_team_capacity tool", () => {
    it("should call getCapacitiesWithIdentityRefAndTotals API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: [
          {
            teamMember: {
              displayName: "Alex Thompson",
              id: "b4754e26-7767-52c6-939g-21cc067ddc37",
              uniqueName: "alex.thompson@example.com",
              url: "https://spsprodeus24.vssps.visualstudio.com/A6ae0268e-4307-4135-87ef-285d5153a124/_apis/Identities/b4754e26-7767-52c6-939g-21cc067ddc37",
              _links: {
                avatar: {
                  href: "https://dev.azure.com/testorg/_apis/GraphProfile/MemberAvatars/aad.N2NkZmE3NGUtOTk1Ny03OTVjLTliOWYtMWEzM2ZmMjkxZjQy",
                },
              },
              imageUrl: "https://dev.azure.com/testorg/_apis/GraphProfile/MemberAvatars/aad.N2NkZmE3NGUtOTk1Ny03OTVjLTliOWYtMWEzM2ZmMjkxZjQy",
              descriptor: "aad.ZjIzNGU3ZTEtODFhYy00NjIzLWI4ZjUtMzIxNzFmNmNhMjUy",
            },
            activities: [
              {
                capacityPerDay: 4,
                name: "",
              },
            ],
            daysOff: [],
            url: "https://dev.azure.com/testorg/59e5c445-9b24-49c6-9d6c-adf2247ce589/914f4df1-d3cc-44a6-b38e-72ad06a58ea9/_apis/work/teamsettings/iterations/299567e9-f6e6-4a9b-89c8-7a9722e949d7/capacities/b4754e26-7767-52c6-939g-21cc067ddc37",
          },
          {
            teamMember: {
              displayName: "Sarah Wilson",
              id: "9a53abc4-0cb4-40a1-ab5c-8a1fde9aa565",
              uniqueName: "sarah.wilson@example.com",
              url: "https://spsprodeus24.vssps.visualstudio.com/A6ae0268e-4307-4135-87ef-285d5153a124/_apis/Identities/9a53abc4-0cb4-40a1-ab5c-8a1fde9aa565",
              _links: {
                avatar: {
                  href: "https://dev.azure.com/testorg/_apis/GraphProfile/MemberAvatars/aad.MTFiZGYzMTktNDI5Zi03MDYyLTliOTgtODdlYmJkNTY1NzU5",
                },
              },
              imageUrl: "https://dev.azure.com/testorg/_apis/GraphProfile/MemberAvatars/aad.MTFiZGYzMTktNDI5Zi03MDYyLTliOTgtODdlYmJkNTY1NzU5",
              descriptor: "aad.YjMxOGZkNDUtNzQ2Mi00Njk4LWFjMTEtZGJmOTgxZGVjNzYz",
            },
            activities: [
              {
                capacityPerDay: 6,
                name: "",
              },
            ],
            daysOff: [
              {
                start: "2025-10-29T00:00:00.000Z",
                end: "2025-10-29T00:00:00.000Z",
              },
            ],
            url: "https://dev.azure.com/testorg/59e5c445-9b24-49c6-9d6c-adf2247ce589/914f4df1-d3cc-44a6-b38e-72ad06a58ea9/_apis/work/teamsettings/iterations/299567e9-f6e6-4a9b-89c8-7a9722e949d7/capacities/9a53abc4-0cb4-40a1-ab5c-8a1fde9aa565",
          },
        ],
        totalCapacityPerDay: 10,
        totalDaysOff: 1,
      });

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalledWith({ project: "SampleProject", team: "SampleProject Team" }, "299567e9-f6e6-4a9b-89c8-7a9722e949d7");

      const expectedResult = {
        teamMembers: [
          {
            teamMember: {
              displayName: "Alex Thompson",
              id: "b4754e26-7767-52c6-939g-21cc067ddc37",
              uniqueName: "alex.thompson@example.com",
            },
            activities: [
              {
                capacityPerDay: 4,
                name: "",
              },
            ],
            daysOff: [],
          },
          {
            teamMember: {
              displayName: "Sarah Wilson",
              id: "9a53abc4-0cb4-40a1-ab5c-8a1fde9aa565",
              uniqueName: "sarah.wilson@example.com",
            },
            activities: [
              {
                capacityPerDay: 6,
                name: "",
              },
            ],
            daysOff: [
              {
                start: "2025-10-29T00:00:00.000Z",
                end: "2025-10-29T00:00:00.000Z",
              },
            ],
          },
        ],
        totalCapacityPerDay: 10,
        totalDaysOff: 1,
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle team with no capacity assigned", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: [],
        totalCapacityPerDay: 0,
        totalDaysOff: 0,
      });

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalledWith({ project: "SampleProject", team: "SampleProject Team" }, "299567e9-f6e6-4a9b-89c8-7a9722e949d7");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No team capacity assigned to the team");
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No team capacity assigned to the team");
    });

    it("should handle undefined teamMembers array correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: undefined,
        totalCapacityPerDay: 0,
        totalDaysOff: 0,
      });

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();

      // When teamMembers is undefined, the simplified results will have an empty array
      const expectedResult = {
        teamMembers: [],
        totalCapacityPerDay: 0,
        totalDaysOff: 0,
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle team member with undefined teamMember property", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: [
          {
            teamMember: undefined,
            activities: [
              {
                capacityPerDay: 8,
                name: "Development",
              },
            ],
            daysOff: [],
            url: "https://dev.azure.com/example/_apis/work/teamsettings/iterations/test-id/capacities/test-user",
          },
        ],
        totalCapacityPerDay: 8,
        totalDaysOff: 0,
      });

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();

      const expectedResult = {
        teamMembers: [
          {
            teamMember: undefined,
            activities: [
              {
                capacityPerDay: 8,
                name: "Development",
              },
            ],
            daysOff: [],
          },
        ],
        totalCapacityPerDay: 8,
        totalDaysOff: 0,
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve team capacity");
      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting team capacity: Failed to retrieve team capacity");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "SampleProject",
        team: "SampleProject Team",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting team capacity: Unknown error occurred");
    });

    it("should properly simplify team member data by removing unwanted fields", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: [
          {
            teamMember: {
              displayName: "Michael Chen",
              id: "test-id-123",
              uniqueName: "michael.chen@example.com",
              url: "https://example.com/api/identities/test-id-123",
              _links: {
                avatar: {
                  href: "https://example.com/avatar",
                },
              },
              imageUrl: "https://example.com/image",
              descriptor: "aad.fake-descriptor-12345",
              extraField: "this should be removed",
            },
            activities: [
              {
                capacityPerDay: 7.5,
                name: "Development",
              },
            ],
            daysOff: [
              {
                start: "2025-11-01T00:00:00.000Z",
                end: "2025-11-01T00:00:00.000Z",
              },
            ],
            url: "https://example.com/capacity",
          },
        ],
        totalCapacityPerDay: 7.5,
        totalDaysOff: 1,
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        iterationId: "test-iteration-id",
      };

      const result = await handler(params);

      const parsedResult = JSON.parse(result.content[0].text);

      // Verify that only the allowed fields are present in teamMember
      expect(parsedResult.teamMembers[0].teamMember).toEqual({
        displayName: "Michael Chen",
        id: "test-id-123",
        uniqueName: "michael.chen@example.com",
      });

      // Verify that unwanted fields are removed
      expect(parsedResult.teamMembers[0].teamMember.url).toBeUndefined();
      expect(parsedResult.teamMembers[0].teamMember._links).toBeUndefined();
      expect(parsedResult.teamMembers[0].teamMember.imageUrl).toBeUndefined();
      expect(parsedResult.teamMembers[0].teamMember.descriptor).toBeUndefined();
      expect(parsedResult.teamMembers[0].teamMember.extraField).toBeUndefined();

      // Verify that daysOff property is preserved
      expect(parsedResult.teamMembers[0].daysOff).toEqual([
        {
          start: "2025-11-01T00:00:00.000Z",
          end: "2025-11-01T00:00:00.000Z",
        },
      ]);

      // Verify that activities are preserved (not removed)
      expect(parsedResult.teamMembers[0].activities).toEqual([
        {
          capacityPerDay: 7.5,
          name: "Development",
        },
      ]);

      // Verify that url is removed from the simplified result
      expect(parsedResult.teamMembers[0].url).toBeUndefined();

      // Verify that total fields are preserved (not removed)
      expect(parsedResult.totalCapacityPerDay).toBe(7.5);
      expect(parsedResult.totalDaysOff).toBe(1);
    });

    it("should elicit project when not provided and user accepts", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } });

      (mockWorkApi.getCapacitiesWithIdentityRefAndTotals as jest.Mock).mockResolvedValue({
        teamMembers: [
          {
            teamMember: { displayName: "Alex", id: "id-1", uniqueName: "alex@example.com" },
            activities: [{ name: "Development", capacityPerDay: 8 }],
            daysOff: [],
          },
        ],
      });

      const result = await handler({ project: undefined, team: "Team A", iterationId: "iter-1" });

      expect(elicitMock).toHaveBeenCalledTimes(1);
      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Alex");
    });

    it("should return cancellation when project elicitation is declined", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_capacity");
      if (!call) throw new Error("work_get_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, team: "Team A", iterationId: "iter-1" });

      expect(result.content[0].text).toBe("Project selection cancelled.");
      expect(mockWorkApi.getCapacitiesWithIdentityRefAndTotals).not.toHaveBeenCalled();
    });
  });

  describe("update_team_capacity tool", () => {
    it("should call updateCapacityWithIdentityRef API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue({
        teamMember: {
          displayName: "John Doe",
          id: "test-user-id-123",
          uniqueName: "john.doe@example.com",
          url: "https://example.com/api/identities/test-user-id-123",
          _links: {
            avatar: {
              href: "https://example.com/avatar",
            },
          },
          imageUrl: "https://example.com/image",
          descriptor: "aad.test-descriptor",
        },
        activities: [
          {
            capacityPerDay: 8,
            name: "Development",
          },
        ],
        daysOff: [
          {
            start: new Date("2025-12-25T00:00:00.000Z"),
            end: new Date("2025-12-25T00:00:00.000Z"),
          },
        ],
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-123",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 8,
          },
        ],
        daysOff: [
          {
            start: "2025-12-25T00:00:00.000Z",
            end: "2025-12-25T00:00:00.000Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalledWith(
        {
          activities: [
            {
              name: "Development",
              capacityPerDay: 8,
            },
          ],
          daysOff: [
            {
              start: new Date("2025-12-25T00:00:00.000Z"),
              end: new Date("2025-12-25T00:00:00.000Z"),
            },
          ],
        },
        { project: "TestProject", team: "TestTeam" },
        "test-iteration-id",
        "test-user-id-123"
      );

      const expectedResult = {
        teamMember: {
          displayName: "John Doe",
          id: "test-user-id-123",
          uniqueName: "john.doe@example.com",
        },
        activities: [
          {
            capacityPerDay: 8,
            name: "Development",
          },
        ],
        daysOff: [
          {
            start: new Date("2025-12-25T00:00:00.000Z"),
            end: new Date("2025-12-25T00:00:00.000Z"),
          },
        ],
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle updating capacity without daysOff", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue({
        teamMember: {
          displayName: "Jane Smith",
          id: "test-user-id-456",
          uniqueName: "jane.smith@example.com",
        },
        activities: [
          {
            capacityPerDay: 6,
            name: "Testing",
          },
        ],
        daysOff: [],
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-456",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Testing",
            capacityPerDay: 6,
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalledWith(
        {
          activities: [
            {
              name: "Testing",
              capacityPerDay: 6,
            },
          ],
          daysOff: [],
        },
        { project: "TestProject", team: "TestTeam" },
        "test-iteration-id",
        "test-user-id-456"
      );

      const expectedResult = {
        teamMember: {
          displayName: "Jane Smith",
          id: "test-user-id-456",
          uniqueName: "jane.smith@example.com",
        },
        activities: [
          {
            capacityPerDay: 6,
            name: "Testing",
          },
        ],
        daysOff: [],
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle updating capacity with multiple activities", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue({
        teamMember: {
          displayName: "Multi Task User",
          id: "test-user-id-789",
          uniqueName: "multi.task@example.com",
        },
        activities: [
          {
            capacityPerDay: 4,
            name: "Development",
          },
          {
            capacityPerDay: 2,
            name: "Code Review",
          },
          {
            capacityPerDay: 2,
            name: "Documentation",
          },
        ],
        daysOff: [],
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-789",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 4,
          },
          {
            name: "Code Review",
            capacityPerDay: 2,
          },
          {
            name: "Documentation",
            capacityPerDay: 2,
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalledWith(
        {
          activities: [
            {
              name: "Development",
              capacityPerDay: 4,
            },
            {
              name: "Code Review",
              capacityPerDay: 2,
            },
            {
              name: "Documentation",
              capacityPerDay: 2,
            },
          ],
          daysOff: [],
        },
        { project: "TestProject", team: "TestTeam" },
        "test-iteration-id",
        "test-user-id-789"
      );

      const expectedResult = {
        teamMember: {
          displayName: "Multi Task User",
          id: "test-user-id-789",
          uniqueName: "multi.task@example.com",
        },
        activities: [
          {
            capacityPerDay: 4,
            name: "Development",
          },
          {
            capacityPerDay: 2,
            name: "Code Review",
          },
          {
            capacityPerDay: 2,
            name: "Documentation",
          },
        ],
        daysOff: [],
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle updating capacity with unassigned activity (empty name)", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue({
        teamMember: {
          displayName: "Unassigned User",
          id: "test-user-id-000",
          uniqueName: "unassigned.user@example.com",
        },
        activities: [
          {
            capacityPerDay: 4,
            name: "",
          },
        ],
        daysOff: [
          {
            start: new Date("2025-10-29T00:00:00.000Z"),
            end: new Date("2025-10-29T00:00:00.000Z"),
          },
        ],
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-000",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "",
            capacityPerDay: 4,
          },
        ],
        daysOff: [
          {
            start: "2025-10-29T00:00:00.000Z",
            end: "2025-10-29T00:00:00.000Z",
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalledWith(
        {
          activities: [
            {
              name: "",
              capacityPerDay: 4,
            },
          ],
          daysOff: [
            {
              start: new Date("2025-10-29T00:00:00.000Z"),
              end: new Date("2025-10-29T00:00:00.000Z"),
            },
          ],
        },
        { project: "TestProject", team: "TestTeam" },
        "test-iteration-id",
        "test-user-id-000"
      );

      const expectedResult = {
        teamMember: {
          displayName: "Unassigned User",
          id: "test-user-id-000",
          uniqueName: "unassigned.user@example.com",
        },
        activities: [
          {
            capacityPerDay: 4,
            name: "",
          },
        ],
        daysOff: [
          {
            start: new Date("2025-10-29T00:00:00.000Z"),
            end: new Date("2025-10-29T00:00:00.000Z"),
          },
        ],
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-123",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 8,
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Failed to update team member capacity");
    });

    it("should handle undefined teamMember in API result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockResolvedValue({
        teamMember: undefined,
        activities: [
          {
            capacityPerDay: 8,
            name: "Development",
          },
        ],
        daysOff: [],
      });

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-123",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 8,
          },
        ],
      };

      const result = await handler(params);

      const expectedResult = {
        teamMember: undefined,
        activities: [
          {
            capacityPerDay: 8,
            name: "Development",
          },
        ],
        daysOff: [],
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to update capacity");
      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-123",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 8,
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating team capacity: Failed to update capacity");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_update_team_capacity");
      if (!call) throw new Error("work_update_team_capacity tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.updateCapacityWithIdentityRef as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "TestProject",
        team: "TestTeam",
        teamMemberId: "test-user-id-123",
        iterationId: "test-iteration-id",
        activities: [
          {
            name: "Development",
            capacityPerDay: 8,
          },
        ],
      };

      const result = await handler(params);

      expect(mockWorkApi.updateCapacityWithIdentityRef).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating team capacity: Unknown error occurred");
    });
  });

  describe("get_iteration_capacities tool", () => {
    it("should call getTotalIterationCapacities API with the correct parameters and return the expected result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue({
        teams: [
          {
            team: {
              id: "blue-team-id",
              name: "Blue Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/blue-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 16,
              totalDaysOff: 2,
            },
          },
          {
            team: {
              id: "yellow-team-id",
              name: "Yellow Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/yellow-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 24,
              totalDaysOff: 1,
            },
          },
        ],
        totalCapacityPerDay: 40,
        totalDaysOff: 3,
      });

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalledWith("SampleProject", "299567e9-f6e6-4a9b-89c8-7a9722e949d7");

      const expectedResult = {
        teams: [
          {
            team: {
              id: "blue-team-id",
              name: "Blue Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/blue-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 16,
              totalDaysOff: 2,
            },
          },
          {
            team: {
              id: "yellow-team-id",
              name: "Yellow Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/yellow-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 24,
              totalDaysOff: 1,
            },
          },
        ],
        totalCapacityPerDay: 40,
        totalDaysOff: 3,
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle iteration with no teams assigned", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue({
        teams: [],
        totalCapacityPerDay: 0,
        totalDaysOff: 0,
      });

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalledWith("SampleProject", "299567e9-f6e6-4a9b-89c8-7a9722e949d7");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iteration capacity assigned to the teams");
    });

    it("should handle null API results correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iteration capacity assigned to the teams");
    });

    it("should handle undefined teams array correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue({
        teams: undefined,
        totalCapacityPerDay: 0,
        totalDaysOff: 0,
      });

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No iteration capacity assigned to the teams");
    });

    it("should handle single team with capacity", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue({
        teams: [
          {
            team: {
              id: "main-team-id",
              name: "Main Development Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/main-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 32,
              totalDaysOff: 0,
            },
          },
        ],
        totalCapacityPerDay: 32,
        totalDaysOff: 0,
      });

      const params = {
        project: "SingleTeamProject",
        iterationId: "single-team-iteration-id",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalledWith("SingleTeamProject", "single-team-iteration-id");

      const expectedResult = {
        teams: [
          {
            team: {
              id: "main-team-id",
              name: "Main Development Team",
              url: "https://dev.azure.com/example/project/_apis/projects/project-id/teams/main-team-id",
            },
            totalCapacity: {
              totalCapacityPerDay: 32,
              totalDaysOff: 0,
            },
          },
        ],
        totalCapacityPerDay: 32,
        totalDaysOff: 0,
      };

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should handle API errors correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve iteration capacities");
      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting iteration capacities: Failed to retrieve iteration capacities");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "SampleProject",
        iterationId: "299567e9-f6e6-4a9b-89c8-7a9722e949d7",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting iteration capacities: Unknown error occurred");
    });

    it("should elicit project when not provided and user accepts", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } });

      (mockWorkApi.getTotalIterationCapacities as jest.Mock).mockResolvedValue({
        teams: [{ team: { id: "team-1", name: "Team One" } }],
      });

      const result = await handler({ project: undefined, iterationId: "iter-1" });

      expect(elicitMock).toHaveBeenCalledTimes(1);
      expect(mockWorkApi.getTotalIterationCapacities).toHaveBeenCalledWith("ProjectAlpha", "iter-1");
      expect(result.content[0].text).toContain("Team One");
    });

    it("should return cancellation when project elicitation is declined", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_iteration_capacities");
      if (!call) throw new Error("work_get_iteration_capacities tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, iterationId: "iter-1" });

      expect(result.content[0].text).toBe("Project selection cancelled.");
      expect(mockWorkApi.getTotalIterationCapacities).not.toHaveBeenCalled();
    });
  });

  describe("get_team_settings tool", () => {
    it("should call getTeamSettings and getTeamFieldValues APIs and return combined result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue({
        backlogIteration: {
          id: "backlog-iter-id",
          name: "Fabrikam",
          path: "\\Fabrikam",
        },
        defaultIteration: {
          id: "default-iter-id",
          name: "Sprint 1",
          path: "\\Fabrikam\\Sprint 1",
          attributes: {
            startDate: "2025-01-01T00:00:00Z",
            finishDate: "2025-01-14T23:59:59Z",
          },
        },
        defaultIterationMacro: "@CurrentIteration",
        backlogVisibilities: {
          "Microsoft.EpicCategory": true,
          "Microsoft.FeatureCategory": true,
          "Microsoft.RequirementCategory": true,
        },
        bugsBehavior: "asRequirements",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      });

      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue({
        defaultValue: "Fabrikam\\Team A",
        field: {
          referenceName: "System.AreaPath",
          url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.AreaPath",
        },
        values: [
          { value: "Fabrikam\\Team A", includeChildren: true },
          { value: "Fabrikam\\Team A\\Sub Area", includeChildren: false },
        ],
      });

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      const expectedTeamContext = { project: "Fabrikam", team: "Team A" };
      expect(mockWorkApi.getTeamSettings).toHaveBeenCalledWith(expectedTeamContext);
      expect(mockWorkApi.getTeamFieldValues).toHaveBeenCalledWith(expectedTeamContext);

      const expectedResult = {
        backlogIteration: {
          id: "backlog-iter-id",
          name: "Fabrikam",
          path: "\\Fabrikam",
        },
        defaultIteration: {
          id: "default-iter-id",
          name: "Sprint 1",
          path: "\\Fabrikam\\Sprint 1",
          attributes: {
            startDate: "2025-01-01T00:00:00Z",
            finishDate: "2025-01-14T23:59:59Z",
          },
        },
        defaultIterationMacro: "@CurrentIteration",
        backlogVisibilities: {
          "Microsoft.EpicCategory": true,
          "Microsoft.FeatureCategory": true,
          "Microsoft.RequirementCategory": true,
        },
        bugsBehavior: "asRequirements",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        defaultAreaPath: "Fabrikam\\Team A",
        areaPathField: {
          referenceName: "System.AreaPath",
          url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.AreaPath",
        },
        areaPaths: [
          { value: "Fabrikam\\Team A", includeChildren: true },
          { value: "Fabrikam\\Team A\\Sub Area", includeChildren: false },
        ],
      };

      expect(result.content[0].text).toBe("Project: Fabrikam, Team: Team A");
      expect(result.content[1].text).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it("should use default team when team is not provided", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue({
        backlogIteration: {
          id: "backlog-iter-id",
          name: "Fabrikam",
          path: "\\Fabrikam",
        },
        backlogVisibilities: {},
        bugsBehavior: "off",
        workingDays: [],
      });

      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue({
        defaultValue: "Fabrikam",
        values: [{ value: "Fabrikam", includeChildren: true }],
      });

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Fabrikam Team" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { team: "Fabrikam Team" } });

      const params = {
        project: "Fabrikam",
        team: undefined,
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamSettings).toHaveBeenCalledWith({ project: "Fabrikam", team: "Fabrikam Team" });
      expect(mockWorkApi.getTeamFieldValues).toHaveBeenCalledWith({ project: "Fabrikam", team: "Fabrikam Team" });

      expect(result.content[0].text).toBe("Project: Fabrikam, Team: Fabrikam Team");
      const parsedResult = JSON.parse(result.content[1].text);

      expect(parsedResult.backlogIteration).toEqual({
        id: "backlog-iter-id",
        name: "Fabrikam",
        path: "\\Fabrikam",
      });
      expect(parsedResult.defaultAreaPath).toBe("Fabrikam");
    });

    it("should handle null team settings result", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      expect(mockWorkApi.getTeamFieldValues).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No team settings found");
    });

    it("should handle null team field values gracefully", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue({
        backlogIteration: {
          id: "backlog-iter-id",
          name: "Fabrikam",
          path: "\\Fabrikam",
        },
        defaultIteration: undefined,
        defaultIterationMacro: "@CurrentIteration",
        backlogVisibilities: {},
        bugsBehavior: "off",
        workingDays: [],
      });

      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      expect(result.content[0].text).toBe("Project: Fabrikam, Team: Team A");
      const parsedResult = JSON.parse(result.content[1].text);

      expect(parsedResult.backlogIteration).toEqual({
        id: "backlog-iter-id",
        name: "Fabrikam",
        path: "\\Fabrikam",
      });
      expect(parsedResult.defaultIteration).toBeUndefined();
      expect(parsedResult.defaultAreaPath).toBeUndefined();
      expect(parsedResult.areaPaths).toBeUndefined();
      expect(parsedResult.areaPathField).toBeUndefined();
    });

    it("should handle getTeamSettings API error correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve team settings");
      (mockWorkApi.getTeamSettings as jest.Mock).mockRejectedValue(testError);
      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching team settings: Failed to retrieve team settings");
    });

    it("should handle getTeamFieldValues API error correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue({
        backlogIteration: {
          id: "backlog-iter-id",
          name: "Fabrikam",
          path: "\\Fabrikam",
        },
        backlogVisibilities: {},
        bugsBehavior: "off",
        workingDays: [],
      });
      const testError = new Error("Failed to retrieve team field values");
      (mockWorkApi.getTeamFieldValues as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching team settings: Failed to retrieve team field values");
    });

    it("should handle unknown error type correctly", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockWorkApi.getTeamSettings as jest.Mock).mockRejectedValue("string error");
      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "Fabrikam",
        team: "Team A",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching team settings: Unknown error occurred");
    });

    it("should elicit project and team when not provided and user accepts", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } }).mockResolvedValueOnce({ action: "accept", content: { team: "Team One" } });

      (mockWorkApi.getTeamSettings as jest.Mock).mockResolvedValue({
        backlogIteration: { id: "backlog-iter-id", name: "ProjectAlpha", path: "\\ProjectAlpha" },
        backlogVisibilities: {},
        bugsBehavior: "off",
        workingDays: [],
      });
      (mockWorkApi.getTeamFieldValues as jest.Mock).mockResolvedValue(null);

      const result = await handler({ project: undefined, team: undefined });

      expect(elicitMock).toHaveBeenCalledTimes(2);
      expect(mockWorkApi.getTeamSettings).toHaveBeenCalled();
      expect(result.content[0].text).toBe("Project: ProjectAlpha, Team: Team One");
      expect(result.content[1].text).toContain("backlogIteration");
    });

    it("should return cancellation when project elicitation is declined for team settings", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, team: undefined });

      expect(result.content[0].text).toBe("Project selection cancelled.");
      expect(mockWorkApi.getTeamSettings).not.toHaveBeenCalled();
    });

    it("should return cancellation when team elicitation is declined for team settings", async () => {
      configureWorkTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "work_get_team_settings");
      if (!call) throw new Error("work_get_team_settings tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValueOnce({ action: "accept", content: { project: "ProjectAlpha" } }).mockResolvedValueOnce({ action: "decline" });

      const result = await handler({ project: undefined, team: undefined });

      expect(result.content[0].text).toBe("Team selection cancelled.");
      expect(mockWorkApi.getTeamSettings).not.toHaveBeenCalled();
    });
  });

  const getPlanHandler = (toolName: string) => {
    configureWorkTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  };

  describe("list_plans tool", () => {
    it("returns delivery plans for a project", async () => {
      const handler = getPlanHandler("work_list_plans");

      mockWorkApi.getPlans.mockResolvedValue([{ id: "plan-1", name: "Plan One" }]);

      const result = await handler({ project: "Proj" });

      expect(mockWorkApi.getPlans).toHaveBeenCalledWith("Proj");
      expect(result.content[0].text).toBe(JSON.stringify([{ id: "plan-1", name: "Plan One" }], null, 2));
    });

    it("returns an error when no plans are found", async () => {
      const handler = getPlanHandler("work_list_plans");

      mockWorkApi.getPlans.mockResolvedValue([]);

      const result = await handler({ project: "Proj" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No delivery plans found");
    });
  });

  describe("get_plan tool", () => {
    it("returns a single delivery plan", async () => {
      const handler = getPlanHandler("work_get_plan");

      mockWorkApi.getPlan.mockResolvedValue({ id: "plan-1", name: "Plan One" });

      const result = await handler({ project: "Proj", id: "plan-1" });

      expect(mockWorkApi.getPlan).toHaveBeenCalledWith("Proj", "plan-1");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "plan-1", name: "Plan One" }, null, 2));
    });
  });

  describe("create_plan tool", () => {
    it("creates a delivery plan", async () => {
      const handler = getPlanHandler("work_create_plan");

      mockWorkApi.createPlan.mockResolvedValue({ id: "plan-2", name: "New Plan" });

      const result = await handler({ project: "Proj", name: "New Plan", description: "desc" });

      expect(mockWorkApi.createPlan).toHaveBeenCalledWith({ name: "New Plan", description: "desc", type: 0, properties: undefined }, "Proj");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "plan-2", name: "New Plan" }, null, 2));
    });

    it("handles API errors", async () => {
      const handler = getPlanHandler("work_create_plan");

      mockWorkApi.createPlan.mockRejectedValue(new Error("boom"));

      const result = await handler({ project: "Proj", name: "New Plan" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating delivery plan: boom");
    });
  });

  describe("update_plan tool", () => {
    it("merges provided fields onto the existing plan, preserving the rest", async () => {
      const handler = getPlanHandler("work_update_plan");

      mockWorkApi.getPlan.mockResolvedValue({ id: "plan-1", name: "Old", description: "old desc", type: 0, properties: { team: "A" } });
      mockWorkApi.updatePlan.mockResolvedValue({ id: "plan-1", name: "Updated" });

      const result = await handler({ project: "Proj", id: "plan-1", revision: 3, name: "Updated" });

      expect(mockWorkApi.getPlan).toHaveBeenCalledWith("Proj", "plan-1");
      // description and properties were not supplied, so the existing values are preserved.
      expect(mockWorkApi.updatePlan).toHaveBeenCalledWith({ name: "Updated", description: "old desc", revision: 3, type: 0, properties: { team: "A" } }, "Proj", "plan-1");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "plan-1", name: "Updated" }, null, 2));
    });

    it("returns an error when the plan does not exist", async () => {
      const handler = getPlanHandler("work_update_plan");

      mockWorkApi.getPlan.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", id: "missing", revision: 1, name: "x" });

      expect(result.isError).toBe(true);
      expect(mockWorkApi.updatePlan).not.toHaveBeenCalled();
    });
  });

  describe("delete_plan tool", () => {
    it("deletes a delivery plan", async () => {
      const handler = getPlanHandler("work_delete_plan");

      mockWorkApi.deletePlan.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", id: "plan-1" });

      expect(mockWorkApi.deletePlan).toHaveBeenCalledWith("Proj", "plan-1");
      expect(result.content[0].text).toContain("deleted");
    });

    it("handles API errors", async () => {
      const handler = getPlanHandler("work_delete_plan");

      mockWorkApi.deletePlan.mockRejectedValue(new Error("denied"));

      const result = await handler({ project: "Proj", id: "plan-1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error deleting delivery plan: denied");
    });
  });

  describe("list_areas tool", () => {
    it("returns only Area nodes from the project", async () => {
      const handler = getPlanHandler("work_list_areas");

      mockWorkItemTrackingApi.getClassificationNodes.mockResolvedValue([
        { id: 1, name: "AreaRoot", structureType: TreeNodeStructureType.Area },
        { id: 2, name: "IterationRoot", structureType: TreeNodeStructureType.Iteration },
      ]);

      const result = await handler({ project: "Proj", depth: 2 });

      expect(mockWorkItemTrackingApi.getClassificationNodes).toHaveBeenCalledWith("Proj", [], 2);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "AreaRoot", structureType: TreeNodeStructureType.Area }], null, 2));
    });

    it("returns an error when no areas are found", async () => {
      const handler = getPlanHandler("work_list_areas");

      mockWorkItemTrackingApi.getClassificationNodes.mockResolvedValue([{ id: 2, name: "IterationRoot", structureType: TreeNodeStructureType.Iteration }]);

      const result = await handler({ project: "Proj", depth: 2 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No area paths found");
    });
  });

  describe("create_area tool", () => {
    it("creates an area under the given parent path via a correctly-scoped REST POST", async () => {
      const handler = getPlanHandler("work_create_area");

      mockConnection.rest.create.mockResolvedValue({ result: { id: 5, name: "NewArea" } });

      const result = await handler({ project: "Proj", name: "NewArea", parentPath: "Parent" });

      // The URL must contain the "areas" structure-group segment — the bug being fixed
      // was that TreeStructureGroup.Areas (0) was dropped from the SDK-built URL.
      expect(mockConnection.vsoClient.resolveUrl).toHaveBeenCalledWith("/Proj/_apis/wit/classificationNodes/areas/Parent?api-version=7.1");
      expect(mockConnection.rest.create).toHaveBeenCalledWith("https://dev.azure.com/org/Proj/_apis/wit/classificationNodes/areas/Parent?api-version=7.1", { name: "NewArea" });
      expect(mockWorkItemTrackingApi.createOrUpdateClassificationNode).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify({ id: 5, name: "NewArea" }, null, 2));
    });

    it("creates an area at the project root when no parent path is given", async () => {
      const handler = getPlanHandler("work_create_area");

      mockConnection.rest.create.mockResolvedValue({ result: { id: 6, name: "RootArea" } });

      await handler({ project: "Proj", name: "RootArea" });

      expect(mockConnection.vsoClient.resolveUrl).toHaveBeenCalledWith("/Proj/_apis/wit/classificationNodes/areas?api-version=7.1");
    });

    it("handles API errors", async () => {
      const handler = getPlanHandler("work_create_area");

      mockConnection.rest.create.mockRejectedValue(new Error("boom"));

      const result = await handler({ project: "Proj", name: "NewArea" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating area path: boom");
    });
  });

  describe("update_area tool", () => {
    it("renames an area at the given path via a correctly-scoped REST PATCH", async () => {
      const handler = getPlanHandler("work_update_area");

      mockConnection.rest.update.mockResolvedValue({ result: { id: 5, name: "Renamed" } });

      const result = await handler({ project: "Proj", path: "Parent/Child", name: "Renamed" });

      expect(mockConnection.rest.update).toHaveBeenCalledWith("https://dev.azure.com/org/Proj/_apis/wit/classificationNodes/areas/Parent/Child?api-version=7.1", { name: "Renamed" });
      expect(mockWorkItemTrackingApi.updateClassificationNode).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify({ id: 5, name: "Renamed" }, null, 2));
    });
  });

  describe("delete_area tool", () => {
    it("deletes an area and reclassifies to the given id via a correctly-scoped REST DELETE", async () => {
      const handler = getPlanHandler("work_delete_area");

      mockConnection.rest.del.mockResolvedValue({ result: null });

      const result = await handler({ project: "Proj", path: "Parent/Child", reclassifyId: 7 });

      expect(mockConnection.rest.del).toHaveBeenCalledWith("https://dev.azure.com/org/Proj/_apis/wit/classificationNodes/areas/Parent/Child?api-version=7.1&%24reclassifyId=7");
      expect(mockWorkItemTrackingApi.deleteClassificationNode).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain("reclassified to area ID 7");
    });

    it("handles API errors", async () => {
      const handler = getPlanHandler("work_delete_area");

      mockConnection.rest.del.mockRejectedValue(new Error("denied"));

      const result = await handler({ project: "Proj", path: "Parent/Child", reclassifyId: 7 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error deleting area path: denied");
    });
  });

  describe("update_iteration tool", () => {
    it("updates name and dates", async () => {
      const handler = getPlanHandler("work_update_iteration");

      mockWorkItemTrackingApi.updateClassificationNode.mockResolvedValue({ id: 9, name: "Sprint 1b" });

      const result = await handler({ project: "Proj", path: "Sprint 1", name: "Sprint 1b", startDate: "2023-01-01T00:00:00Z", finishDate: "2023-01-14T00:00:00Z" });

      expect(mockWorkItemTrackingApi.updateClassificationNode).toHaveBeenCalledWith(
        { name: "Sprint 1b", attributes: { startDate: new Date("2023-01-01T00:00:00Z"), finishDate: new Date("2023-01-14T00:00:00Z") } },
        "Proj",
        TreeStructureGroup.Iterations,
        "Sprint 1"
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: 9, name: "Sprint 1b" }, null, 2));
    });

    it("returns an error when no fields are provided", async () => {
      const handler = getPlanHandler("work_update_iteration");

      const result = await handler({ project: "Proj", path: "Sprint 1" });

      expect(result.isError).toBe(true);
      expect(mockWorkItemTrackingApi.updateClassificationNode).not.toHaveBeenCalled();
    });
  });

  describe("delete_iteration tool", () => {
    it("deletes an iteration and reclassifies to the given id", async () => {
      const handler = getPlanHandler("work_delete_iteration");

      mockWorkItemTrackingApi.deleteClassificationNode.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", path: "Sprint 1", reclassifyId: 3 });

      expect(mockWorkItemTrackingApi.deleteClassificationNode).toHaveBeenCalledWith("Proj", TreeStructureGroup.Iterations, "Sprint 1", 3);
      expect(result.content[0].text).toContain("reclassified to iteration ID 3");
    });
  });

  describe("set_team_area_paths tool", () => {
    it("sets the team's default and owned area paths", async () => {
      const handler = getPlanHandler("work_set_team_area_paths");

      mockWorkApi.updateTeamFieldValues.mockResolvedValue({ defaultValue: "Proj\\A" });

      const result = await handler({
        project: "Proj",
        team: "Team",
        defaultAreaPath: "Proj\\A",
        areaPaths: [{ path: "Proj\\A", includeChildren: true }, { path: "Proj\\B" }],
      });

      expect(mockWorkApi.updateTeamFieldValues).toHaveBeenCalledWith(
        {
          defaultValue: "Proj\\A",
          values: [
            { value: "Proj\\A", includeChildren: true },
            { value: "Proj\\B", includeChildren: false },
          ],
        },
        { project: "Proj", team: "Team" }
      );
      expect(result.content[1].text).toBe(JSON.stringify({ defaultValue: "Proj\\A" }, null, 2));
    });

    it("returns an error when no fields are provided", async () => {
      const handler = getPlanHandler("work_set_team_area_paths");

      const result = await handler({ project: "Proj", team: "Team" });

      expect(result.isError).toBe(true);
      expect(mockWorkApi.updateTeamFieldValues).not.toHaveBeenCalled();
    });
  });

  describe("list_boards tool", () => {
    it("returns boards for the team", async () => {
      const handler = getPlanHandler("work_list_boards");
      mockWorkApi.getBoards.mockResolvedValue([{ id: "b1", name: "Stories" }]);

      const result = await handler({ project: "Proj", team: "Team" });

      expect(mockWorkApi.getBoards).toHaveBeenCalledWith({ project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Stories");
    });

    it("returns an error when no boards are found", async () => {
      const handler = getPlanHandler("work_list_boards");
      mockWorkApi.getBoards.mockResolvedValue([]);

      const result = await handler({ project: "Proj", team: "Team" });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_board_columns tool", () => {
    it("returns the board columns", async () => {
      const handler = getPlanHandler("work_get_board_columns");
      mockWorkApi.getBoardColumns.mockResolvedValue([{ name: "To Do" }, { name: "Done" }]);

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardColumns).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("To Do");
    });
  });

  describe("get_board_rows tool", () => {
    it("returns the board rows", async () => {
      const handler = getPlanHandler("work_get_board_rows");
      mockWorkApi.getBoardRows.mockResolvedValue([{ name: "Default" }]);

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardRows).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("Default");
    });
  });

  describe("get_backlog_configuration tool", () => {
    it("returns the backlog configuration", async () => {
      const handler = getPlanHandler("work_get_backlog_configuration");
      mockWorkApi.getBacklogConfigurations.mockResolvedValue({ requirementBacklog: { name: "Stories" } });

      const result = await handler({ project: "Proj", team: "Team" });

      expect(mockWorkApi.getBacklogConfigurations).toHaveBeenCalledWith({ project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Stories");
    });
  });

  describe("get_team_days_off tool", () => {
    it("returns the team's days off for the iteration", async () => {
      const handler = getPlanHandler("work_get_team_days_off");
      mockWorkApi.getTeamDaysOff.mockResolvedValue({ daysOff: [] });

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1" });

      expect(mockWorkApi.getTeamDaysOff).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "iter-1");
      expect(result.content[0].text).toContain("daysOff");
    });
  });

  describe("set_team_days_off tool", () => {
    it("converts ISO dates and replaces the team's days off", async () => {
      const handler = getPlanHandler("work_set_team_days_off");
      mockWorkApi.updateTeamDaysOff.mockResolvedValue({ daysOff: [{}] });

      const result = await handler({
        project: "Proj",
        team: "Team",
        iterationId: "iter-1",
        daysOff: [{ start: "2023-01-02T00:00:00Z", end: "2023-01-03T00:00:00Z" }],
      });

      expect(mockWorkApi.updateTeamDaysOff).toHaveBeenCalledWith(
        { daysOff: [{ start: new Date("2023-01-02T00:00:00Z"), end: new Date("2023-01-03T00:00:00Z") }] },
        { project: "Proj", team: "Team" },
        "iter-1"
      );
      expect(result.content[0].text).toContain("daysOff");
    });
  });

  describe("board write tools", () => {
    it("update_board_columns passes the full column set", async () => {
      const handler = getPlanHandler("work_update_board_columns");
      mockWorkApi.updateBoardColumns.mockResolvedValue([{ name: "To Do" }]);

      const cols = [{ name: "To Do" }, { name: "Done" }];
      const result = await handler({ project: "Proj", team: "Team", board: "Stories", columns: cols });

      expect(mockWorkApi.updateBoardColumns).toHaveBeenCalledWith(cols, { project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("To Do");
    });

    it("update_board_rows passes the full row set", async () => {
      const handler = getPlanHandler("work_update_board_rows");
      mockWorkApi.updateBoardRows.mockResolvedValue([{ name: "Default" }]);

      const rows = [{ name: "Default" }, { name: "Expedite" }];
      const result = await handler({ project: "Proj", team: "Team", board: "Stories", rows });

      expect(mockWorkApi.updateBoardRows).toHaveBeenCalledWith(rows, { project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("Default");
    });

    it("get_board_card_settings returns settings", async () => {
      const handler = getPlanHandler("work_get_board_card_settings");
      mockWorkApi.getBoardCardSettings.mockResolvedValue({ cards: {} });

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardCardSettings).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("cards");
    });

    it("update_board_card_settings passes the settings object", async () => {
      const handler = getPlanHandler("work_update_board_card_settings");
      mockWorkApi.updateBoardCardSettings.mockResolvedValue({ cards: {} });

      const cardSettings = { cards: { foo: [] } };
      const result = await handler({ project: "Proj", team: "Team", board: "Stories", cardSettings });

      expect(mockWorkApi.updateBoardCardSettings).toHaveBeenCalledWith(cardSettings, { project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("cards");
    });

    it("update_board_card_rule_settings passes the rule settings object", async () => {
      const handler = getPlanHandler("work_update_board_card_rule_settings");
      mockWorkApi.updateBoardCardRuleSettings.mockResolvedValue({ rules: {} });

      const ruleSettings = { rules: { fill: [] } };
      const result = await handler({ project: "Proj", team: "Team", board: "Stories", ruleSettings });

      expect(mockWorkApi.updateBoardCardRuleSettings).toHaveBeenCalledWith(ruleSettings, { project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("rules");
    });

    it("list_board_charts returns charts", async () => {
      const handler = getPlanHandler("work_list_board_charts");
      mockWorkApi.getBoardCharts.mockResolvedValue([{ name: "CumulativeFlow" }]);

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardCharts).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("CumulativeFlow");
    });

    it("update_board_chart passes name and chart", async () => {
      const handler = getPlanHandler("work_update_board_chart");
      mockWorkApi.updateBoardChart.mockResolvedValue({ name: "CumulativeFlow" });

      const chart = { name: "CumulativeFlow", settings: {} };
      const result = await handler({ project: "Proj", team: "Team", board: "Stories", name: "CumulativeFlow", chart });

      expect(mockWorkApi.updateBoardChart).toHaveBeenCalledWith(chart, { project: "Proj", team: "Team" }, "Stories", "CumulativeFlow");
      expect(result.content[0].text).toContain("CumulativeFlow");
    });
  });

  describe("backlogs and iteration work item tools", () => {
    it("list_backlogs returns backlog levels", async () => {
      const handler = getPlanHandler("work_list_backlogs");
      mockWorkApi.getBacklogs.mockResolvedValue([{ id: "Microsoft.EpicCategory", name: "Epics" }]);

      const result = await handler({ project: "Proj", team: "Team" });

      expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({ project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Epics");
    });

    it("list_backlogs reports when none found", async () => {
      const handler = getPlanHandler("work_list_backlogs");
      mockWorkApi.getBacklogs.mockResolvedValue([]);

      const result = await handler({ project: "Proj", team: "Team" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No backlogs found");
    });

    it("get_backlog passes the backlog id", async () => {
      const handler = getPlanHandler("work_get_backlog");
      mockWorkApi.getBacklog.mockResolvedValue({ id: "Microsoft.EpicCategory" });

      const result = await handler({ project: "Proj", team: "Team", id: "Microsoft.EpicCategory" });

      expect(mockWorkApi.getBacklog).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Microsoft.EpicCategory");
      expect(result.content[0].text).toContain("Microsoft.EpicCategory");
    });

    it("get_backlog_work_items passes the backlog id", async () => {
      const handler = getPlanHandler("work_get_backlog_work_items");
      mockWorkApi.getBacklogLevelWorkItems.mockResolvedValue({ workItems: [] });

      const result = await handler({ project: "Proj", team: "Team", backlogId: "Microsoft.RequirementCategory" });

      expect(mockWorkApi.getBacklogLevelWorkItems).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Microsoft.RequirementCategory");
      expect(result.content[0].text).toContain("workItems");
    });

    it("get_iteration_work_items passes the iteration id", async () => {
      const handler = getPlanHandler("work_get_iteration_work_items");
      mockWorkApi.getIterationWorkItems.mockResolvedValue({ workItemRelations: [] });

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1" });

      expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "iter-1");
      expect(result.content[0].text).toContain("workItemRelations");
    });

    it("remove_team_iteration deletes the iteration", async () => {
      const handler = getPlanHandler("work_remove_team_iteration");
      mockWorkApi.deleteTeamIteration.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", team: "Team", id: "iter-1" });

      expect(mockWorkApi.deleteTeamIteration).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "iter-1");
      expect(result.content[0].text).toContain("removed from team");
    });

    it("reorder_backlog_work_items builds the reorder operation", async () => {
      const handler = getPlanHandler("work_reorder_backlog_work_items");
      mockWorkApi.reorderBacklogWorkItems.mockResolvedValue([{ id: 1, order: 100 }]);

      const result = await handler({ project: "Proj", team: "Team", ids: [1, 2], previousId: 0, nextId: 3 });

      expect(mockWorkApi.reorderBacklogWorkItems).toHaveBeenCalledWith({ ids: [1, 2], previousId: 0, nextId: 3, parentId: undefined, iterationPath: undefined }, { project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("order");
    });

    it("reorder_iteration_work_items builds the reorder operation", async () => {
      const handler = getPlanHandler("work_reorder_iteration_work_items");
      mockWorkApi.reorderIterationWorkItems.mockResolvedValue([{ id: 1, order: 100 }]);

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1", ids: [5] });

      expect(mockWorkApi.reorderIterationWorkItems).toHaveBeenCalledWith(
        { ids: [5], previousId: undefined, nextId: undefined, parentId: undefined, iterationPath: undefined },
        { project: "Proj", team: "Team" },
        "iter-1"
      );
      expect(result.content[0].text).toContain("order");
    });
  });

  describe("board, delivery timeline, process and query tools", () => {
    it("get_board passes the board id", async () => {
      const handler = getPlanHandler("work_get_board");
      mockWorkApi.getBoard.mockResolvedValue({ name: "Stories" });

      const result = await handler({ project: "Proj", team: "Team", id: "Stories" });

      expect(mockWorkApi.getBoard).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("Stories");
    });

    it("get_board_user_settings returns settings", async () => {
      const handler = getPlanHandler("work_get_board_user_settings");
      mockWorkApi.getBoardUserSettings.mockResolvedValue({ autoRefreshState: true });

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardUserSettings).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("autoRefreshState");
    });

    it("get_delivery_timeline converts date filters", async () => {
      const handler = getPlanHandler("work_get_delivery_timeline");
      mockWorkApi.getDeliveryTimelineData.mockResolvedValue({ id: "plan-1" });

      const result = await handler({ project: "Proj", id: "plan-1", revision: 2, startDate: "2024-01-01T00:00:00Z", endDate: "2024-03-31T00:00:00Z" });

      expect(mockWorkApi.getDeliveryTimelineData).toHaveBeenCalledWith("Proj", "plan-1", 2, new Date("2024-01-01T00:00:00Z"), new Date("2024-03-31T00:00:00Z"));
      expect(result.content[0].text).toContain("plan-1");
    });

    it("get_delivery_timeline passes undefined dates when omitted", async () => {
      const handler = getPlanHandler("work_get_delivery_timeline");
      mockWorkApi.getDeliveryTimelineData.mockResolvedValue({ id: "plan-1" });

      await handler({ project: "Proj", id: "plan-1" });

      expect(mockWorkApi.getDeliveryTimelineData).toHaveBeenCalledWith("Proj", "plan-1", undefined, undefined, undefined);
    });

    it("get_process_configuration returns config", async () => {
      const handler = getPlanHandler("work_get_process_configuration");
      mockWorkApi.getProcessConfiguration.mockResolvedValue({ typeFields: {} });

      const result = await handler({ project: "Proj" });

      expect(mockWorkApi.getProcessConfiguration).toHaveBeenCalledWith("Proj");
      expect(result.content[0].text).toContain("typeFields");
    });

    it("list_predefined_queries returns queries", async () => {
      const handler = getPlanHandler("work_list_predefined_queries");
      mockWorkApi.getPredefinedQueries.mockResolvedValue([{ id: "UnparentedWorkItems" }]);

      const result = await handler({ project: "Proj" });

      expect(mockWorkApi.getPredefinedQueries).toHaveBeenCalledWith("Proj");
      expect(result.content[0].text).toContain("UnparentedWorkItems");
    });

    it("get_predefined_query_results passes paging options", async () => {
      const handler = getPlanHandler("work_get_predefined_query_results");
      mockWorkApi.getPredefinedQueryResults.mockResolvedValue({ id: "UnparentedWorkItems", results: [] });

      const result = await handler({ project: "Proj", id: "UnparentedWorkItems", top: 50, includeCompleted: true });

      expect(mockWorkApi.getPredefinedQueryResults).toHaveBeenCalledWith("Proj", "UnparentedWorkItems", 50, true);
      expect(result.content[0].text).toContain("UnparentedWorkItems");
    });
  });

  describe("taskboard tools", () => {
    it("get_taskboard_columns returns columns", async () => {
      const handler = getPlanHandler("work_get_taskboard_columns");
      mockWorkApi.getColumns.mockResolvedValue({ columns: [{ name: "To Do" }] });

      const result = await handler({ project: "Proj", team: "Team" });

      expect(mockWorkApi.getColumns).toHaveBeenCalledWith({ project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("To Do");
    });

    it("update_taskboard_columns passes the full column set", async () => {
      const handler = getPlanHandler("work_update_taskboard_columns");
      mockWorkApi.updateColumns.mockResolvedValue({ columns: [{ name: "In Progress" }] });

      const columns = [{ name: "In Progress", order: 1, mappings: [{ state: "Active", workItemType: "Task" }] }];
      const result = await handler({ project: "Proj", team: "Team", columns });

      expect(mockWorkApi.updateColumns).toHaveBeenCalledWith(columns, { project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("In Progress");
    });

    it("get_taskboard_work_item_columns passes the iteration id", async () => {
      const handler = getPlanHandler("work_get_taskboard_work_item_columns");
      mockWorkApi.getWorkItemColumns.mockResolvedValue([{ workItemId: 5, column: "To Do" }]);

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1" });

      expect(mockWorkApi.getWorkItemColumns).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "iter-1");
      expect(result.content[0].text).toContain("To Do");
    });

    it("update_taskboard_work_item_column moves a work item", async () => {
      const handler = getPlanHandler("work_update_taskboard_work_item_column");
      mockWorkApi.updateWorkItemColumn.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1", workItemId: 5, newColumn: "Done" });

      expect(mockWorkApi.updateWorkItemColumn).toHaveBeenCalledWith({ newColumn: "Done" }, { project: "Proj", team: "Team" }, "iter-1", 5);
      expect(result.content[0].text).toContain("moved to taskboard column 'Done'");
    });

    it("update_taskboard_card_settings passes the settings object", async () => {
      const handler = getPlanHandler("work_update_taskboard_card_settings");
      mockWorkApi.updateTaskboardCardSettings.mockResolvedValue(undefined);

      const cardSettings = { cards: { Task: [] } };
      const result = await handler({ project: "Proj", team: "Team", cardSettings });

      expect(mockWorkApi.updateTaskboardCardSettings).toHaveBeenCalledWith(cardSettings, { project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Taskboard card settings updated");
    });

    it("update_taskboard_card_rule_settings passes the rule settings object", async () => {
      const handler = getPlanHandler("work_update_taskboard_card_rule_settings");
      mockWorkApi.updateTaskboardCardRuleSettings.mockResolvedValue(undefined);

      const ruleSettings = { rules: { fill: [] } };
      const result = await handler({ project: "Proj", team: "Team", ruleSettings });

      expect(mockWorkApi.updateTaskboardCardRuleSettings).toHaveBeenCalledWith(ruleSettings, { project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Taskboard card rule settings updated");
    });
  });

  describe("suggested values, mapping, capacity and automation tools", () => {
    it("get_column_suggested_values passes the project", async () => {
      const handler = getPlanHandler("work_get_column_suggested_values");
      mockWorkApi.getColumnSuggestedValues.mockResolvedValue([{ shortName: "Active" }]);

      const result = await handler({ project: "Proj" });

      expect(mockWorkApi.getColumnSuggestedValues).toHaveBeenCalledWith("Proj");
      expect(result.content[0].text).toContain("Active");
    });

    it("get_row_suggested_values passes the project", async () => {
      const handler = getPlanHandler("work_get_row_suggested_values");
      mockWorkApi.getRowSuggestedValues.mockResolvedValue([{ shortName: "Expedite" }]);

      const result = await handler({ project: "Proj" });

      expect(mockWorkApi.getRowSuggestedValues).toHaveBeenCalledWith("Proj");
      expect(result.content[0].text).toContain("Expedite");
    });

    it("get_board_mapping_parent_items passes category and ids", async () => {
      const handler = getPlanHandler("work_get_board_mapping_parent_items");
      mockWorkApi.getBoardMappingParentItems.mockResolvedValue([{ childWorkItemId: 5, parentWorkItemId: 1 }]);

      const result = await handler({ project: "Proj", team: "Team", childBacklogContextCategoryRefName: "Microsoft.RequirementCategory", workItemIds: [5, 6] });

      expect(mockWorkApi.getBoardMappingParentItems).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Microsoft.RequirementCategory", [5, 6]);
      expect(result.content[0].text).toContain("parentWorkItemId");
    });

    it("get_team_member_capacity passes iteration and member", async () => {
      const handler = getPlanHandler("work_get_team_member_capacity");
      mockWorkApi.getCapacityWithIdentityRef.mockResolvedValue({ activities: [] });

      const result = await handler({ project: "Proj", team: "Team", iterationId: "iter-1", teamMemberId: "member-1" });

      expect(mockWorkApi.getCapacityWithIdentityRef).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "iter-1", "member-1");
      expect(result.content[0].text).toContain("activities");
    });

    it("replace_team_capacities builds the identity-ref payload", async () => {
      const handler = getPlanHandler("work_replace_team_capacities");
      mockWorkApi.replaceCapacitiesWithIdentityRef.mockResolvedValue([{ teamMember: { id: "member-1" } }]);

      const result = await handler({
        project: "Proj",
        team: "Team",
        iterationId: "iter-1",
        capacities: [{ teamMemberId: "member-1", activities: [{ name: "Development", capacityPerDay: 6 }], daysOff: [{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }] }],
      });

      expect(mockWorkApi.replaceCapacitiesWithIdentityRef).toHaveBeenCalledWith(
        [
          {
            teamMember: { id: "member-1" },
            activities: [{ name: "Development", capacityPerDay: 6 }],
            daysOff: [{ start: new Date("2024-01-01T00:00:00Z"), end: new Date("2024-01-02T00:00:00Z") }],
          },
        ],
        { project: "Proj", team: "Team" },
        "iter-1"
      );
      expect(result.content[0].text).toContain("member-1");
    });

    it("update_automation_rule builds the request model", async () => {
      const handler = getPlanHandler("work_update_automation_rule");
      mockWorkApi.updateAutomationRule.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", team: "Team", backlogLevelName: "Stories", rulesStates: { ClosedParentRule: true } });

      expect(mockWorkApi.updateAutomationRule).toHaveBeenCalledWith({ backlogLevelName: "Stories", rulesStates: { ClosedParentRule: true } }, { project: "Proj", team: "Team" });
      expect(result.content[0].text).toContain("Automation rules updated");
    });
  });

  describe("board card rules and charts", () => {
    it("get_board_card_rule_settings returns the rule settings", async () => {
      const handler = getPlanHandler("work_get_board_card_rule_settings");
      mockWorkApi.getBoardCardRuleSettings.mockResolvedValue({ rules: { fill: [] } });

      const result = await handler({ project: "Proj", team: "Team", board: "Stories" });

      expect(mockWorkApi.getBoardCardRuleSettings).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories");
      expect(result.content[0].text).toContain("rules");
    });

    it("get_board_card_rule_settings surfaces errors", async () => {
      const handler = getPlanHandler("work_get_board_card_rule_settings");
      mockWorkApi.getBoardCardRuleSettings.mockRejectedValue(new Error("board not found"));

      const result = await handler({ project: "Proj", team: "Team", board: "Nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("board not found");
    });

    it("get_board_chart returns a chart by name", async () => {
      const handler = getPlanHandler("work_get_board_chart");
      mockWorkApi.getBoardChart.mockResolvedValue({ name: "CumulativeFlow" });

      const result = await handler({ project: "Proj", team: "Team", board: "Stories", name: "CumulativeFlow" });

      expect(mockWorkApi.getBoardChart).toHaveBeenCalledWith({ project: "Proj", team: "Team" }, "Stories", "CumulativeFlow");
      expect(result.content[0].text).toContain("CumulativeFlow");
    });

    it("get_board_chart surfaces errors", async () => {
      const handler = getPlanHandler("work_get_board_chart");
      mockWorkApi.getBoardChart.mockRejectedValue(new Error("chart not found"));

      const result = await handler({ project: "Proj", team: "Team", board: "Stories", name: "Nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("chart not found");
    });
  });

  // A sweep rather than one test per tool: work.ts registers 60 tools whose
  // catch blocks all promise the same contract — an Azure DevOps failure comes
  // back as an error result, never as an exception escaping into the transport.
  // Written as a loop so a newly added tool is covered the moment it is
  // registered, instead of quietly lowering coverage.
  // A superset of the arguments the tools take; each handler picks what it
  // needs and ignores the rest. Project and team are always present so no
  // tool stops to elicit them.
  const sweepArgs = {
    project: "Proj",
    team: "Team",
    board: "Stories",
    id: 1,
    name: "thing",
    path: "Proj\\Area",
    iterationId: "iter-1",
    identifier: "iter-1",
    workItemIds: [1, 2],
    backlogId: "Microsoft.RequirementCategory",
    column: "Doing",
    columns: [],
    rows: [],
    charts: [],
    chart: {},
    settings: {},
    capacities: [],
    activities: [{ name: "Development", capacityPerDay: 4 }],
    daysOff: [],
    daysOffPatch: { daysOff: [] },
    areaPaths: ["Proj\\Area"],
    defaultValue: "Proj\\Area",
    teamMemberId: "user-1",
    queryType: "assignedtome",
    planId: "plan-1",
    plan: { name: "Plan" },
    startDate: "2026-01-01",
    finishDate: "2026-01-31",
    attributes: {},
    rulesStates: {},
    backlogLevelName: "Stories",
    iterations: [{ identifier: "iter-1" }],
    ruleSettings: {},
    cardSettings: {},
    workItemId: 1,
    previousId: 0,
    nextId: 0,
    parentId: 0,
    depth: 1,
    timeFrame: "current",
  };

  describe("every tool surfaces an API failure as an error result", () => {
    const failure = new Error("boom");

    function registeredTools() {
      const localServer = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;
      configureWorkTools(localServer, tokenProvider, connectionProvider);
      return (localServer.tool as jest.Mock).mock.calls.map(([name, , , handler]) => ({
        name: name as string,
        handler: handler as (a: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>,
      }));
    }

    it("covers every registered work tool", () => {
      expect(registeredTools().length).toBeGreaterThanOrEqual(60);
    });

    it.each(registeredTools().map(({ name }) => name))("%s", async (toolName) => {
      for (const api of [mockWorkApi, mockWorkItemTrackingApi]) {
        for (const key of Object.keys(api)) {
          (api as unknown as Record<string, jest.Mock>)[key].mockRejectedValue(failure);
        }
      }
      // Area and iteration tools go through connection.rest rather than a typed
      // client, so they need rejecting too.
      for (const key of ["create", "update", "del"]) {
        (mockConnection.rest as unknown as Record<string, jest.Mock>)[key].mockRejectedValue(failure);
      }

      const tool = registeredTools().find((entry) => entry.name === toolName);
      if (!tool) throw new Error(`${toolName} not registered`);
      const result = await tool.handler(sweepArgs).catch((error: unknown) => ({ content: [{ text: String(error) }], isError: true }));

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("boom");
    });
  });

  // The other half of the shared contract: a tool whose project argument is
  // optional must ask for one and honour a refusal, instead of calling Azure
  // DevOps with an undefined project. The list is derived from each tool's own
  // schema, so it cannot drift out of sync with the registrations.
  describe("tools with an optional project honour a declined elicitation", () => {
    function toolsWithOptionalProject() {
      // The handler closes over the server it was registered on, so the
      // declining elicitInput has to live on that same instance.
      const localServer = { tool: jest.fn(), server: { elicitInput: jest.fn().mockResolvedValue({ action: "decline" }) } } as unknown as McpServer;
      configureWorkTools(localServer, tokenProvider, connectionProvider);
      return (localServer.tool as jest.Mock).mock.calls
        .map(([name, , schema, handler]) => ({
          name: name as string,
          optionalProject: Boolean((schema as Record<string, { isOptional?: () => boolean }>)?.project?.isOptional?.()),
          handler: handler as (a: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>,
        }))
        .filter((tool) => tool.optionalProject);
    }

    it("finds tools to check", () => {
      expect(toolsWithOptionalProject().length).toBeGreaterThan(10);
    });

    it.each(toolsWithOptionalProject().map(({ name }) => name))("%s", async (toolName) => {
      mockCoreApi.getProjects.mockResolvedValue([{ name: "Proj" }]);
      mockCoreApi.getTeams.mockResolvedValue([{ name: "Team" }]);

      const tool = toolsWithOptionalProject().find((entry) => entry.name === toolName);
      if (!tool) throw new Error(`${toolName} not registered`);
      // Everything except the project and team, so no tool refuses on its own
      // argument validation before it gets as far as asking.
      const result = await tool.handler({ ...sweepArgs, project: undefined, team: undefined });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockWorkApi.getBoards).not.toHaveBeenCalled();
    });
  });
});
