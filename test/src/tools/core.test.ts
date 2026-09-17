// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureCoreTools } from "../../../src/tools/core";
import { WebApi } from "azure-devops-node-api";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface CoreApiMock {
  getTeams: jest.Mock;
  getProjects: jest.Mock;
  getProcesses: jest.Mock;
  getProject: jest.Mock;
  queueCreateProject: jest.Mock;
  updateProject: jest.Mock;
  queueDeleteProject: jest.Mock;
  createTeam: jest.Mock;
  updateTeam: jest.Mock;
  deleteTeam: jest.Mock;
  getTeamMembersWithExtendedProperties: jest.Mock;
  getProjectProperties: jest.Mock;
  setProjectProperties: jest.Mock;
}

describe("configureCoreTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: { getCoreApi: jest.Mock };
  let mockCoreApi: CoreApiMock;

  beforeEach(() => {
    server = createToolServer({ server: { elicitInput: jest.fn() } }) as unknown as McpServer;
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
      getProcesses: jest.fn(),
      getProject: jest.fn(),
      queueCreateProject: jest.fn(),
      updateProject: jest.fn(),
      queueDeleteProject: jest.fn(),
      createTeam: jest.fn(),
      updateTeam: jest.fn(),
      deleteTeam: jest.fn(),
      getTeamMembersWithExtendedProperties: jest.fn(),
      getProjectProperties: jest.fn(),
      setProjectProperties: jest.fn(),
    };

    mockConnection = {
      getCoreApi: jest.fn().mockResolvedValue(mockCoreApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers core tools on the server", () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_projects tool", () => {
    it("should call getProjects API with the correct parameters and return the expected result", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

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

      expect(mockCoreApi.getProjects).toHaveBeenCalledWith("wellFormed", undefined, undefined, undefined, false);

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
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      const testError = new Error("API connection failed");
      (mockCoreApi.getProjects as jest.Mock).mockRejectedValue(testError);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching projects: API connection failed");
    });

    it("should handle null API results correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue(null);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No projects found");
    });

    it("should handle unknown error type correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

      if (!call) throw new Error("core_list_projects tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockRejectedValue("string error");

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching projects: Unknown error occurred");
    });

    it("should filter projects by name when projectNameFilter is provided", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

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
        projectNameFilter: "Git",
      };

      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalledWith("wellFormed", undefined, undefined, undefined, false);

      const filteredProjects = JSON.parse(result.content[0].text);
      expect(filteredProjects).toHaveLength(2);
      expect(filteredProjects[0].name).toBe("Fabrikam-Fiber-Git");
      expect(filteredProjects[1].name).toBe("TestGit");
    });

    it("should handle case-insensitive filtering", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_projects");

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
      ]);

      const params = {
        stateFilter: "wellFormed",
        top: undefined,
        skip: undefined,
        continuationToken: undefined,
        projectNameFilter: "fabrikam",
      };

      const result = await handler(params);

      const filteredProjects = JSON.parse(result.content[0].text);
      expect(filteredProjects).toHaveLength(2);
    });
  });

  describe("list_project_teams tool", () => {
    it("should call getTeams API with the correct parameters and return the expected result", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([
        {
          id: "564e8204-a90b-4432-883b-d4363c6125ca",
          name: "Quality assurance",
          url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/564e8204-a90b-4432-883b-d4363c6125ca",
          description: "Testing staff",
          identityUrl: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/564e8204-a90b-4432-883b-d4363c6125ca",
        },
        {
          id: "66df9be7-3586-467b-9c5f-425b29afedfd",
          name: "Fabrikam-Fiber-TFVC Team",
          url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/66df9be7-3586-467b-9c5f-425b29afedfd",
          description: "The default project team.",
          identityUrl: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/66df9be7-3586-467b-9c5f-425b29afedfd",
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

      expect(mockCoreApi.getTeams).toHaveBeenCalledWith("eb6e4656-77fc-42a1-9181-4c6d8e9da5d1", undefined, undefined, undefined, false);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          [
            {
              id: "564e8204-a90b-4432-883b-d4363c6125ca",
              name: "Quality assurance",
              url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/564e8204-a90b-4432-883b-d4363c6125ca",
              description: "Testing staff",
              identityUrl: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/564e8204-a90b-4432-883b-d4363c6125ca",
            },
            {
              id: "66df9be7-3586-467b-9c5f-425b29afedfd",
              name: "Fabrikam-Fiber-TFVC Team",
              url: "https://dev.azure.com/fabrikam/_apis/projects/eb6e4656-77fc-42a1-9181-4c6d8e9da5d1/teams/66df9be7-3586-467b-9c5f-425b29afedfd",
              description: "The default project team.",
              identityUrl: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/66df9be7-3586-467b-9c5f-425b29afedfd",
            },
          ],
          null,
          2
        )
      );
    });

    it("should handle API errors correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Team not found");
      (mockCoreApi.getTeams as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching project teams: Team not found");
    });

    it("should handle null API results correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No teams found");
    });

    it("should handle unknown error type correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");

      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getTeams as jest.Mock).mockRejectedValue("string error");

      const params = {
        project: "eb6e4656-77fc-42a1-9181-4c6d8e9da5d1",
        mine: undefined,
        top: undefined,
        skip: undefined,
      };

      const result = await handler(params);

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching project teams: Unknown error occurred");
    });

    it("should elicit project when project is not provided and user accepts", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");
      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([
        { id: "proj-1", name: "ProjectAlpha" },
        { id: "proj-2", name: "ProjectBeta" },
      ]);

      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue({
        action: "accept",
        content: { project: "ProjectAlpha" },
      });

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const params = { project: undefined, mine: undefined, top: undefined, skip: undefined };
      const result = await handler(params);

      expect(mockCoreApi.getProjects).toHaveBeenCalledWith("wellFormed", 100, 0, undefined, false);
      expect((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput).toHaveBeenCalled();
      expect(mockCoreApi.getTeams).toHaveBeenCalledWith("ProjectAlpha", undefined, undefined, undefined, false);
      expect(result.content[0].text).toContain("Team One");
      expect(result.isError).toBeUndefined();
    });

    it("should return cancellation message when user declines elicitation", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");
      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      ((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock).mockResolvedValue({
        action: "decline",
      });

      const params = { project: undefined, mine: undefined, top: undefined, skip: undefined };
      const result = await handler(params);

      expect(mockCoreApi.getTeams).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe("Project selection cancelled.");
    });

    it("should fall back to project id when name is missing in elicitation options", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");
      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([
        { id: "proj-1", name: undefined },
        { id: undefined, name: undefined },
      ]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({
        action: "accept",
        content: { project: "proj-1" },
      });

      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const params = { project: undefined, mine: undefined, top: undefined, skip: undefined };
      const result = await handler(params);

      const schema = elicitMock.mock.calls[0][0].requestedSchema;
      const oneOf = schema.properties.project.oneOf;

      // Project with no name falls back to id
      expect(oneOf[0]).toEqual({ const: "proj-1", title: "proj-1" });
      // Project with neither name nor id falls back to "" and "Unknown project"
      expect(oneOf[1]).toEqual({ const: "", title: "Unknown project" });

      expect(mockCoreApi.getTeams).toHaveBeenCalledWith("proj-1", undefined, undefined, undefined, false);
      expect(result.content[0].text).toContain("Team One");
    });

    it("should return error when no projects are available for elicitation", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_list_project_teams");
      if (!call) throw new Error("core_list_project_teams tool not registered");
      const [, , , handler] = call;

      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([]);

      const params = { project: undefined, mine: undefined, top: undefined, skip: undefined };
      const result = await handler(params);

      expect((server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput).not.toHaveBeenCalled();
      expect(mockCoreApi.getTeams).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No projects found to select from.");
    });
  });

  describe("get_identity_ids tool", () => {
    beforeEach(() => {
      // Mock fetch globally for these tests
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should fetch identity IDs with correct parameters and return expected result", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      // Mock token provider
      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");

      // Mock connection with serverUrl
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock fetch response
      const mockIdentities = {
        value: [
          {
            id: "user1-id",
            providerDisplayName: "John Doe",
            descriptor: "aad.user1-descriptor",
          },
          {
            id: "user2-id",
            providerDisplayName: "Jane Smith",
            descriptor: "aad.user2-descriptor",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockIdentities),
      });

      const params = { searchFilter: "john.doe@example.com" };
      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith("https://vssps.dev.azure.com/test-org/_apis/identities?api-version=7.2-preview.1&searchFilter=General&filterValue=john.doe%40example.com", {
        headers: {
          "Authorization": "Bearer fake-token",
          "Content-Type": "application/json",
          "User-Agent": "Jest",
        },
      });

      const expectedResult = [
        {
          id: "user1-id",
          displayName: "John Doe",
          descriptor: "aad.user1-descriptor",
        },
        {
          id: "user2-id",
          displayName: "Jane Smith",
          descriptor: "aad.user2-descriptor",
        },
      ];

      expect(result.content[0].text).toBe(JSON.stringify(expectedResult, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle HTTP error responses correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock failed HTTP response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Not Found"),
      });

      const params = { searchFilter: "nonexistent@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error fetching identities: HTTP 404: Not Found");
    });

    it("should handle empty results correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock empty response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ value: [] }),
      });

      const params = { searchFilter: "nobody@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No identities found");
    });

    it("should handle null response correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock null response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      const params = { searchFilter: "test@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("No identities found");
    });

    it("should handle network errors correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const params = { searchFilter: "test@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error fetching identities: Network error");
    });

    it("should handle unknown error types correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue("fake-token");
      const mockConnectionWithUrl = {
        ...mockConnection,
        serverUrl: "https://dev.azure.com/test-org",
      };
      (connectionProvider as jest.Mock).mockResolvedValue(mockConnectionWithUrl);

      // Mock unknown error type (not an Error instance)
      (global.fetch as jest.Mock).mockRejectedValue("string error");

      const params = { searchFilter: "test@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error fetching identities: Unknown error occurred");
    });

    it("should handle token provider errors correctly", async () => {
      configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "core_get_identity_ids");
      if (!call) throw new Error("core_get_identity_ids tool not registered");
      const [, , , handler] = call;

      // Mock token provider error
      (tokenProvider as jest.Mock).mockRejectedValue(new Error("Token acquisition failed"));

      const params = { searchFilter: "test@example.com" };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error fetching identities: Token acquisition failed");
    });
  });

  const getHandler = (toolName: string) => {
    configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  };

  describe("create_project tool", () => {
    it("creates a project with the resolved process template", async () => {
      const handler = getHandler("core_create_project");

      mockCoreApi.getProcesses.mockResolvedValue([
        { id: "agile-id", name: "Agile", isDefault: false },
        { id: "basic-id", name: "Basic", isDefault: true },
      ]);
      mockCoreApi.queueCreateProject.mockResolvedValue({ id: "op-1", status: "queued" });

      const result = await handler({ name: "NewProject", description: "desc", visibility: "private", sourceControlType: "Git", processTemplate: "Agile" });

      expect(mockCoreApi.queueCreateProject).toHaveBeenCalledWith({
        name: "NewProject",
        description: "desc",
        visibility: 0,
        capabilities: {
          versioncontrol: { sourceControlType: "Git" },
          processTemplate: { templateTypeId: "agile-id" },
        },
      });
      expect(result.content[0].text).toBe(JSON.stringify({ id: "op-1", status: "queued" }, null, 2));
    });

    it("falls back to the default process when none is provided", async () => {
      const handler = getHandler("core_create_project");

      mockCoreApi.getProcesses.mockResolvedValue([
        { id: "agile-id", name: "Agile", isDefault: false },
        { id: "basic-id", name: "Basic", isDefault: true },
      ]);
      mockCoreApi.queueCreateProject.mockResolvedValue({ id: "op-2" });

      await handler({ name: "NewProject", visibility: "private", sourceControlType: "Git" });

      expect(mockCoreApi.queueCreateProject).toHaveBeenCalledWith(expect.objectContaining({ capabilities: expect.objectContaining({ processTemplate: { templateTypeId: "basic-id" } }) }));
    });

    it("returns an error when the process template is not found", async () => {
      const handler = getHandler("core_create_project");

      mockCoreApi.getProcesses.mockResolvedValue([{ id: "agile-id", name: "Agile" }]);

      const result = await handler({ name: "NewProject", visibility: "private", sourceControlType: "Git", processTemplate: "Nonexistent" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
      expect(mockCoreApi.queueCreateProject).not.toHaveBeenCalled();
    });

    it("handles API errors", async () => {
      const handler = getHandler("core_create_project");

      mockCoreApi.getProcesses.mockRejectedValue(new Error("boom"));

      const result = await handler({ name: "NewProject", visibility: "private", sourceControlType: "Git" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating project: boom");
    });
  });

  describe("update_project tool", () => {
    it("updates a project using the resolved project ID", async () => {
      const handler = getHandler("core_update_project");

      mockCoreApi.getProject.mockResolvedValue({ id: "proj-id", name: "Old" });
      mockCoreApi.updateProject.mockResolvedValue({ id: "op-3", status: "queued" });

      const result = await handler({ project: "Old", name: "New", description: "d", visibility: "public" });

      expect(mockCoreApi.updateProject).toHaveBeenCalledWith({ name: "New", description: "d", visibility: 2 }, "proj-id");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "op-3", status: "queued" }, null, 2));
    });

    it("returns an error when no fields are provided", async () => {
      const handler = getHandler("core_update_project");

      mockCoreApi.getProject.mockResolvedValue({ id: "proj-id", name: "Old" });

      const result = await handler({ project: "Old" });

      expect(result.isError).toBe(true);
      expect(mockCoreApi.updateProject).not.toHaveBeenCalled();
    });

    it("returns an error when the project is not found", async () => {
      const handler = getHandler("core_update_project");

      mockCoreApi.getProject.mockResolvedValue(undefined);

      const result = await handler({ project: "Missing", name: "New" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("delete_project tool", () => {
    it("queues a project delete using the resolved project ID", async () => {
      const handler = getHandler("core_delete_project");

      mockCoreApi.getProject.mockResolvedValue({ id: "proj-id", name: "Old" });
      mockCoreApi.queueDeleteProject.mockResolvedValue({ id: "op-4", status: "queued" });

      const result = await handler({ project: "Old" });

      expect(mockCoreApi.queueDeleteProject).toHaveBeenCalledWith("proj-id");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "op-4", status: "queued" }, null, 2));
    });

    it("returns an error when the project is not found", async () => {
      const handler = getHandler("core_delete_project");

      mockCoreApi.getProject.mockResolvedValue(undefined);

      const result = await handler({ project: "Missing" });

      expect(result.isError).toBe(true);
      expect(mockCoreApi.queueDeleteProject).not.toHaveBeenCalled();
    });
  });

  describe("create_team tool", () => {
    it("creates a team in the given project", async () => {
      const handler = getHandler("core_create_team");

      mockCoreApi.createTeam.mockResolvedValue({ id: "team-id", name: "Team A" });

      const result = await handler({ project: "Proj", name: "Team A", description: "desc" });

      expect(mockCoreApi.createTeam).toHaveBeenCalledWith({ name: "Team A", description: "desc" }, "Proj");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "team-id", name: "Team A" }, null, 2));
    });

    it("handles API errors", async () => {
      const handler = getHandler("core_create_team");

      mockCoreApi.createTeam.mockRejectedValue(new Error("nope"));

      const result = await handler({ project: "Proj", name: "Team A" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error creating team: nope");
    });
  });

  describe("update_team tool", () => {
    it("updates a team in the given project", async () => {
      const handler = getHandler("core_update_team");

      mockCoreApi.updateTeam.mockResolvedValue({ id: "team-id", name: "Team B" });

      const result = await handler({ project: "Proj", team: "team-id", name: "Team B" });

      expect(mockCoreApi.updateTeam).toHaveBeenCalledWith({ name: "Team B", description: undefined }, "Proj", "team-id");
      expect(result.content[0].text).toBe(JSON.stringify({ id: "team-id", name: "Team B" }, null, 2));
    });

    it("returns an error when no fields are provided", async () => {
      const handler = getHandler("core_update_team");

      const result = await handler({ project: "Proj", team: "team-id" });

      expect(result.isError).toBe(true);
      expect(mockCoreApi.updateTeam).not.toHaveBeenCalled();
    });
  });

  describe("delete_team tool", () => {
    it("deletes a team in the given project", async () => {
      const handler = getHandler("core_delete_team");

      mockCoreApi.deleteTeam.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", team: "team-id" });

      expect(mockCoreApi.deleteTeam).toHaveBeenCalledWith("Proj", "team-id");
      expect(result.content[0].text).toContain("deleted");
    });

    it("handles API errors", async () => {
      const handler = getHandler("core_delete_team");

      mockCoreApi.deleteTeam.mockRejectedValue(new Error("denied"));

      const result = await handler({ project: "Proj", team: "team-id" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error deleting team: denied");
    });
  });

  describe("list_processes tool", () => {
    it("returns the organization processes", async () => {
      const handler = getHandler("core_list_processes");
      mockCoreApi.getProcesses.mockResolvedValue([{ id: "p1", name: "Agile", isDefault: true }]);

      const result = await handler({});

      expect(mockCoreApi.getProcesses).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify([{ id: "p1", name: "Agile", isDefault: true }], null, 2));
    });
  });

  describe("list_team_members tool", () => {
    it("returns team members for the given project/team", async () => {
      const handler = getHandler("core_list_team_members");
      mockCoreApi.getTeamMembersWithExtendedProperties.mockResolvedValue([{ identity: { displayName: "Jane" } }]);

      const result = await handler({ project: "Proj", team: "Team", top: 10, skip: 0 });

      expect(mockCoreApi.getTeamMembersWithExtendedProperties).toHaveBeenCalledWith("Proj", "Team", 10, 0);
      expect(result.content[0].text).toContain("Jane");
    });
  });

  describe("get_project_properties tool", () => {
    it("resolves the project id and returns properties", async () => {
      const handler = getHandler("core_get_project_properties");
      mockCoreApi.getProject.mockResolvedValue({ id: "proj-id", name: "Proj" });
      mockCoreApi.getProjectProperties.mockResolvedValue([{ name: "System.Process", value: "Agile" }]);

      const result = await handler({ project: "Proj", keys: ["System.Process"] });

      expect(mockCoreApi.getProjectProperties).toHaveBeenCalledWith("proj-id", ["System.Process"]);
      expect(result.content[0].text).toContain("System.Process");
    });
  });

  describe("set_project_properties tool", () => {
    it("builds an add patch document from the properties map", async () => {
      const handler = getHandler("core_set_project_properties");
      mockCoreApi.getProject.mockResolvedValue({ id: "proj-id", name: "Proj" });
      mockCoreApi.setProjectProperties.mockResolvedValue(undefined);

      const result = await handler({ project: "Proj", properties: { "Custom.Key": "value" } });

      expect(mockCoreApi.setProjectProperties).toHaveBeenCalledWith(undefined, "proj-id", [{ op: "add", path: "/Custom.Key", value: "value" }]);
      expect(result.content[0].text).toContain("Set 1 property");
    });

    it("returns an error when no properties are provided", async () => {
      const handler = getHandler("core_set_project_properties");

      const result = await handler({ project: "Proj", properties: {} });

      expect(result.isError).toBe(true);
      expect(mockCoreApi.setProjectProperties).not.toHaveBeenCalled();
    });
  });
});
