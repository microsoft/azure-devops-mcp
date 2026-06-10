// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureServiceConnectionTools } from "../../../src/tools/service-connections";
import { WebApi } from "azure-devops-node-api";
import { AadLoginPromptOption, OAuthConfigurationActionFilter, ServiceEndpointActionFilter } from "azure-devops-node-api/interfaces/ServiceEndpointInterfaces";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface ServiceEndpointApiMock {
  getServiceEndpoints: jest.Mock;
  getServiceEndpointsByNames: jest.Mock;
  getServiceEndpointDetails: jest.Mock;
  getServiceEndpointsByTypeAndOwner: jest.Mock;
  getServiceEndpointsWithRefreshedAuthentication: jest.Mock;
  createServiceEndpoint: jest.Mock;
  updateServiceEndpoint: jest.Mock;
  updateServiceEndpoints: jest.Mock;
  deleteServiceEndpoint: jest.Mock;
  shareServiceEndpoint: jest.Mock;
  shareEndpointWithProject: jest.Mock;
  querySharedProjects: jest.Mock;
  getServiceEndpointExecutionRecords: jest.Mock;
  addServiceEndpointExecutionRecords: jest.Mock;
  executeServiceEndpointRequest: jest.Mock;
  queryServiceEndpoint: jest.Mock;
  getServiceEndpointTypes: jest.Mock;
  getFilteredServiceEndpointTypes: jest.Mock;
  getAzureSubscriptions: jest.Mock;
  getAzureManagementGroups: jest.Mock;
  getVstsAadTenantId: jest.Mock;
  createAadOAuthRequest: jest.Mock;
  createOAuthConfiguration: jest.Mock;
  updateOAuthConfiguration: jest.Mock;
  deleteOAuthConfiguration: jest.Mock;
  getOAuthConfiguration: jest.Mock;
  getOAuthConfigurations: jest.Mock;
}

