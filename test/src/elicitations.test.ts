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
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };

    server = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;

    mockCoreApi = {
      getProjects: jest.fn(),
      getTeams: jest.fn(),
    };

    mockConnection = {
      getCoreApi: jest.fn().mockResolvedValue(mockCoreApi),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("elicitProject", () => {
    it("should use default message when no message is provided", async () => {
      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { project: "ProjectAlpha" } });

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      const callArgs = elicitMock.mock.calls[0][0];
      expect(callArgs.message).toBe("Select the Azure DevOps project.");
      expect(result).toEqual({ resolved: "ProjectAlpha" });
    });

    it("should return DEFAULT_PROJECT from environment variable without prompting", async () => {
      process.env.DEFAULT_PROJECT = "DefaultProject";

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      // Should not call getCoreApi or elicitInput
      expect(mockCoreApi.getProjects).not.toHaveBeenCalled();
      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      expect(elicitMock).not.toHaveBeenCalled();

      // Should return the default value
      expect(result).toEqual({ resolved: "DefaultProject" });
    });

    it("should ignore DEFAULT_PROJECT if empty string", async () => {
      process.env.DEFAULT_PROJECT = "";
      (mockCoreApi.getProjects as jest.Mock).mockResolvedValue([{ id: "proj-1", name: "ProjectAlpha" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { project: "ProjectAlpha" } });

      const result = await elicitProject(server, mockConnection as unknown as WebApi);

      // Should call elicit since empty string is falsy
      expect(elicitMock).toHaveBeenCalled();
    });
  });

  describe("elicitTeam", () => {
    it("should use default message when no message is provided", async () => {
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { team: "Team One" } });

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      const callArgs = elicitMock.mock.calls[0][0];
      expect(callArgs.message).toBe("Select the team.");
      expect(result).toEqual({ resolved: "Team One" });
    });

    it("should fall back to team id when name is missing", async () => {
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

    it("should return DEFAULT_TEAM from environment variable without prompting", async () => {
      process.env.DEFAULT_TEAM = "DefaultTeam";

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      // Should not call getCoreApi or elicitInput
      expect(mockCoreApi.getTeams).not.toHaveBeenCalled();
      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      expect(elicitMock).not.toHaveBeenCalled();

      // Should return the default value
      expect(result).toEqual({ resolved: "DefaultTeam" });
    });

    it("should ignore DEFAULT_TEAM if empty string", async () => {
      process.env.DEFAULT_TEAM = "";
      (mockCoreApi.getTeams as jest.Mock).mockResolvedValue([{ id: "team-1", name: "Team One" }]);

      const elicitMock = (server as unknown as { server: { elicitInput: jest.Mock } }).server.elicitInput as jest.Mock;
      elicitMock.mockResolvedValue({ action: "accept", content: { team: "Team One" } });

      const result = await elicitTeam(server, mockConnection as unknown as WebApi, "ProjectAlpha");

      // Should call elicit since empty string is falsy
      expect(elicitMock).toHaveBeenCalled();
    });
  });
});
