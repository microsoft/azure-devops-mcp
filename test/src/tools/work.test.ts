// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
  getCapacitiesWithIdentityRefAndTotals: jest.Mock;
  updateCapacityWithIdentityRef: jest.Mock;
  getTotalIterationCapacities: jest.Mock;
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
      getCapacitiesWithIdentityRefAndTotals: jest.fn(),
      updateCapacityWithIdentityRef: jest.fn(),
      getTotalIterationCapacities: jest.fn(),
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
  });
});
