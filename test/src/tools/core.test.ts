import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureCoreTools } from "../../../src/tools/core";
import { WebApi } from "azure-devops-node-api";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface CoreApiMock {
  getTeams: jest.Mock;
  getProjects: jest.Mock;
}

describe("configureCoreTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getCoreApi: jest.Mock; };
  let mockCoreApi: CoreApiMock;  

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
    };  

    mockConnection = {
      getCoreApi: jest.fn().mockResolvedValue(mockCoreApi)    
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureCoreTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_projects tool", () => {
    it("should call getProjects API with the correct parameters and return the expected result", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_projects"
      );

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([
        {
          id: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
          name: "Fabrikam-Fiber-TFVC",
          description: "Team Foundation Version Control projects.",
          url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
          state: "wellFormed",
        },
        {
          id: "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c",
          name: "Fabrikam-Fiber-Git",
          description: "Git projects",
          url: "https://dev.azure.com/fabrikam/_apis/projects/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c",
          state: "wellFormed",
        },
        {
          id: "281f9a5b-af0d-49b4-a1df-fe6f5e5f84d0",
          name: "TestGit",
          url: "https://dev.azure.com/fabrikam/_apis/projects/281f9a5b-af0d-49b4-a1df-fe6f5e5f84d0",
          state: "wellFormed",
        },
      ]);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined,
        getDefaultTeamImageUrl: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalledWith(
        "wellFormed",
        undefined,
        undefined,
        undefined,
        false
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
              name: "Fabrikam-Fiber-TFVC",
              description: "Team Foundation Version Control projects.",
              url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
              state: "wellFormed",
            },
            {
              id: "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c",
              name: "Fabrikam-Fiber-Git",
              description: "Git projects",
              url: "https://dev.azure.com/fabrikam/_apis/projects/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c",
              state: "wellFormed",
            },
            {
              id: "281f9a5b-af0d-49b4-a1df-fe6f5e5f84d0",
              name: "TestGit",
              url: "https://dev.azure.com/fabrikam/_apis/projects/281f9a5b-af0d-49b4-a1df-fe6f5e5f84d0",
              state: "wellFormed",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_projects"
      );

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      const testError = new Error("API connection failed");
      (mockCoreApi.getProjects as jest.Mock).mockRejectedValue(testError);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching projects: API connection failed");
    });

    it("should handle null API results correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_projects"
      );

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue(null);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No projects found");
    });
  });

  describe("list_project_teams tool", () => {
    it("should call getTeams API with the correct parameters and return the expected result", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_project_teams"
      );

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([
        {
          id: "564e8204-a90b-4432-883b-d4363c6125ca",
          name: "Quality assurance",
          url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/564e8204-a90b-4432-883b-d4363c6125ca",
          description: "Testing staff",
          identityUrl:
            "https://vssps.dev.azure.com/fabrikam/_apis/Identities/564e8204-a90b-4432-883b-d4363c6125ca",
        },
        {
          id: "66df9be7-3586-467b-9c5f-425b29afedfd",
          name: "Fabrikam-Fiber-TFVC Team",
          url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/66df9be7-3586-467b-9c5f-425b29afedfd",
          description: "The default project team.",
          identityUrl:
            "https://vssps.dev.azure.com/fabrikam/_apis/Identities/66df9be7-3586-467b-9c5f-425b29afedfd",
        },
      ]);

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined,
        expandIdentity: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalledWith(
        "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        undefined,
        undefined,
        undefined,
        false
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "564e8204-a90b-4432-883b-d4363c6125ca",
              name: "Quality assurance",
              url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/564e8204-a90b-4432-883b-d4363c6125ca",
              description: "Testing staff",
              identityUrl:
                "https://vssps.dev.azure.com/fabrikam/_apis/Identities/564e8204-a90b-4432-883b-d4363c6125ca",
            },
            {
              id: "66df9be7-3586-467b-9c5f-425b29afedfd",
              name: "Fabrikam-Fiber-TFVC Team",
              url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/66df9be7-3586-467b-9c5f-425b29afedfd",
              description: "The default project team.",
              identityUrl:
                "https://vssps.dev.azure.com/fabrikam/_apis/Identities/66df9be7-3586-467b-9c5f-425b29afedfd",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_project_teams"
      );

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Team not found");
      (mockCoreApi.getTeams as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching project teams: Team not found");
    });

    it("should handle null API results correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "core_list_project_teams"
      );
      
      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No teams found");
    });
  });
});
