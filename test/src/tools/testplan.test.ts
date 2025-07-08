import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestPlanTools } from "../../../src/tools/testplans";
import { ITestPlanApi } from "azure-devops-node-api/TestPlanApi";
import { ITestResultsApi } from "azure-devops-node-api/TestResultsApi";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureTestPlanTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getTestPlanApi: () => Promise<ITestPlanApi>;
    getTestResultsApi: () => Promise<ITestResultsApi>;
  };
  let mockTestPlanApi: ITestPlanApi;
  let mockTestResultsApi: ITestResultsApi;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockTestPlanApi = {
      getTestPlans: jest.fn(),
      createTestPlan: jest.fn(),
      addTestCasesToSuite: jest.fn(),
      getTestCaseList: jest.fn(),
    } as unknown as ITestPlanApi;
    mockTestResultsApi = {
      getTestResultDetailsForBuild: jest.fn(),
    } as unknown as ITestResultsApi;
    mockConnection = {
      getTestPlanApi: jest.fn().mockResolvedValue(mockTestPlanApi),
      getTestResultsApi: jest.fn().mockResolvedValue(mockTestResultsApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test plan tools on the server", () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock).mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining(["testplan_list_test_plans", "testplan_create_test_plan", "testplan_add_test_cases_to_suite", "testplan_list_test_cases", "testplan_show_test_results_from_build_id"]));
    });
  });

  describe("list_test_plans tool", () => {
    it("should call getTestPlans with the correct parameters and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_plans");
      if (!call) throw new Error("testplan_list_test_plans tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.getTestPlans as jest.Mock).mockResolvedValue([{ id: 1, name: "Test Plan 1" }]);
      const params = {
        project: "proj1",
        filterActivePlans: true,
        includePlanDetails: false,
        continuationToken: undefined,
      };
      const result = await handler(params);

      expect(mockTestPlanApi.getTestPlans).toHaveBeenCalledWith("proj1", "", undefined, false, true);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "Test Plan 1" }], null, 2));
    });
  });

  describe("create_test_plan tool", () => {
    it("should call createTestPlan with the correct parameters and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_plan");
      if (!call) throw new Error("testplan_create_test_plan tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestPlan as jest.Mock).mockResolvedValue({ id: 1, name: "New Test Plan" });
      const params = {
        project: "proj1",
        name: "New Test Plan",
        iteration: "Iteration 1",
        description: "Description",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        areaPath: "Area 1",
      };
      const result = await handler(params);

      expect(mockTestPlanApi.createTestPlan).toHaveBeenCalledWith(
        {
          name: "New Test Plan",
          iteration: "Iteration 1",
          description: "Description",
          startDate: new Date("2025-05-01"),
          endDate: new Date("2025-05-31"),
          areaPath: "Area 1",
        },
        "proj1"
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: 1, name: "New Test Plan" }, null, 2));
    });
  });

  describe("list_test_cases tool", () => {
    it("should call getTestCaseList with the correct parameters and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_cases");
      if (!call) throw new Error("testplan_list_test_cases tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.getTestCaseList as jest.Mock).mockResolvedValue([{ id: 1, name: "Test Case 1" }]);
      const params = {
        project: "proj1",
        planid: 1,
        suiteid: 2,
      };
      const result = await handler(params);

      expect(mockTestPlanApi.getTestCaseList).toHaveBeenCalledWith("proj1", 1, 2);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "Test Case 1" }], null, 2));
    });
  });

  describe("test_results_from_build_id tool", () => {
    it("should call getTestResultDetailsForBuild with the correct parameters and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockResolvedValue({ results: ["Result 1"] });
      const params = {
        project: "proj1",
        buildid: 123,
      };
      const result = await handler(params);

      expect(mockTestResultsApi.getTestResultDetailsForBuild).toHaveBeenCalledWith("proj1", 123);
      expect(result.content[0].text).toBe(JSON.stringify({ results: ["Result 1"] }, null, 2));
    });
  });
});
