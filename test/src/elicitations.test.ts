// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { elicitProject, elicitTeam } from "../../src/shared/elicitations";

describe("elicitations", () => {
  let server: McpServer;
  let mockCoreApi: { getProjects: jest.Mock; getTeams: jest.Mock };
  let mockConnection: { getCoreApi: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
    };

    mockConnection = {
      getCoreApi: jest.fn().mockResolvedValue(mockCoreApi),
    };
  });

  describe("elicitProject", () => {
    const originalProjectEnv = process.env.ado_mcp_project;

    afterEach(() => {
      if (originalProjectEnv === undefined) {
        delete process.env.ado_mcp_project;
      } else {
        process.env.ado_mcp_project = originalProjectEnv;
      }
    });

    it("should use default message when no message is provided", async () => {
      delete process.env.ado_mcp_project;
      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { project: "ProjectAlpha" } });

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      const callArgs = elicitMock.mock.calls[0][0];
      expect(callArgs.message).toBe("Select the Azure DevOps project.");
      expect(result).toEqual({ resolved: "ProjectAlpha" });
    });

    it("should resolve to default project from ado_mcp_project env var without elicitation", async () => {
      process.env.ado_mcp_project = "DefaultProject";

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      expect(result).toEqual({ resolved: "DefaultProject" });
      expect(mockConnection.getCoreApi).not.toHaveBeenCalled();
      expect(mockCoreApi.getProjects).not.toHaveBeenCalled();
      expect(elicitMock).not.toHaveBeenCalled();
    });

    it("should not use empty ado_mcp_project env var as default", async () => {
      process.env.ado_mcp_project = "";
      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { project: "ProjectAlpha" } });

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      expect(mockCoreApi.getProjects).toHaveBeenCalled();
      expect(elicitMock).toHaveBeenCalled();
      expect(result).toEqual({ resolved: "ProjectAlpha" });
    });
  });

  describe("elicitTeam", () => {
    const originalTeamEnv = process.env.ado_mcp_team;

    afterEach(() => {
      if (originalTeamEnv === undefined) {
        delete process.env.ado_mcp_team;
      } else {
        process.env.ado_mcp_team = originalTeamEnv;
      }
    });

    it("should use default message when no message is provided", async () => {
      delete process.env.ado_mcp_team;
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { team: "Team One" } });

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      const callArgs = elicitMock.mock.calls[0][0];
      expect(callArgs.message).toBe("Select the team.");
      expect(result).toEqual({ resolved: "Team One" });
    });

    it("should fall back to team id when name is missing", async () => {
      delete process.env.ado_mcp_team;
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([
        { id: "team-1", name: undefined },
        { id: undefined, name: undefined },
      ]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { team: "team-1" } });

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      const schema = elicitMock.mock.calls[0][0].requestedSchema;
      const oneOf = schema.properties.team.oneOf;

      expect(oneOf[0]).toEqual({ const: "team-1", title: "team-1" });
      expect(oneOf[1]).toEqual({ const: "", title: "Unknown team" });
      expect(result).toEqual({ resolved: "team-1" });
    });

    it("should resolve to default team from ado_mcp_team env var without elicitation", async () => {
      process.env.ado_mcp_team = "DefaultTeam";

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      expect(result).toEqual({ resolved: "DefaultTeam" });
      expect(mockConnection.getCoreApi).not.toHaveBeenCalled();
      expect(mockCoreApi.getTeams).not.toHaveBeenCalled();
      expect(elicitMock).not.toHaveBeenCalled();
    });

    it("should not use empty ado_mcp_team env var as default", async () => {
      process.env.ado_mcp_team = "";
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { team: "Team One" } });

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      expect(mockCoreApi.getTeams).toHaveBeenCalled();
      expect(elicitMock).toHaveBeenCalled();
      expect(result).toEqual({ resolved: "Team One" });
    });
  });
});
