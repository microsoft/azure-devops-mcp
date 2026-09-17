// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureSecurityRolesTools } from "../../../src/tools/security-roles";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface SecurityRolesApiMock {
  getRoleDefinitions: jest.Mock;
  getRoleAssignments: jest.Mock;
  setRoleAssignment: jest.Mock;
  setRoleAssignments: jest.Mock;
  removeRoleAssignment: jest.Mock;
  removeRoleAssignments: jest.Mock;
}

describe("configureSecurityRolesTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getSecurityRolesApi: jest.Mock };
  let mockSecurityRolesApi: SecurityRolesApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockSecurityRolesApi = {
      getRoleDefinitions: jest.fn(),
      getRoleAssignments: jest.fn(),
      setRoleAssignment: jest.fn(),
      setRoleAssignments: jest.fn(),
      removeRoleAssignment: jest.fn(),
      removeRoleAssignments: jest.fn(),
    };
    mockConnection = {
      getSecurityRolesApi: jest.fn().mockResolvedValue(mockSecurityRolesApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureSecurityRolesTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers security roles tools on the server", () => {
      configureSecurityRolesTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_definitions passes the scope id", async () => {
    const handler = getHandler("securityrole_list_definitions");
    mockSecurityRolesApi.getRoleDefinitions.mockResolvedValue([{ name: "Administrator" }]);

    const result = await handler({ scopeId: "distributedtask.globalagentpoolrole" });

    expect(mockSecurityRolesApi.getRoleDefinitions).toHaveBeenCalledWith("distributedtask.globalagentpoolrole");
    expect(result.content[0].text).toContain("Administrator");
  });

  it("list_definitions reports when none found", async () => {
    const handler = getHandler("securityrole_list_definitions");
    mockSecurityRolesApi.getRoleDefinitions.mockResolvedValue([]);

    const result = await handler({ scopeId: "scope" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No role definitions found");
  });

  it("list_assignments passes scope and resource", async () => {
    const handler = getHandler("securityrole_list_assignments");
    mockSecurityRolesApi.getRoleAssignments.mockResolvedValue([{ identity: { id: "u1" } }]);

    const result = await handler({ scopeId: "scope", resourceId: "res-1" });

    expect(mockSecurityRolesApi.getRoleAssignments).toHaveBeenCalledWith("scope", "res-1");
    expect(result.content[0].text).toContain("u1");
  });

  it("set_assignment builds the user role assignment ref", async () => {
    const handler = getHandler("securityrole_set_assignment");
    mockSecurityRolesApi.setRoleAssignment.mockResolvedValue({ identity: { id: "u1" } });

    const result = await handler({ scopeId: "scope", resourceId: "res-1", identityId: "u1", roleName: "Administrator" });

    expect(mockSecurityRolesApi.setRoleAssignment).toHaveBeenCalledWith({ roleName: "Administrator", userId: "u1" }, "scope", "res-1", "u1");
    expect(result.content[0].text).toContain("u1");
  });

  it("set_assignments builds the array of refs", async () => {
    const handler = getHandler("securityrole_set_assignments");
    mockSecurityRolesApi.setRoleAssignments.mockResolvedValue([{ identity: { id: "u1" } }]);

    const result = await handler({
      scopeId: "scope",
      resourceId: "res-1",
      assignments: [
        { identityId: "u1", roleName: "User" },
        { identityId: "u2", roleName: "Reader" },
      ],
    });

    expect(mockSecurityRolesApi.setRoleAssignments).toHaveBeenCalledWith(
      [
        { roleName: "User", userId: "u1" },
        { roleName: "Reader", userId: "u2" },
      ],
      "scope",
      "res-1"
    );
    expect(result.content[0].text).toContain("u1");
  });

  it("remove_assignment passes scope, resource and identity", async () => {
    const handler = getHandler("securityrole_remove_assignment");
    mockSecurityRolesApi.removeRoleAssignment.mockResolvedValue(undefined);

    const result = await handler({ scopeId: "scope", resourceId: "res-1", identityId: "u1" });

    expect(mockSecurityRolesApi.removeRoleAssignment).toHaveBeenCalledWith("scope", "res-1", "u1");
    expect(result.content[0].text).toContain("Role assignment for u1 removed");
  });

  it("remove_assignments passes identity ids", async () => {
    const handler = getHandler("securityrole_remove_assignments");
    mockSecurityRolesApi.removeRoleAssignments.mockResolvedValue(undefined);

    const result = await handler({ scopeId: "scope", resourceId: "res-1", identityIds: ["u1", "u2"] });

    expect(mockSecurityRolesApi.removeRoleAssignments).toHaveBeenCalledWith(["u1", "u2"], "scope", "res-1");
    expect(result.content[0].text).toContain("Removed 2 role assignment(s)");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("securityrole_list_assignments");
    mockSecurityRolesApi.getRoleAssignments.mockRejectedValue(new Error("boom"));

    const result = await handler({ scopeId: "scope", resourceId: "res-1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching role assignments: boom");
  });
});