describe("configureServiceConnectionTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockApi: ServiceEndpointApiMock;

  beforeEach(() => {
    server = { tool: jest.fn(), server: { elicitInput: jest.fn() } } as unknown as McpServer;
    tokenProvider = jest.fn() as TokenProviderMock;

    mockApi = {
      getServiceEndpoints: jest.fn(),
      getServiceEndpointsByNames: jest.fn(),
      getServiceEndpointDetails: jest.fn(),
      getServiceEndpointsByTypeAndOwner: jest.fn(),
      getServiceEndpointsWithRefreshedAuthentication: jest.fn(),
      createServiceEndpoint: jest.fn(),
      updateServiceEndpoint: jest.fn(),
      updateServiceEndpoints: jest.fn(),
      deleteServiceEndpoint: jest.fn(),
      shareServiceEndpoint: jest.fn(),
      shareEndpointWithProject: jest.fn(),
      querySharedProjects: jest.fn(),
      getServiceEndpointExecutionRecords: jest.fn(),
      addServiceEndpointExecutionRecords: jest.fn(),
      executeServiceEndpointRequest: jest.fn(),
      queryServiceEndpoint: jest.fn(),
      getServiceEndpointTypes: jest.fn(),
      getFilteredServiceEndpointTypes: jest.fn(),
      getAzureSubscriptions: jest.fn(),
      getAzureManagementGroups: jest.fn(),
      getVstsAadTenantId: jest.fn(),
      createAadOAuthRequest: jest.fn(),
      createOAuthConfiguration: jest.fn(),
      updateOAuthConfiguration: jest.fn(),
      deleteOAuthConfiguration: jest.fn(),
      getOAuthConfiguration: jest.fn(),
      getOAuthConfigurations: jest.fn(),
    };

    const mockConnection = { getServiceEndpointApi: jest.fn().mockResolvedValue(mockApi) };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection) as ConnectionProviderMock;
  });

  function getHandler(toolName: string) {
    configureServiceConnectionTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
  }

  describe("tool registration", () => {
    it("registers all service connection tools on the server", () => {
      configureServiceConnectionTools(server, tokenProvider, connectionProvider);
      const names = (server.tool as jest.Mock).mock.calls.map(([n]) => n);
      const expected = [
        "service_connections_list",
        "service_connections_get_details",
        "service_connections_list_by_type_and_owner",
        "service_connections_refresh_authentication",
        "service_connections_create",
        "service_connections_update",
        "service_connections_update_many",
        "service_connections_delete",
        "service_connections_share",
        "service_connections_share_with_project",
        "service_connections_query_shared_projects",
        "service_connections_list_execution_records",
        "service_connections_add_execution_records",
        "service_connections_execute_request",
        "service_connections_query",
        "service_connections_list_types",
        "service_connections_list_filtered_types",
        "service_connections_list_azure_subscriptions",
        "service_connections_list_azure_management_groups",
        "service_connections_get_aad_tenant_id",
        "service_connections_create_aad_oauth_request",
        "service_connections_oauth_create",
        "service_connections_oauth_update",
        "service_connections_oauth_delete",
        "service_connections_oauth_get",
        "service_connections_oauth_list",
      ];
      for (const n of expected) expect(names).toContain(n);
    });
  });

  describe("read tools", () => {
    it("service_connections_list calls getServiceEndpoints by default", async () => {
      const handler = getHandler("service_connections_list");
      const endpoints = [{ id: "ep1", name: "MyAzureRM" }];
      mockApi.getServiceEndpoints.mockResolvedValue(endpoints);

      const result = await handler({ project: "P", type: "azurerm", authSchemes: ["ServicePrincipal"], endpointIds: ["ep1"], owner: "Library", includeFailed: false, actionFilter: "Use" });

      expect(mockApi.getServiceEndpoints).toHaveBeenCalledWith("P", "azurerm", ["ServicePrincipal"], ["ep1"], "Library", false, false, ServiceEndpointActionFilter.Use);
      expect(result.content[0].text).toBe(JSON.stringify(endpoints, null, 2));
    });

    it("service_connections_list uses getServiceEndpointsByNames when endpointNames provided", async () => {
      const handler = getHandler("service_connections_list");
      mockApi.getServiceEndpointsByNames.mockResolvedValue([{ id: "ep1" }]);
      await handler({ project: "P", endpointNames: ["MyAzureRM"] });
      expect(mockApi.getServiceEndpointsByNames).toHaveBeenCalledWith("P", ["MyAzureRM"], undefined, undefined, undefined, undefined, false);
      expect(mockApi.getServiceEndpoints).not.toHaveBeenCalled();
    });

    it("service_connections_list reports empty results", async () => {
      const handler = getHandler("service_connections_list");
      mockApi.getServiceEndpoints.mockResolvedValue([]);
      const result = await handler({ project: "P" });
      expect(result.content[0].text).toBe("No service connections found.");
    });

    it("service_connections_list reports errors", async () => {
      const handler = getHandler("service_connections_list");
      mockApi.getServiceEndpoints.mockRejectedValue(new Error("boom"));
      const result = await handler({ project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing service connections: boom");
    });

    it("service_connections_get_details returns endpoint", async () => {
      const handler = getHandler("service_connections_get_details");
      const ep = { id: "ep1" };
      mockApi.getServiceEndpointDetails.mockResolvedValue(ep);
      const result = await handler({ project: "P", endpointId: "ep1", actionFilter: "Manage" });
      expect(mockApi.getServiceEndpointDetails).toHaveBeenCalledWith("P", "ep1", ServiceEndpointActionFilter.Manage);
      expect(result.content[0].text).toBe(JSON.stringify(ep, null, 2));
    });

    it("service_connections_get_details reports not found", async () => {
      const handler = getHandler("service_connections_get_details");
      mockApi.getServiceEndpointDetails.mockResolvedValue(undefined);
      const result = await handler({ project: "P", endpointId: "missing" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("service_connections_list_by_type_and_owner returns endpoints", async () => {
      const handler = getHandler("service_connections_list_by_type_and_owner");
      mockApi.getServiceEndpointsByTypeAndOwner.mockResolvedValue([{ id: "ep1" }]);
      const result = await handler({ type: "azurerm", owner: "Library" });
      expect(mockApi.getServiceEndpointsByTypeAndOwner).toHaveBeenCalledWith("azurerm", "Library");
      expect(result.content[0].text).toContain("ep1");
    });

    it("service_connections_refresh_authentication forwards parameters", async () => {
      const handler = getHandler("service_connections_refresh_authentication");
      const refreshed = [{ id: "ep1", authorization: { scheme: "OAuth" } }];
      const refreshParams = [{ endpointId: "ep1", scope: [123], tokenValidityInMinutes: 60 }];
      mockApi.getServiceEndpointsWithRefreshedAuthentication.mockResolvedValue(refreshed);
      const result = await handler({ project: "P", endpointIds: ["ep1"], refreshAuthenticationParameters: refreshParams });
      expect(mockApi.getServiceEndpointsWithRefreshedAuthentication).toHaveBeenCalledWith(refreshParams, "P", ["ep1"]);
      expect(result.content[0].text).toContain("ep1");
    });

    it("service_connections_query_shared_projects returns projects", async () => {
      const handler = getHandler("service_connections_query_shared_projects");
      mockApi.querySharedProjects.mockResolvedValue([{ id: "proj1" }]);
      const result = await handler({ endpointId: "ep1", project: "P" });
      expect(mockApi.querySharedProjects).toHaveBeenCalledWith("ep1", "P");
      expect(result.content[0].text).toContain("proj1");
    });

    it("service_connections_list_execution_records returns records", async () => {
      const handler = getHandler("service_connections_list_execution_records");
      mockApi.getServiceEndpointExecutionRecords.mockResolvedValue([{ id: 1 }]);
      const result = await handler({ project: "P", endpointId: "ep1", top: 25, continuationToken: 5 });
      expect(mockApi.getServiceEndpointExecutionRecords).toHaveBeenCalledWith("P", "ep1", 25, 5);
      expect(result.content[0].text).toContain('"id": 1');
    });

    it("service_connections_list_types returns types", async () => {
      const handler = getHandler("service_connections_list_types");
      mockApi.getServiceEndpointTypes.mockResolvedValue([{ name: "azurerm" }]);
      await handler({ type: "azurerm", scheme: "ServicePrincipal" });
      expect(mockApi.getServiceEndpointTypes).toHaveBeenCalledWith("azurerm", "ServicePrincipal");
    });

    it("service_connections_list_filtered_types forwards filter", async () => {
      const handler = getHandler("service_connections_list_filtered_types");
      mockApi.getFilteredServiceEndpointTypes.mockResolvedValue([{ name: "azurerm" }]);
      await handler({ typesFilter: ["azurerm", "github"] });
      expect(mockApi.getFilteredServiceEndpointTypes).toHaveBeenCalledWith(["azurerm", "github"]);
    });

    it("service_connections_list_azure_subscriptions calls API", async () => {
      const handler = getHandler("service_connections_list_azure_subscriptions");
      mockApi.getAzureSubscriptions.mockResolvedValue({ value: [{ subscriptionId: "sub1" }] });
      const result = await handler({});
      expect(mockApi.getAzureSubscriptions).toHaveBeenCalled();
      expect(result.content[0].text).toContain("sub1");
    });

    it("service_connections_list_azure_management_groups calls API", async () => {
      const handler = getHandler("service_connections_list_azure_management_groups");
      mockApi.getAzureManagementGroups.mockResolvedValue({ value: [{ id: "mg1" }] });
      const result = await handler({});
      expect(mockApi.getAzureManagementGroups).toHaveBeenCalled();
      expect(result.content[0].text).toContain("mg1");
    });

    it("service_connections_get_aad_tenant_id returns the tenant id", async () => {
      const handler = getHandler("service_connections_get_aad_tenant_id");
      mockApi.getVstsAadTenantId.mockResolvedValue("tenant-123");
      const result = await handler({});
      expect(result.content[0].text).toContain("tenant-123");
    });
  });

  describe("write tools", () => {
    it("service_connections_create calls createServiceEndpoint", async () => {
      const handler = getHandler("service_connections_create");
      const endpoint = { name: "X", type: "azurerm" };
      mockApi.createServiceEndpoint.mockResolvedValue({ id: "new", ...endpoint });
      const result = await handler({ endpoint });
      expect(mockApi.createServiceEndpoint).toHaveBeenCalledWith(endpoint);
      expect(result.content[0].text).toContain('"id": "new"');
    });

    it("service_connections_update forwards id, body, and operation", async () => {
      const handler = getHandler("service_connections_update");
      const endpoint = { name: "Renamed" };
      mockApi.updateServiceEndpoint.mockResolvedValue({ id: "ep1", ...endpoint });
      await handler({ endpointId: "ep1", endpoint, operation: "rename" });
      expect(mockApi.updateServiceEndpoint).toHaveBeenCalledWith(endpoint, "ep1", "rename");
    });

    it("service_connections_update_many forwards endpoint array", async () => {
      const handler = getHandler("service_connections_update_many");
      const endpoints = [{ id: "ep1" }, { id: "ep2" }];
      mockApi.updateServiceEndpoints.mockResolvedValue(endpoints);
      await handler({ endpoints });
      expect(mockApi.updateServiceEndpoints).toHaveBeenCalledWith(endpoints);
    });

    it("service_connections_delete calls deleteServiceEndpoint", async () => {
      const handler = getHandler("service_connections_delete");
      mockApi.deleteServiceEndpoint.mockResolvedValue(undefined);
      const result = await handler({ endpointId: "ep1", projectIds: ["p1", "p2"], deep: true });
      expect(mockApi.deleteServiceEndpoint).toHaveBeenCalledWith("ep1", ["p1", "p2"], true);
      expect(result.content[0].text).toContain("deleted");
    });

    it("service_connections_share calls shareServiceEndpoint", async () => {
      const handler = getHandler("service_connections_share");
      const refs = [{ name: "Shared", projectReference: { id: "p2" } }];
      mockApi.shareServiceEndpoint.mockResolvedValue(undefined);
      const result = await handler({ endpointId: "ep1", endpointProjectReferences: refs });
      expect(mockApi.shareServiceEndpoint).toHaveBeenCalledWith(refs, "ep1");
      expect(result.content[0].text).toContain("shared with 1 project");
    });

    it("service_connections_share_with_project calls shareEndpointWithProject", async () => {
      const handler = getHandler("service_connections_share_with_project");
      mockApi.shareEndpointWithProject.mockResolvedValue(undefined);
      const result = await handler({ endpointId: "ep1", fromProject: "P1", withProject: "P2" });
      expect(mockApi.shareEndpointWithProject).toHaveBeenCalledWith("ep1", "P1", "P2");
      expect(result.content[0].text).toContain("shared from 'P1' with 'P2'");
    });

    it("service_connections_add_execution_records forwards input and project", async () => {
      const handler = getHandler("service_connections_add_execution_records");
      const input = { endpointIds: ["ep1"], data: { planId: "plan1" } };
      mockApi.addServiceEndpointExecutionRecords.mockResolvedValue([{ id: 1 }]);
      await handler({ project: "P", input });
      expect(mockApi.addServiceEndpointExecutionRecords).toHaveBeenCalledWith(input, "P");
    });

    it("service_connections_execute_request calls executeServiceEndpointRequest", async () => {
      const handler = getHandler("service_connections_execute_request");
      const req = { dataSourceDetails: {} };
      mockApi.executeServiceEndpointRequest.mockResolvedValue({ statusCode: "Ok" });
      await handler({ project: "P", endpointId: "ep1", serviceEndpointRequest: req });
      expect(mockApi.executeServiceEndpointRequest).toHaveBeenCalledWith(req, "P", "ep1");
    });

    it("service_connections_query calls queryServiceEndpoint", async () => {
      const handler = getHandler("service_connections_query");
      const binding = { endpointId: "ep1", dataSourceName: "ds1" };
      mockApi.queryServiceEndpoint.mockResolvedValue(["row1", "row2"]);
      await handler({ project: "P", binding });
      expect(mockApi.queryServiceEndpoint).toHaveBeenCalledWith(binding, "P");
    });

    it("service_connections_create_aad_oauth_request returns URL", async () => {
      const handler = getHandler("service_connections_create_aad_oauth_request");
      mockApi.createAadOAuthRequest.mockResolvedValue("https://login.example.com/oauth");
      const result = await handler({ tenantId: "tenant", redirectUri: "https://r", promptOption: "SelectAccount", completeCallbackPayload: "payload", completeCallbackByAuthCode: true });
      expect(mockApi.createAadOAuthRequest).toHaveBeenCalledWith("tenant", "https://r", AadLoginPromptOption.SelectAccount, "payload", true);
      expect(result.content[0].text).toContain("https://login.example.com/oauth");
    });
  });

  describe("OAuth configuration tools", () => {
    const baseOAuthParams = { clientId: "cid", clientSecret: "csec", endpointType: "github", name: "n1" };

    it("service_connections_oauth_create forwards params", async () => {
      const handler = getHandler("service_connections_oauth_create");
      mockApi.createOAuthConfiguration.mockResolvedValue({ id: "oc1", ...baseOAuthParams });
      await handler({ configurationParams: baseOAuthParams });
      expect(mockApi.createOAuthConfiguration).toHaveBeenCalledWith(baseOAuthParams);
    });

    it("service_connections_oauth_update forwards id and params", async () => {
      const handler = getHandler("service_connections_oauth_update");
      mockApi.updateOAuthConfiguration.mockResolvedValue({ id: "oc1", ...baseOAuthParams });
      await handler({ configurationId: "oc1", configurationParams: baseOAuthParams });
      expect(mockApi.updateOAuthConfiguration).toHaveBeenCalledWith(baseOAuthParams, "oc1");
    });

    it("service_connections_oauth_delete forwards id", async () => {
      const handler = getHandler("service_connections_oauth_delete");
      mockApi.deleteOAuthConfiguration.mockResolvedValue({ id: "oc1" });
      await handler({ configurationId: "oc1" });
      expect(mockApi.deleteOAuthConfiguration).toHaveBeenCalledWith("oc1");
    });

    it("service_connections_oauth_get returns configuration", async () => {
      const handler = getHandler("service_connections_oauth_get");
      mockApi.getOAuthConfiguration.mockResolvedValue({ id: "oc1" });
      const result = await handler({ configurationId: "oc1" });
      expect(mockApi.getOAuthConfiguration).toHaveBeenCalledWith("oc1");
      expect(result.content[0].text).toContain('"id": "oc1"');
    });

    it("service_connections_oauth_get reports not found", async () => {
      const handler = getHandler("service_connections_oauth_get");
      mockApi.getOAuthConfiguration.mockResolvedValue(undefined);
      const result = await handler({ configurationId: "missing" });
      expect(result.isError).toBe(true);
    });

    it("service_connections_oauth_list applies action filter", async () => {
      const handler = getHandler("service_connections_oauth_list");
      mockApi.getOAuthConfigurations.mockResolvedValue([{ id: "oc1" }]);
      await handler({ endpointType: "github", actionFilter: "Use" });
      expect(mockApi.getOAuthConfigurations).toHaveBeenCalledWith("github", OAuthConfigurationActionFilter.Use);
    });

    it("service_connections_oauth_list reports empty results", async () => {
      const handler = getHandler("service_connections_oauth_list");
      mockApi.getOAuthConfigurations.mockResolvedValue([]);
      const result = await handler({});
      expect(result.content[0].text).toBe("No OAuth configurations found.");
    });
  });

  describe("empty-result branches", () => {
    it("service_connections_list_by_type_and_owner reports empty results", async () => {
      const handler = getHandler("service_connections_list_by_type_and_owner");
      mockApi.getServiceEndpointsByTypeAndOwner.mockResolvedValue([]);
      const result = await handler({ type: "azurerm", owner: "Library" });
      expect(result.content[0].text).toBe("No service connections found.");
    });
  });

  describe("error paths", () => {
    type ErrorCase = {
      tool: string;
      method: keyof ServiceEndpointApiMock;
      prefix: string;
      args: Record<string, unknown>;
    };

    const cases: ErrorCase[] = [
      { tool: "service_connections_get_details", method: "getServiceEndpointDetails", prefix: "Error getting service connection details:", args: { project: "P", endpointId: "ep1" } },
      {
        tool: "service_connections_list_by_type_and_owner",
        method: "getServiceEndpointsByTypeAndOwner",
        prefix: "Error listing service connections by type and owner:",
        args: { type: "t", owner: "o" },
      },
      {
        tool: "service_connections_refresh_authentication",
        method: "getServiceEndpointsWithRefreshedAuthentication",
        prefix: "Error refreshing service connection authentication:",
        args: { project: "P", endpointIds: ["ep1"], refreshAuthenticationParameters: [] },
      },
      { tool: "service_connections_create", method: "createServiceEndpoint", prefix: "Error creating service connection:", args: { endpoint: {} } },
      { tool: "service_connections_update", method: "updateServiceEndpoint", prefix: "Error updating service connection:", args: { endpointId: "ep1", endpoint: {} } },
      { tool: "service_connections_update_many", method: "updateServiceEndpoints", prefix: "Error updating service connections:", args: { endpoints: [] } },
      { tool: "service_connections_delete", method: "deleteServiceEndpoint", prefix: "Error deleting service connection:", args: { endpointId: "ep1", projectIds: ["p1"] } },
      { tool: "service_connections_share", method: "shareServiceEndpoint", prefix: "Error sharing service connection:", args: { endpointId: "ep1", endpointProjectReferences: [] } },
      {
        tool: "service_connections_share_with_project",
        method: "shareEndpointWithProject",
        prefix: "Error sharing service connection with project:",
        args: { endpointId: "ep1", fromProject: "P1", withProject: "P2" },
      },
      { tool: "service_connections_query_shared_projects", method: "querySharedProjects", prefix: "Error querying shared projects:", args: { endpointId: "ep1", project: "P" } },
      {
        tool: "service_connections_list_execution_records",
        method: "getServiceEndpointExecutionRecords",
        prefix: "Error listing service connection execution records:",
        args: { project: "P", endpointId: "ep1" },
      },
      {
        tool: "service_connections_add_execution_records",
        method: "addServiceEndpointExecutionRecords",
        prefix: "Error adding service connection execution records:",
        args: { project: "P", input: {} },
      },
      {
        tool: "service_connections_execute_request",
        method: "executeServiceEndpointRequest",
        prefix: "Error executing service connection request:",
        args: { project: "P", endpointId: "ep1", serviceEndpointRequest: {} },
      },
      { tool: "service_connections_query", method: "queryServiceEndpoint", prefix: "Error querying service connection:", args: { project: "P", binding: {} } },
      { tool: "service_connections_list_types", method: "getServiceEndpointTypes", prefix: "Error listing service connection types:", args: {} },
      { tool: "service_connections_list_filtered_types", method: "getFilteredServiceEndpointTypes", prefix: "Error listing filtered service connection types:", args: { typesFilter: ["t"] } },
      { tool: "service_connections_list_azure_subscriptions", method: "getAzureSubscriptions", prefix: "Error listing Azure subscriptions:", args: {} },
      { tool: "service_connections_list_azure_management_groups", method: "getAzureManagementGroups", prefix: "Error listing Azure management groups:", args: {} },
      { tool: "service_connections_get_aad_tenant_id", method: "getVstsAadTenantId", prefix: "Error getting AAD tenant ID:", args: {} },
      {
        tool: "service_connections_create_aad_oauth_request",
        method: "createAadOAuthRequest",
        prefix: "Error creating AAD OAuth request:",
        args: { tenantId: "t", redirectUri: "r" },
      },
      {
        tool: "service_connections_oauth_create",
        method: "createOAuthConfiguration",
        prefix: "Error creating OAuth configuration:",
        args: { configurationParams: { clientId: "c", clientSecret: "s", endpointType: "github", name: "n" } },
      },
      {
        tool: "service_connections_oauth_update",
        method: "updateOAuthConfiguration",
        prefix: "Error updating OAuth configuration:",
        args: { configurationId: "oc1", configurationParams: { clientId: "c", clientSecret: "s", endpointType: "github", name: "n" } },
      },
      { tool: "service_connections_oauth_delete", method: "deleteOAuthConfiguration", prefix: "Error deleting OAuth configuration:", args: { configurationId: "oc1" } },
      { tool: "service_connections_oauth_get", method: "getOAuthConfiguration", prefix: "Error getting OAuth configuration:", args: { configurationId: "oc1" } },
      { tool: "service_connections_oauth_list", method: "getOAuthConfigurations", prefix: "Error listing OAuth configurations:", args: {} },
    ];

    it.each(cases)("$tool surfaces upstream errors", async ({ tool, method, prefix, args }) => {
      const handler = getHandler(tool);
      mockApi[method].mockRejectedValue(new Error("boom"));
      const result = await handler(args);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(prefix);
      expect(result.content[0].text).toContain("boom");
    });

    it("falls back to 'Unknown error occurred' when a non-Error value is thrown", async () => {
      const handler = getHandler("service_connections_list");
      mockApi.getServiceEndpoints.mockRejectedValue("not-an-error");
      const result = await handler({ project: "P" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error occurred");
    });
  });
});
