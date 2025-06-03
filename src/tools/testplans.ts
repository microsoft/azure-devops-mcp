import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import {
  TestPlanCreateParams,
  TestSuiteUpdateParams,
  TestPlanUpdateParams,
} from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { z } from "zod";

const Test_Plan_Tools = {
  create_test_plan: "ado_create_test_plan",
  create_test_case: "ado_create_test_case",
  add_test_cases_to_suite: "ado_add_test_cases_to_suite",
  test_results_from_build_id: "ado_show_test_results_from_build_id",
  list_test_cases: "ado_list_test_cases",
  list_test_plans: "ado_list_test_plans",
  create_test_suite: "ado_create_test_suite",
  list_test_cases_in_test_suite: "ado_list_test_cases_in_test_suite",
  list_test_suites: "ado_list_test_suites",
  update_test_case: "ado_update_test_case",
  update_test_suite: "ado_update_test_suite",
  update_test_plan: "ado_update_test_plan"
};

function configureTestPlanTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  /*
    LIST OF TEST PLANS
    get list of test plany by project
  */
  server.tool(
    Test_Plan_Tools.list_test_plans,
    "List of test plans by project",
    {
      project: z.string(),
      filterActivePlans: z.boolean().default(true),
      includePlanDetails: z.boolean().default(false),
      continuationToken: z.string().optional(),
    },
    async ({
      project,
      filterActivePlans,
      includePlanDetails,
      continuationToken,
    }) => {
      const owner = ""; //making owner an empty string untill we can figure out how to get owner id
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testPlans = await testPlanApi.getTestPlans(
        project,
        owner,
        continuationToken,
        includePlanDetails,
        filterActivePlans
      );

      return {
        content: [{ type: "text", text: JSON.stringify(testPlans, null, 2) }],
      };
    }
  );

  /*
    Create Test Plan - CREATE
  */
  server.tool(
    Test_Plan_Tools.create_test_plan,
    "Creates a new test plan in the project.",
    {
      project: z.string(),
      name: z.string(),
      iteration: z.string(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      areaPath: z.string().optional(),
    },
    async ({
      project,
      name,
      iteration,
      description,
      startDate,
      endDate,
      areaPath,
    }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testPlanToCreate: TestPlanCreateParams = {
        name,
        iteration,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        areaPath,
      };

      const createdTestPlan = await testPlanApi.createTestPlan(
        testPlanToCreate,
        project
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(createdTestPlan, null, 2) },
        ],
      };
    }
  );

  /*
    Add Test Cases to Suite - ADD
  */
  server.tool(
    Test_Plan_Tools.add_test_cases_to_suite,
    "Adds existing test cases to a test suite.",
    {
      project: z.string(),
      planId: z.number(),
      suiteId: z.number(),
      testCaseIds: z.string().or(z.array(z.string())), // Accept either a comma-separated string or an array
    },
    async ({ project, planId, suiteId, testCaseIds }) => {
      const connection = await connectionProvider();
      const testApi = await connection.getTestApi();

      // If testCaseIds is an array, convert it to comma-separated string
      const testCaseIdsString = Array.isArray(testCaseIds)
        ? testCaseIds.join(",")
        : testCaseIds;

      const addedTestCases = await testApi.addTestCasesToSuite(
        project,
        planId,
        suiteId,
        testCaseIdsString
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(addedTestCases, null, 2) },
        ],
      };
    }
  );

  /*
    Create Test Case - CREATE
  */
  server.tool(
    Test_Plan_Tools.create_test_case,
    "Creates a new test case work item.",
    {
      project: z.string(),
      title: z.string(),
      steps: z.string().optional(),
      priority: z.number().optional(),
      areaPath: z.string().optional(),
      iterationPath: z.string().optional(),
    },
    async ({ project, title, steps, priority, areaPath, iterationPath }) => {
      const connection = await connectionProvider();
      const witClient = await connection.getWorkItemTrackingApi();

      let stepsXml;
      if (steps) {
        stepsXml = convertStepsToXml(steps);
      }

      // Create JSON patch document for work item
      const patchDocument = [];

      patchDocument.push({
        op: "add",
        path: "/fields/System.Title",
        value: title,
      });

      if (stepsXml) {
        patchDocument.push({
          op: "add",
          path: "/fields/Microsoft.VSTS.TCM.Steps",
          value: stepsXml,
        });
      }

      if (priority) {
        patchDocument.push({
          op: "add",
          path: "/fields/Microsoft.VSTS.Common.Priority",
          value: priority,
        });
      }

      if (areaPath) {
        patchDocument.push({
          op: "add",
          path: "/fields/System.AreaPath",
          value: areaPath,
        });
      }

      if (iterationPath) {
        patchDocument.push({
          op: "add",
          path: "/fields/System.IterationPath",
          value: iterationPath,
        });
      }

      const workItem = await witClient.createWorkItem(
        {},
        patchDocument,
        project,
        "Test Case"
      );

      return {
        content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
      };
    }
  );

  /* 
    TEST PLANS
    Gets a list of test cases for a given testplan.
  */
  server.tool(
    Test_Plan_Tools.list_test_cases,
    "Gets a list of test cases in the test plan.",
    {
      project: z.string(),
      planid: z.number(),
      suiteid: z.number(),
    },
    async ({ project, planid, suiteid }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getTestPlanApi();
      const testcases = await coreApi.getTestCaseList(project, planid, suiteid);

      return {
        content: [{ type: "text", text: JSON.stringify(testcases, null, 2) }],
      };
    }
  );

  /*
    Test results list - LIST
  */
  server.tool(
    Test_Plan_Tools.test_results_from_build_id,
    "Gets a list of test results in the project.",
    {
      project: z.string(),
      buildid: z.number(),
    },
    async ({ project, buildid }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getTestResultsApi();
      const testResults = await coreApi.getTestResultDetailsForBuild(
        project,
        buildid
      );

      return {
        content: [{ type: "text", text: JSON.stringify(testResults, null, 2) }],
      };
    }
  );

}

 /*
    Create Test Suite - CREATE
  */
  server.tool(
    Test_Plan_Tools.create_test_suite,
    "Creates a new test suite in a test plan.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan that contains the suites"),
      parentSuiteId: z.number().describe("ID of the parent suite under which the new suite will be created, if not given by user this can be id of a root suite of the test plan"),
      name: z.string().describe("Name of the test suite")
    },
    async ({ project, planId, parentSuiteId, name }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testSuiteToCreate = {
        name,
        parentSuite: {
          id: parentSuiteId,
          name: ""
        },
        suiteType: 2
      };

      const createdTestSuite = await testPlanApi.createTestSuite(
        testSuiteToCreate,
        project,
        planId
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(createdTestSuite, null, 2) },
        ],
      };
    }
  );

  /*
    Get Test Cases List - GET
    This tool retrieves test cases from a test suite with additional filtering options
  */
  server.tool(
    Test_Plan_Tools.list_test_cases_in_test_suite,
    "Gets a detailed list of test cases in a test suite with filtering options.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan for which test cases are requested"),
      suiteId: z.number().describe("ID of the test suite for which test cases are requested")
    },
    async ({ project, planId, suiteId }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testCases = await testPlanApi.getTestCaseList(
        project,
        planId,
        suiteId
      );

      return {
        content: [{ type: "text", text: JSON.stringify(testCases, null, 2) }],
      };
    }
  );

  /*
    Get Test Suites for Plan - LIST
    This tool retrieves test suites for a given test plan
  */
  server.tool(
    Test_Plan_Tools.list_test_suites,
    "Gets a list of test suites for a test plan.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan for which suites are requested"),
      continuationToken: z.string().optional().describe("If the list of suites returned is not complete, a continuation token to query next batch of suites")
    },
    async ({ project, planId, continuationToken }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testSuites = await testPlanApi.getTestSuitesForPlan(
        project,
        planId,
        undefined,
        continuationToken
      );

      return {
        content: [{ type: "text", text: JSON.stringify(testSuites, null, 2) }],
      };
    }
  );

  /*
    Update Test Case - UPDATE
  */
  server.tool(
    Test_Plan_Tools.update_test_case,
    "Updates an existing test case work item.",
    {
      project: z.string().describe("Project ID or project name"),
      testCaseId: z.number().describe("ID of the test case to update"),
      title: z.string().optional().describe("New title for the test case"),
      steps: z.string().optional().describe("New test steps (one per line, optionally numbered)"),
      priority: z.number().optional().describe("New priority value (1-4, where 1 is highest)"),
      areaPath: z.string().optional().describe("New area path for the test case"),
      iterationPath: z.string().optional().describe("New iteration path for the test case"),
      state: z.string().optional().describe("New state (e.g., Active, Resolved, Closed)"),
      assignedTo: z.string().optional().describe("New assignee (user name or email)")
    },
    async ({ project, testCaseId, title, steps, priority, areaPath, iterationPath, state, assignedTo }) => {
      const connection = await connectionProvider();
      const witClient = await connection.getWorkItemTrackingApi();

      // Create JSON patch document for work item update
      const patchDocument = [];

      if (title) {
        patchDocument.push({
          op: "replace",
          path: "/fields/System.Title",
          value: title,
        });
      }

      if (steps) {
        const stepsXml = convertStepsToXml(steps);
        patchDocument.push({
          op: "replace",
          path: "/fields/Microsoft.VSTS.TCM.Steps",
          value: stepsXml,
        });
      }

      if (priority) {
        patchDocument.push({
          op: "replace",
          path: "/fields/Microsoft.VSTS.Common.Priority",
          value: priority,
        });
      }

      if (areaPath) {
        patchDocument.push({
          op: "replace",
          path: "/fields/System.AreaPath",
          value: areaPath,
        });
      }

      if (iterationPath) {
        patchDocument.push({
          op: "replace",
          path: "/fields/System.IterationPath",
          value: iterationPath,
        });
      }

      if (state) {
        patchDocument.push({
          op: "replace",
          path: "/fields/System.State",
          value: state,
        });
      }

      if (assignedTo) {
        patchDocument.push({
          op: "replace",
          path: "/fields/System.AssignedTo",
          value: assignedTo,
        });
      }

      const updatedWorkItem = await witClient.updateWorkItem(
        {},
        patchDocument,
        testCaseId,
        project
      );

      return {
        content: [{ type: "text", text: JSON.stringify(updatedWorkItem, null, 2) }],
      };
    }
  );

  /*
    Update Test Suite - UPDATE
  */
  server.tool(
    Test_Plan_Tools.update_test_suite,
    "Updates an existing test suite.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan that contains the suite"),
      suiteId: z.number().describe("ID of the test suite to update"),
      name: z.string().optional().describe("New name for the test suite"),
      queryString: z.string().optional().describe("New query string for dynamic test suites"),
      revision: z.number().optional().describe("Revision number for optimistic concurrency control")
    },
    async ({ project, planId, suiteId, name, queryString, revision }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testSuiteUpdateParams: Partial<TestSuiteUpdateParams> = {};

      if (name) {
        testSuiteUpdateParams.name = name;
      }

      if (queryString) {
        testSuiteUpdateParams.queryString = queryString;
      }

      if (revision) {
        testSuiteUpdateParams.revision = revision;
      }

      if (Object.keys(testSuiteUpdateParams).length === 0) {
        throw new Error("At least one field must be provided to update the test suite");
      }

      const updatedTestSuite = await testPlanApi.updateTestSuite(
        testSuiteUpdateParams as TestSuiteUpdateParams,
        project,
        planId,
        suiteId
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(updatedTestSuite, null, 2) },
        ],
      };
    }
  );

  /*
    Update Test Plan - UPDATE
  */
  server.tool(
    Test_Plan_Tools.update_test_plan,
    "Updates an existing test plan.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan to update"),
      name: z.string().optional().describe("New name for the test plan"),
      description: z.string().optional().describe("New description for the test plan"),
      startDate: z.string().optional().describe("New start date for the test plan (ISO date string)"),
      endDate: z.string().optional().describe("New end date for the test plan (ISO date string)"),
      areaPath: z.string().optional().describe("New area path for the test plan"),
      iteration: z.string().optional().describe("New iteration path for the test plan"),
      state: z.string().optional().describe("New state for the test plan"),
      revision: z.number().optional().describe("Revision number for optimistic concurrency control")
    },
    async ({ project, planId, name, description, startDate, endDate, areaPath, iteration, state, revision }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();

      const testPlanUpdateParams: Partial<TestPlanUpdateParams> = {};

      if (name) {
        testPlanUpdateParams.name = name;
      }

      if (description) {
        testPlanUpdateParams.description = description;
      }

      if (startDate) {
        testPlanUpdateParams.startDate = new Date(startDate);
      }

      if (endDate) {
        testPlanUpdateParams.endDate = new Date(endDate);
      }

      if (areaPath) {
        testPlanUpdateParams.areaPath = areaPath;
      }

      if (iteration) {
        testPlanUpdateParams.iteration = iteration;
      }

      if (state) {
        testPlanUpdateParams.state = state;
      }

      if (revision) {
        testPlanUpdateParams.revision = revision;
      }

      const updatedTestPlan = await testPlanApi.updateTestPlan(
        testPlanUpdateParams as TestPlanUpdateParams,
        project,
        planId
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(updatedTestPlan, null, 2) },
        ],
      };
    }
  );

/*
 * Helper function to convert steps text to XML format required
*/
function convertStepsToXml(steps: string): string {
  const stepsLines = steps.split("\n").filter((line) => line.trim() !== "");

  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    if (stepLine) {
      const stepMatch = stepLine.match(/^(\d+)\.\s*(.+)$/);
      const stepText = stepMatch ? stepMatch[2] : stepLine;

      xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${escapeXml(
                      stepText
                    )}</parameterizedString>
                    <parameterizedString isformatted="true">Verify step completes successfully</parameterizedString>
                </step>`;
    }
  }

  xmlSteps += "</steps>";
  return xmlSteps;
}

/*
 * Helper function to escape XML special characters
*/
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export { Test_Plan_Tools, configureTestPlanTools };
