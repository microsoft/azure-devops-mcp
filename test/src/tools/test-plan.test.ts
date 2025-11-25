// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestPlanTools } from "../../../src/tools/test-plans";
import { ITestPlanApi } from "azure-devops-node-api/TestPlanApi";
import { ITestResultsApi } from "azure-devops-node-api/TestResultsApi";
import { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import { ITestApi } from "azure-devops-node-api/TestApi";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureTestPlanTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getTestPlanApi: () => Promise<ITestPlanApi>;
    getTestResultsApi: () => Promise<ITestResultsApi>;
    getWorkItemTrackingApi: () => Promise<IWorkItemTrackingApi>;
    getTestApi: () => Promise<ITestApi>;
    serverUrl: string;
  };
  let mockTestPlanApi: ITestPlanApi;
  let mockTestResultsApi: ITestResultsApi;
  let mockWitApi: IWorkItemTrackingApi;
  let mockTestApi: ITestApi;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockTestPlanApi = {
      getTestPlans: jest.fn(),
      createTestPlan: jest.fn(),
      createTestSuite: jest.fn(),
      addTestCasesToSuite: jest.fn(),
      getTestCaseList: jest.fn(),
    } as unknown as ITestPlanApi;
    mockTestResultsApi = {
      getTestResultDetailsForBuild: jest.fn(),
    } as unknown as ITestResultsApi;
    mockWitApi = {
      createWorkItem: jest.fn(),
      updateWorkItem: jest.fn(),
    } as unknown as IWorkItemTrackingApi;
    mockTestApi = {
      addTestCasesToSuite: jest.fn(),
    } as unknown as ITestApi;
    mockConnection = {
      getTestPlanApi: jest.fn().mockResolvedValue(mockTestPlanApi),
      getTestResultsApi: jest.fn().mockResolvedValue(mockTestResultsApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi),
      getTestApi: jest.fn().mockResolvedValue(mockTestApi),
      serverUrl: "https://dev.azure.com/testorg",
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test plan tools on the server", () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock).mock.calls.map((call) => call[0])).toEqual(
        expect.arrayContaining([
          "testplan_list_test_plans",
          "testplan_create_test_plan",
          "testplan_create_test_suite",
          "testplan_add_test_cases_to_suite",
          "testplan_create_test_case",
          "testplan_update_test_case_steps",
          "testplan_list_test_cases",
          "testplan_show_test_results_from_build_id",
          "testplan_list_test_suites",
        ])
      );
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

    it("should handle API errors when listing test plans", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_plans");
      if (!call) throw new Error("testplan_list_test_plans tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.getTestPlans as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        filterActivePlans: true,
        includePlanDetails: false,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test plans");
      expect(result.content[0].text).toContain("API Error");
    });
  });

  describe("list_test_suites tool", () => {
    beforeEach(() => {
      (mockTestPlanApi as any).getTestSuitesForPlan = jest.fn();
    });

    it("should call getTestSuitesForPlan and return properly nested hierarchy", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      // Mock API response with flat list including nested suites
      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([
        {
          id: 100,
          name: "Root Suite",
          hasChildren: true,
          children: [
            { id: 101, name: "Child Suite 1", parentSuite: { id: 100 } },
            { id: 102, name: "Child Suite 2", parentSuite: { id: 100 } },
          ],
        },
        {
          id: 101,
          name: "Child Suite 1",
          hasChildren: true,
          parentSuite: { id: 100 },
          children: [{ id: 103, name: "Grandchild Suite", parentSuite: { id: 101 } }],
        },
        {
          id: 102,
          name: "Child Suite 2",
          parentSuite: { id: 100 },
        },
        {
          id: 103,
          name: "Grandchild Suite",
          parentSuite: { id: 101 },
        },
      ]);

      const params = {
        project: "proj1",
        planId: 1,
      };
      const result = await handler(params);

      expect((mockTestPlanApi as any).getTestSuitesForPlan).toHaveBeenCalledWith("proj1", 1, 1, undefined);

      // Parse and validate the nested structure
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        id: 100,
        name: "Root Suite",
        children: [
          {
            id: 101,
            name: "Child Suite 1",
            children: [
              {
                id: 103,
                name: "Grandchild Suite",
              },
            ],
          },
          {
            id: 102,
            name: "Child Suite 2",
          },
        ],
      });
    });

    it("should handle test suite with no children", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([
        {
          id: 200,
          name: "Single Suite",
          hasChildren: false,
        },
      ]);

      const params = {
        project: "proj1",
        planId: 2,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: 200,
        name: "Single Suite",
      });
    });

    it("should handle empty test suite list", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([]);

      const params = {
        project: "proj1",
        planId: 3,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([]);
    });

    it("should handle deeply nested suite hierarchy", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      // Mock a deeply nested structure
      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([
        {
          id: 300,
          name: "Root",
          hasChildren: true,
          children: [{ id: 301, name: "Level 1", parentSuite: { id: 300 } }],
        },
        {
          id: 301,
          name: "Level 1",
          hasChildren: true,
          parentSuite: { id: 300 },
          children: [{ id: 302, name: "Level 2", parentSuite: { id: 301 } }],
        },
        {
          id: 302,
          name: "Level 2",
          hasChildren: true,
          parentSuite: { id: 301 },
          children: [{ id: 303, name: "Level 3", parentSuite: { id: 302 } }],
        },
        {
          id: 303,
          name: "Level 3",
          parentSuite: { id: 302 },
        },
      ]);

      const params = {
        project: "proj1",
        planId: 4,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0]).toMatchObject({
        id: 300,
        name: "Root",
        children: [
          {
            id: 301,
            name: "Level 1",
            children: [
              {
                id: 302,
                name: "Level 2",
                children: [
                  {
                    id: 303,
                    name: "Level 3",
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should handle API errors when listing test suites", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        planId: 5,
      };
      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test suites: API Error");
    });

    it("should pass continuation token when provided", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([
        {
          id: 400,
          name: "Suite with Token",
        },
      ]);

      const params = {
        project: "proj1",
        planId: 6,
        continuationToken: "token123",
      };
      await handler(params);

      expect((mockTestPlanApi as any).getTestSuitesForPlan).toHaveBeenCalledWith("proj1", 6, 1, "token123");
    });

    it("should not include empty children arrays in output", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_suites");
      if (!call) throw new Error("testplan_list_test_suites tool not registered");
      const [, , , handler] = call;

      ((mockTestPlanApi as any).getTestSuitesForPlan as jest.Mock).mockResolvedValue([
        {
          id: 500,
          name: "Parent",
          hasChildren: true,
          children: [{ id: 501, name: "Child with no children", parentSuite: { id: 500 } }],
        },
        {
          id: 501,
          name: "Child with no children",
          parentSuite: { id: 500 },
          hasChildren: false,
        },
      ]);

      const params = {
        project: "proj1",
        planId: 7,
      };
      const result = await handler(params);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].children[0]).toEqual({
        id: 501,
        name: "Child with no children",
      });
      expect(parsed[0].children[0].children).toBeUndefined();
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

    it("should handle API errors when creating test plan", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_plan");
      if (!call) throw new Error("testplan_create_test_plan tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestPlan as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        name: "Failed Plan",
        iteration: "Iteration 1",
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating test plan");
      expect(result.content[0].text).toContain("API Error");
    });
  });

  describe("create_test_suite tool", () => {
    it("should call createTestSuite with the correct parameters and return the expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_suite");
      if (!call) throw new Error("testplan_create_test_suite tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestSuite as jest.Mock).mockResolvedValue({ id: 10, name: "New Test Suite" });
      const params = {
        project: "proj1",
        planId: 1,
        parentSuiteId: 5,
        name: "New Test Suite",
      };
      const result = await handler(params);

      expect(mockTestPlanApi.createTestSuite).toHaveBeenCalledWith(
        {
          name: "New Test Suite",
          parentSuite: {
            id: 5,
            name: "",
          },
          suiteType: 2,
        },
        "proj1",
        1
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: 10, name: "New Test Suite" }, null, 2));
    });

    it("should handle API errors when creating test suite", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_suite");
      if (!call) throw new Error("testplan_create_test_suite tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestSuite as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        planId: 1,
        parentSuiteId: 5,
        name: "Failed Test Suite",
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating test suite");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should create test suite with different parent suite IDs", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_suite");
      if (!call) throw new Error("testplan_create_test_suite tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestSuite as jest.Mock).mockResolvedValue({
        id: 15,
        name: "Child Test Suite",
        parentSuite: { id: 10 },
      });
      const params = {
        project: "proj1",
        planId: 2,
        parentSuiteId: 10,
        name: "Child Test Suite",
      };
      const result = await handler(params);

      expect(mockTestPlanApi.createTestSuite).toHaveBeenCalledWith(
        {
          name: "Child Test Suite",
          parentSuite: {
            id: 10,
            name: "",
          },
          suiteType: 2,
        },
        "proj1",
        2
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 15,
            name: "Child Test Suite",
            parentSuite: { id: 10 },
          },
          null,
          2
        )
      );
    });

    it("should handle empty or null response from createTestSuite", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_suite");
      if (!call) throw new Error("testplan_create_test_suite tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.createTestSuite as jest.Mock).mockResolvedValue(null);
      const params = {
        project: "proj1",
        planId: 1,
        parentSuiteId: 5,
        name: "Empty Response Suite",
      };
      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify(null, null, 2));
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

    it("should handle API errors when listing test cases", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_list_test_cases");
      if (!call) throw new Error("testplan_list_test_cases tool not registered");
      const [, , , handler] = call;

      (mockTestPlanApi.getTestCaseList as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        planid: 1,
        suiteid: 2,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing test cases");
      expect(result.content[0].text).toContain("API Error");
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

    it("should handle API errors when fetching test results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_show_test_results_from_build_id");
      if (!call) throw new Error("testplan_show_test_results_from_build_id tool not registered");
      const [, , , handler] = call;

      (mockTestResultsApi.getTestResultDetailsForBuild as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        buildid: 123,
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching test results");
      expect(result.content[0].text).toContain("API Error");
    });
  });

  describe("create_test_case tool", () => {
    it("should create test case with proper parameters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1001,
        fields: {
          "System.Title": "New Test Case",
          "System.WorkItemType": "Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "New Test Case",
        steps: "1. Test step 1\n2. Test step 2",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith({}, expect.any(Array), "proj1", "Test Case");
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1001,
            fields: {
              "System.Title": "New Test Case",
              "System.WorkItemType": "Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should create test case & expected result with proper parameters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1001,
        fields: {
          "System.Title": "New Test Case",
          "System.WorkItemType": "Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "New Test Case",
        steps: "1. Test step 1 | Expected result 1\n2. Test step 2 | Expected result 2",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith({}, expect.any(Array), "proj1", "Test Case");
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1001,
            fields: {
              "System.Title": "New Test Case",
              "System.WorkItemType": "Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle multiple steps in test case", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1002,
        fields: {
          "System.Title": "Multi-step Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "Multi-step Test Case",
        steps: "1. Step 1\n2. Step 2",
      };
      const result = await handler(params);

      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1002,
            fields: {
              "System.Title": "Multi-step Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle API errors in test case creation", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        title: "Failed Test Case",
        steps: "1. Test step",
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating test case");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should create test case with all optional parameters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1004,
        fields: {
          "System.Title": "Full Test Case",
          "Microsoft.VSTS.Common.Priority": 1,
          "System.AreaPath": "MyProject\\Feature",
          "System.IterationPath": "MyProject\\Sprint 1",
        },
      });

      const params = {
        project: "proj1",
        title: "Full Test Case",
        steps: "1. Step with <special> & 'quotes' and \"double quotes\"",
        priority: 1,
        areaPath: "MyProject\\Feature",
        iterationPath: "MyProject\\Sprint 1",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.Common.Priority",
            value: 1,
          }),
          expect.objectContaining({
            path: "/fields/System.AreaPath",
            value: "MyProject\\Feature",
          }),
          expect.objectContaining({
            path: "/fields/System.IterationPath",
            value: "MyProject\\Sprint 1",
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("&lt;special&gt; &amp; &apos;quotes&apos; and &quot;double quotes&quot;"),
          }),
        ]),
        "proj1",
        "Test Case"
      );

      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1004,
            fields: {
              "System.Title": "Full Test Case",
              "Microsoft.VSTS.Common.Priority": 1,
              "System.AreaPath": "MyProject\\Feature",
              "System.IterationPath": "MyProject\\Sprint 1",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle non-numbered step formats", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1005,
        fields: {
          "System.Title": "Non-numbered Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "Non-numbered Test Case",
        steps: "Click the button\nVerify result\n\n3. Numbered step",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Click the button"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify result"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Numbered step"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1005,
            fields: {
              "System.Title": "Non-numbered Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle empty lines in steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1006,
        fields: {
          "System.Title": "Empty Lines Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "Empty Lines Test Case",
        steps: "1. First step\n\n\n2. Second step\n   \n3. Third step",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith({}, expect.any(Array), "proj1", "Test Case");
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1006,
            fields: {
              "System.Title": "Empty Lines Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should create test case without steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1007,
        fields: {
          "System.Title": "No Steps Test Case",
        },
      });

      const params = {
        project: "proj1",
        title: "No Steps Test Case",
        // no steps parameter
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "No Steps Test Case",
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1007,
            fields: {
              "System.Title": "No Steps Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle edge case XML characters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1008,
        fields: {
          "System.Title": "Edge Case XML Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Edge Case XML Test",
        steps: "1. Test with all XML chars: < > & ' \" and some unicode: \u00A0\u2028\u2029",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("&lt; &gt; &amp; &apos; &quot;"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 1008,
            fields: {
              "System.Title": "Edge Case XML Test",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle empty string steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1009,
        fields: {
          "System.Title": "Empty String Steps Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Empty String Steps Test",
        steps: "",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "Empty String Steps Test",
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Empty String Steps Test");
    });

    it("should handle only whitespace steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1010,
        fields: {
          "System.Title": "Whitespace Steps Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Whitespace Steps Test",
        steps: "   \n\t\n   ",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "Whitespace Steps Test",
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Whitespace Steps Test");
    });

    it("should handle steps with pipe delimiter for expected results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1011,
        fields: {
          "System.Title": "Pipe Delimiter Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Pipe Delimiter Test",
        steps: "1. Navigate to login page|Login page loads successfully\n2. Enter username|Username is accepted in field",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Navigate to login page"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Login page loads successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Enter username"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Username is accepted in field"),
          }),
          expect.not.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Pipe Delimiter Test");
    });

    it("should handle steps without pipe delimiter using default expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1012,
        fields: {
          "System.Title": "Default Expected Result Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Default Expected Result Test",
        steps: "1. Click the button\n2. Navigate to page",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Click the button"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Navigate to page"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Default Expected Result Test");
    });

    it("should handle mixed steps with and without pipe delimiter", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1013,
        fields: {
          "System.Title": "Mixed Delimiter Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Mixed Delimiter Test",
        steps: "1. Click login button|Login form appears\n2. Enter credentials\n3. Submit form|User is logged in successfully",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Click login button"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Login form appears"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Enter credentials"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Submit form"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("User is logged in successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Mixed Delimiter Test");
    });

    it("should handle empty expected result after pipe delimiter", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1014,
        fields: {
          "System.Title": "Empty Expected Result Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Empty Expected Result Test",
        steps: "1. Perform action|\n2. Another action|",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Perform action"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Another action"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Empty Expected Result Test");
    });

    it("should handle multiple pipe characters in expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1015,
        fields: {
          "System.Title": "Multiple Pipes Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Multiple Pipes Test",
        steps: "1. Check message|Message shows 'Success | Error | Warning'",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Check message"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Message shows &apos;Success"),
          }),
          expect.not.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Multiple Pipes Test");
    });

    it("should handle whitespace around pipe delimiter", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1016,
        fields: {
          "System.Title": "Whitespace Pipe Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Whitespace Pipe Test",
        steps: "1. Action with spaces   |   Expected result with spaces   \n2. Another action|\n3. Third action|Expected result",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Action with spaces"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Expected result with spaces"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Another action"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Third action"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Expected result"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Whitespace Pipe Test");
    });

    it("should handle special characters in expected results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1017,
        fields: {
          "System.Title": "Special Characters Expected Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Special Characters Expected Test",
        steps: "1. Test XML chars|Result contains < > & ' \" characters\n2. Test unicode|Result shows unicode: \u00A0\u2028\u2029",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Test XML chars"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Result contains &lt; &gt; &amp; &apos; &quot; characters"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Test unicode"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Result shows unicode:"),
          }),
          expect.not.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Special Characters Expected Test");
    });

    it("should handle non-numbered steps with pipe delimiter", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 1018,
        fields: {
          "System.Title": "Non-numbered Pipe Test",
        },
      });

      const params = {
        project: "proj1",
        title: "Non-numbered Pipe Test",
        steps: "Click button|Button is clicked\nVerify result|Result is displayed\nAction without number|Expected without number",
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Click button"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Button is clicked"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify result"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Result is displayed"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Action without number"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Expected without number"),
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Non-numbered Pipe Test");
    });

    it("should create test case with testsWorkItemId relationship", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 2001,
        fields: {
          "System.Title": "Test Case with Link",
        },
        relations: [
          {
            rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
            url: "https://dev.azure.com/testorg/proj1/_apis/wit/workItems/115304",
          },
        ],
      });

      const params = {
        project: "proj1",
        title: "Test Case with Link",
        steps: "1. Execute test|Test passes",
        testsWorkItemId: 115304,
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "Test Case with Link",
          }),
          expect.objectContaining({
            op: "add",
            path: "/relations/-",
            value: {
              rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
              url: "https://dev.azure.com/testorg/proj1/_apis/wit/workItems/115304",
            },
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 2001,
            fields: {
              "System.Title": "Test Case with Link",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
                url: "https://dev.azure.com/testorg/proj1/_apis/wit/workItems/115304",
              },
            ],
          },
          null,
          2
        )
      );
    });

    it("should create test case without testsWorkItemId when not provided", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 2002,
        fields: {
          "System.Title": "Test Case without Link",
        },
      });

      const params = {
        project: "proj1",
        title: "Test Case without Link",
        steps: "1. Execute test|Test passes",
        // testsWorkItemId not provided
      };
      const result = await handler(params);

      const patchDocument = (mockWitApi.createWorkItem as jest.Mock).mock.calls[0][1];
      const relationsPatch = patchDocument.find((patch: { path: string }) => patch.path === "/relations/-");

      expect(relationsPatch).toBeUndefined();
      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "Test Case without Link",
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 2002,
            fields: {
              "System.Title": "Test Case without Link",
            },
          },
          null,
          2
        )
      );
    });

    it("should create test case with testsWorkItemId and all other optional parameters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_create_test_case");
      if (!call) throw new Error("testplan_create_test_case tool not registered");
      const [, , , handler] = call;

      (mockWitApi.createWorkItem as jest.Mock).mockResolvedValue({
        id: 2003,
        fields: {
          "System.Title": "Complete Test Case with Link",
          "Microsoft.VSTS.Common.Priority": 1,
          "System.AreaPath": "MyProject\\Feature",
          "System.IterationPath": "MyProject\\Sprint 1",
        },
        relations: [
          {
            rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
            url: "https://dev.azure.com/testorg/proj1/_apis/wit/workItems/115304",
          },
        ],
      });

      const params = {
        project: "proj1",
        title: "Complete Test Case with Link",
        steps: "1. Execute comprehensive test|All tests pass successfully",
        priority: 1,
        areaPath: "MyProject\\Feature",
        iterationPath: "MyProject\\Sprint 1",
        testsWorkItemId: 115304,
      };
      const result = await handler(params);

      expect(mockWitApi.createWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.Title",
            value: "Complete Test Case with Link",
          }),
          expect.objectContaining({
            op: "add",
            path: "/relations/-",
            value: {
              rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
              url: "https://dev.azure.com/testorg/proj1/_apis/wit/workItems/115304",
            },
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.Common.Priority",
            value: 1,
          }),
          expect.objectContaining({
            path: "/fields/System.AreaPath",
            value: "MyProject\\Feature",
          }),
          expect.objectContaining({
            path: "/fields/System.IterationPath",
            value: "MyProject\\Sprint 1",
          }),
        ]),
        "proj1",
        "Test Case"
      );
      expect(result.content[0].text).toContain("Complete Test Case with Link");
    });
  });

  describe("update_test_case_steps tool", () => {
    it("should update test case steps with proper parameters", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136717,
        rev: 2,
        fields: {
          "System.Title": "Updated Test Case",
          "System.WorkItemType": "Test Case",
        },
      });

      const params = {
        id: 136717,
        steps: "1. Updated step 1|Expected result 1\n2. Updated step 2|Expected result 2",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith({}, expect.any(Array), 136717);
      expect(result.content[0].text).toBe(
        JSON.stringify(
          {
            id: 136717,
            rev: 2,
            fields: {
              "System.Title": "Updated Test Case",
              "System.WorkItemType": "Test Case",
            },
          },
          null,
          2
        )
      );
    });

    it("should handle steps with pipe delimiter for expected results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136718,
        rev: 3,
        fields: {
          "System.Title": "Test Case with Pipe Delimiters",
        },
      });

      const params = {
        id: 136718,
        steps: "1. Login to application|User is logged in successfully\n2. Navigate to dashboard|Dashboard page loads correctly\n3. Perform action|Action completes as expected",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Login to application"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("User is logged in successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Navigate to dashboard"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Dashboard page loads correctly"),
          }),
        ]),
        136718
      );
      expect(result.content[0].text).toContain("Test Case with Pipe Delimiters");
    });

    it("should handle steps without pipe delimiter using default expected result", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136719,
        rev: 2,
        fields: {
          "System.Title": "Test Case without Delimiters",
        },
      });

      const params = {
        id: 136719,
        steps: "1. Click button\n2. Verify result\n3. Close application",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Click button"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify result"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Close application"),
          }),
        ]),
        136719
      );
      expect(result.content[0].text).toContain("Test Case without Delimiters");
    });

    it("should handle XML special characters in steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136720,
        rev: 2,
        fields: {
          "System.Title": "Test Case with XML Characters",
        },
      });

      const params = {
        id: 136720,
        steps: "1. Enter text with <special> & 'quotes' and \"double quotes\"|Text is accepted correctly\n2. Submit form|Form submits without errors",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("&lt;special&gt; &amp; &apos;quotes&apos; and &quot;double quotes&quot;"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Text is accepted correctly"),
          }),
        ]),
        136720
      );
      expect(result.content[0].text).toContain("Test Case with XML Characters");
    });

    it("should handle empty or whitespace-only steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136721,
        rev: 2,
        fields: {
          "System.Title": "Test Case with Empty Steps",
        },
      });

      const params = {
        id: 136721,
        steps: "1. Valid step\n\n   \n2. Another valid step",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Valid step"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Another valid step"),
          }),
        ]),
        136721
      );
      expect(result.content[0].text).toContain("Test Case with Empty Steps");
    });

    it("should handle API errors when updating test case steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        id: 136722,
        steps: "1. Test step that will fail",
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error updating test case steps");
      expect(result.content[0].text).toContain("API Error");
    });

    it("should handle mixed numbered and non-numbered steps", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136723,
        rev: 2,
        fields: {
          "System.Title": "Mixed Steps Test Case",
        },
      });

      const params = {
        id: 136723,
        steps: "1. Numbered step one|Expected result one\nNon-numbered step\n3. Another numbered step|Expected result three",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Numbered step one"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Expected result one"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Non-numbered step"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Another numbered step"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Expected result three"),
          }),
        ]),
        136723
      );
      expect(result.content[0].text).toContain("Mixed Steps Test Case");
    });

    it("should handle multiple pipe characters in expected results", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136724,
        rev: 2,
        fields: {
          "System.Title": "Multiple Pipes Test Case",
        },
      });

      const params = {
        id: 136724,
        steps: "1. Check status message|Message shows 'Success | Warning | Error' status options",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Check status message"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Message shows &apos;Success"),
          }),
        ]),
        136724
      );
      expect(result.content[0].text).toContain("Multiple Pipes Test Case");
    });

    it("should handle empty expected results after pipe delimiter", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_update_test_case_steps");
      if (!call) throw new Error("testplan_update_test_case_steps tool not registered");
      const [, , , handler] = call;

      (mockWitApi.updateWorkItem as jest.Mock).mockResolvedValue({
        id: 136725,
        rev: 2,
        fields: {
          "System.Title": "Empty Expected Results Test Case",
        },
      });

      const params = {
        id: 136725,
        steps: "1. Perform action|\n2. Another action|",
      };
      const result = await handler(params);

      expect(mockWitApi.updateWorkItem).toHaveBeenCalledWith(
        {},
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Perform action"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Verify step completes successfully"),
          }),
          expect.objectContaining({
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: expect.stringContaining("Another action"),
          }),
        ]),
        136725
      );
      expect(result.content[0].text).toContain("Empty Expected Results Test Case");
    });
  });

  describe("add_test_cases_to_suite tool", () => {
    it("should add test cases to suite with array of IDs", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_add_test_cases_to_suite");
      if (!call) throw new Error("testplan_add_test_cases_to_suite tool not registered");
      const [, , , handler] = call;

      (mockTestApi.addTestCasesToSuite as jest.Mock).mockResolvedValue([{ testCase: { id: 1001 } }, { testCase: { id: 1002 } }]);

      const params = {
        project: "proj1",
        planId: 1,
        suiteId: 2,
        testCaseIds: [1001, 1002],
      };
      const result = await handler(params);

      expect(mockTestApi.addTestCasesToSuite).toHaveBeenCalledWith("proj1", 1, 2, "1001,1002");
      expect(result.content[0].text).toBe(JSON.stringify([{ testCase: { id: 1001 } }, { testCase: { id: 1002 } }], null, 2));
    });

    it("should add test cases to suite with comma-separated string", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_add_test_cases_to_suite");
      if (!call) throw new Error("testplan_add_test_cases_to_suite tool not registered");
      const [, , , handler] = call;

      (mockTestApi.addTestCasesToSuite as jest.Mock).mockResolvedValue([{ testCase: { id: 1003 } }, { testCase: { id: 1004 } }]);

      const params = {
        project: "proj1",
        planId: 1,
        suiteId: 2,
        testCaseIds: "1003,1004",
      };
      const result = await handler(params);

      expect(mockTestApi.addTestCasesToSuite).toHaveBeenCalledWith("proj1", 1, 2, "1003,1004");
      expect(result.content[0].text).toBe(JSON.stringify([{ testCase: { id: 1003 } }, { testCase: { id: 1004 } }], null, 2));
    });

    it("should handle empty results when adding test cases", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_add_test_cases_to_suite");
      if (!call) throw new Error("testplan_add_test_cases_to_suite tool not registered");
      const [, , , handler] = call;

      (mockTestApi.addTestCasesToSuite as jest.Mock).mockResolvedValue([]);

      const params = {
        project: "proj1",
        planId: 1,
        suiteId: 2,
        testCaseIds: [1001],
      };
      const result = await handler(params);

      expect(result.content[0].text).toBe(JSON.stringify([], null, 2));
    });

    it("should handle API errors when adding test cases to suite", async () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "testplan_add_test_cases_to_suite");
      if (!call) throw new Error("testplan_add_test_cases_to_suite tool not registered");
      const [, , , handler] = call;

      (mockTestApi.addTestCasesToSuite as jest.Mock).mockRejectedValue(new Error("API Error"));

      const params = {
        project: "proj1",
        planId: 1,
        suiteId: 2,
        testCaseIds: [1001],
      };

      const result = await handler(params);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error adding test cases to suite");
      expect(result.content[0].text).toContain("API Error");
    });
  });
});
