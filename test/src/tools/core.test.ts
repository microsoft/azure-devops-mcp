// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureCoreTools } from "../../../src/tools/core";
import { WebApi } from "azure-devops-node-api";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface CoreApiMock {
  getTeams: jest.Mock;
  getProjects: jest.Mock;
}

describe("configureCoreTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: { getCoreApi: jest.Mock };
  let mockCoreApi: CoreApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
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
});
