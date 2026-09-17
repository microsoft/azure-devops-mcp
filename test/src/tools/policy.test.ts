// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configurePolicyTools } from "../../../src/tools/policy";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface PolicyApiMock {
  getPolicyConfigurations: jest.Mock;
  getPolicyConfiguration: jest.Mock;
  createPolicyConfiguration: jest.Mock;
  updatePolicyConfiguration: jest.Mock;
  deletePolicyConfiguration: jest.Mock;
  getPolicyTypes: jest.Mock;
  getPolicyType: jest.Mock;
  getPolicyConfigurationRevisions: jest.Mock;
  getPolicyConfigurationRevision: jest.Mock;
  getPolicyEvaluations: jest.Mock;
  getPolicyEvaluation: jest.Mock;
  requeuePolicyEvaluation: jest.Mock;
}

describe("configurePolicyTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getPolicyApi: jest.Mock };
  let mockPolicyApi: PolicyApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockPolicyApi = {
      getPolicyConfigurations: jest.fn(),
      getPolicyConfiguration: jest.fn(),
      createPolicyConfiguration: jest.fn(),
      updatePolicyConfiguration: jest.fn(),
      deletePolicyConfiguration: jest.fn(),
      getPolicyTypes: jest.fn(),
      getPolicyType: jest.fn(),
      getPolicyConfigurationRevisions: jest.fn(),
      getPolicyConfigurationRevision: jest.fn(),
      getPolicyEvaluations: jest.fn(),
      getPolicyEvaluation: jest.fn(),
      requeuePolicyEvaluation: jest.fn(),
    };
    mockConnection = {
      getPolicyApi: jest.fn().mockResolvedValue(mockPolicyApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configurePolicyTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers policy tools on the server", () => {
      configurePolicyTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_configurations passes scope and type filters", async () => {
    const handler = getHandler("policy_list_configurations");
    mockPolicyApi.getPolicyConfigurations.mockResolvedValue([{ id: 1 }]);

    const result = await handler({ project: "Proj", scope: "repo-1", policyType: "type-1" });

    expect(mockPolicyApi.getPolicyConfigurations).toHaveBeenCalledWith("Proj", "repo-1", "type-1");
    expect(result.content[0].text).toContain('"id": 1');
  });

  it("list_configurations reports when none found", async () => {
    const handler = getHandler("policy_list_configurations");
    mockPolicyApi.getPolicyConfigurations.mockResolvedValue([]);

    const result = await handler({ project: "Proj" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No policy configurations found");
  });

  it("get_configuration passes the configuration id", async () => {
    const handler = getHandler("policy_get_configuration");
    mockPolicyApi.getPolicyConfiguration.mockResolvedValue({ id: 7 });

    const result = await handler({ project: "Proj", configurationId: 7 });

    expect(mockPolicyApi.getPolicyConfiguration).toHaveBeenCalledWith("Proj", 7);
    expect(result.content[0].text).toContain('"id": 7');
  });

  it("create_configuration passes the configuration object", async () => {
    const handler = getHandler("policy_create_configuration");
    mockPolicyApi.createPolicyConfiguration.mockResolvedValue({ id: 9 });

    const configuration = { type: { id: "type-1" }, isEnabled: true, isBlocking: true, settings: {} };
    const result = await handler({ project: "Proj", configuration });

    expect(mockPolicyApi.createPolicyConfiguration).toHaveBeenCalledWith(configuration, "Proj");
    expect(result.content[0].text).toContain('"id": 9');
  });

  it("update_configuration passes id and object", async () => {
    const handler = getHandler("policy_update_configuration");
    mockPolicyApi.updatePolicyConfiguration.mockResolvedValue({ id: 9, isEnabled: false });

    const configuration = { id: 9, isEnabled: false };
    const result = await handler({ project: "Proj", configurationId: 9, configuration });

    expect(mockPolicyApi.updatePolicyConfiguration).toHaveBeenCalledWith(configuration, "Proj", 9);
    expect(result.content[0].text).toContain('"isEnabled": false');
  });

  it("delete_configuration deletes by id", async () => {
    const handler = getHandler("policy_delete_configuration");
    mockPolicyApi.deletePolicyConfiguration.mockResolvedValue(undefined);

    const result = await handler({ project: "Proj", configurationId: 9 });

    expect(mockPolicyApi.deletePolicyConfiguration).toHaveBeenCalledWith("Proj", 9);
    expect(result.content[0].text).toContain("Policy configuration 9 deleted");
  });

  it("list_types returns policy types", async () => {
    const handler = getHandler("policy_list_types");
    mockPolicyApi.getPolicyTypes.mockResolvedValue([{ id: "type-1", displayName: "Minimum reviewers" }]);

    const result = await handler({ project: "Proj" });

    expect(mockPolicyApi.getPolicyTypes).toHaveBeenCalledWith("Proj");
    expect(result.content[0].text).toContain("Minimum reviewers");
  });

  it("get_type passes the type id", async () => {
    const handler = getHandler("policy_get_type");
    mockPolicyApi.getPolicyType.mockResolvedValue({ id: "type-1" });

    const result = await handler({ project: "Proj", typeId: "type-1" });

    expect(mockPolicyApi.getPolicyType).toHaveBeenCalledWith("Proj", "type-1");
    expect(result.content[0].text).toContain("type-1");
  });

  it("list_configuration_revisions passes paging", async () => {
    const handler = getHandler("policy_list_configuration_revisions");
    mockPolicyApi.getPolicyConfigurationRevisions.mockResolvedValue([{ revision: 1 }]);

    const result = await handler({ project: "Proj", configurationId: 9, top: 10, skip: 5 });

    expect(mockPolicyApi.getPolicyConfigurationRevisions).toHaveBeenCalledWith("Proj", 9, 10, 5);
    expect(result.content[0].text).toContain("revision");
  });

  it("get_configuration_revision passes ids", async () => {
    const handler = getHandler("policy_get_configuration_revision");
    mockPolicyApi.getPolicyConfigurationRevision.mockResolvedValue({ revision: 2 });

    const result = await handler({ project: "Proj", configurationId: 9, revisionId: 2 });

    expect(mockPolicyApi.getPolicyConfigurationRevision).toHaveBeenCalledWith("Proj", 9, 2);
    expect(result.content[0].text).toContain('"revision": 2');
  });

  it("list_evaluations passes artifact and options", async () => {
    const handler = getHandler("policy_list_evaluations");
    mockPolicyApi.getPolicyEvaluations.mockResolvedValue([{ evaluationId: "e1" }]);

    const result = await handler({ project: "Proj", artifactId: "vstfs:///CodeReview/CodeReviewId/p/1", includeNotApplicable: true, top: 50, skip: 0 });

    expect(mockPolicyApi.getPolicyEvaluations).toHaveBeenCalledWith("Proj", "vstfs:///CodeReview/CodeReviewId/p/1", true, 50, 0);
    expect(result.content[0].text).toContain("e1");
  });

  it("get_evaluation passes the evaluation id", async () => {
    const handler = getHandler("policy_get_evaluation");
    mockPolicyApi.getPolicyEvaluation.mockResolvedValue({ evaluationId: "e1" });

    const result = await handler({ project: "Proj", evaluationId: "e1" });

    expect(mockPolicyApi.getPolicyEvaluation).toHaveBeenCalledWith("Proj", "e1");
    expect(result.content[0].text).toContain("e1");
  });

  it("requeue_evaluation requeues by id", async () => {
    const handler = getHandler("policy_requeue_evaluation");
    mockPolicyApi.requeuePolicyEvaluation.mockResolvedValue({ evaluationId: "e1", status: "queued" });

    const result = await handler({ project: "Proj", evaluationId: "e1" });

    expect(mockPolicyApi.requeuePolicyEvaluation).toHaveBeenCalledWith("Proj", "e1");
    expect(result.content[0].text).toContain("queued");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("policy_get_configuration");
    mockPolicyApi.getPolicyConfiguration.mockRejectedValue(new Error("boom"));

    const result = await handler({ project: "Proj", configurationId: 1 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching policy configuration: boom");
  });
});
