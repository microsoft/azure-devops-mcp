import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureTestPlanTools } from "../../../src/tools/test-plans";
import { ITestPlanApi } from "azure-devops-node-api/TestPlanApi";
import { ITestResultsApi } from "azure-devops-node-api/TestResultsApi";
import { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import { ITestApi } from "azure-devops-node-api/TestApi";

type TokenProviderMock = () => Promise<AccessToken>;
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
      addTestCasesToSuite: jest.fn(),
      getTestCaseList: jest.fn(),
    } as unknown as ITestPlanApi;
    mockTestResultsApi = {
      getTestResultDetailsForBuild: jest.fn(),
    } as unknown as ITestResultsApi;
    mockWitApi = {
      createWorkItem: jest.fn(),
    } as unknown as IWorkItemTrackingApi;
    mockTestApi = {
      addTestCasesToSuite: jest.fn(),
    } as unknown as ITestApi;
    mockConnection = {
      getTestPlanApi: jest.fn().mockResolvedValue(mockTestPlanApi),
      getTestResultsApi: jest.fn().mockResolvedValue(mockTestResultsApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi),
      getTestApi: jest.fn().mockResolvedValue(mockTestApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers test plan tools on the server", () => {
      configureTestPlanTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock).mock.calls.map((call) => call[0])).toEqual(
        expect.arrayContaining(["testplan_list_test_plans", "testplan_create_test_plan", "testplan_add_test_cases_to_suite", "testplan_list_test_cases", "testplan_show_test_results_from_build_id"])
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

      await expect(handler(params)).rejects.toThrow("API Error");
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

      await expect(handler(params)).rejects.toThrow("API Error");
    });
  });
});
