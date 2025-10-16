// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TestPlanCreateParams } from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { z } from "zod";

const Test_Plan_Tools = {
  create_test_plan: "testplan_create_test_plan",
  create_test_case: "testplan_create_test_case",
  update_test_case_steps: "testplan_update_test_case_steps",
  add_test_cases_to_suite: "testplan_add_test_cases_to_suite",
  test_results_from_build_id: "testplan_show_test_results_from_build_id",
  list_test_cases: "testplan_list_test_cases",
  list_test_plans: "testplan_list_test_plans",
  create_test_suite: "testplan_create_test_suite",
};

function configureTestPlanTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>, isReadOnlyMode: boolean) {
  const registeredTools: RegisteredTool[] = [
    server.tool(
      Test_Plan_Tools.list_test_plans,
      "Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
        filterActivePlans: z.boolean().default(true).describe("Filter to include only active test plans. Defaults to true."),
        includePlanDetails: z.boolean().default(false).describe("Include detailed information about each test plan."),
        continuationToken: z.string().optional().describe("Token to continue fetching test plans from a previous request."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, filterActivePlans, includePlanDetails, continuationToken }) => {
        const owner = ""; //making owner an empty string untill we can figure out how to get owner id
        const connection = await connectionProvider();
        const testPlanApi = await connection.getTestPlanApi();

        const testPlans = await testPlanApi.getTestPlans(project, owner, continuationToken, includePlanDetails, filterActivePlans);

        return {
          content: [{ type: "text", text: JSON.stringify(testPlans, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.create_test_plan,
      "Creates a new test plan in the project.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project where the test plan will be created."),
        name: z.string().describe("The name of the test plan to be created."),
        iteration: z.string().describe("The iteration path for the test plan"),
        description: z.string().optional().describe("The description of the test plan"),
        startDate: z.string().optional().describe("The start date of the test plan"),
        endDate: z.string().optional().describe("The end date of the test plan"),
        areaPath: z.string().optional().describe("The area path for the test plan"),
      },
      {
        readOnlyHint: false,
      },
      async ({ project, name, iteration, description, startDate, endDate, areaPath }) => {
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

        const createdTestPlan = await testPlanApi.createTestPlan(testPlanToCreate, project);

        return {
          content: [{ type: "text", text: JSON.stringify(createdTestPlan, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.create_test_suite,
      "Creates a new test suite in a test plan.",
      {
        project: z.string().describe("Project ID or project name"),
        planId: z.number().describe("ID of the test plan that contains the suites"),
        parentSuiteId: z.number().describe("ID of the parent suite under which the new suite will be created, if not given by user this can be id of a root suite of the test plan"),
        name: z.string().describe("Name of the child test suite"),
      },
      {
        readOnlyHint: false,
      },
      async ({ project, planId, parentSuiteId, name }) => {
        const connection = await connectionProvider();
        const testPlanApi = await connection.getTestPlanApi();

        const testSuiteToCreate = {
          name,
          parentSuite: {
            id: parentSuiteId,
            name: "",
          },
          suiteType: 2,
        };

        const createdTestSuite = await testPlanApi.createTestSuite(testSuiteToCreate, project, planId);

        return {
          content: [{ type: "text", text: JSON.stringify(createdTestSuite, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.add_test_cases_to_suite,
      "Adds existing test cases to a test suite.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
        planId: z.number().describe("The ID of the test plan."),
        suiteId: z.number().describe("The ID of the test suite."),
        testCaseIds: z.string().or(z.array(z.string())).describe("The ID(s) of the test case(s) to add. "),
      },
      {
        readOnlyHint: false,
      },
      async ({ project, planId, suiteId, testCaseIds }) => {
        const connection = await connectionProvider();
        const testApi = await connection.getTestApi();

        // If testCaseIds is an array, convert it to comma-separated string
        const testCaseIdsString = Array.isArray(testCaseIds) ? testCaseIds.join(",") : testCaseIds;

        const addedTestCases = await testApi.addTestCasesToSuite(project, planId, suiteId, testCaseIdsString);

        return {
          content: [{ type: "text", text: JSON.stringify(addedTestCases, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.create_test_case,
      "Creates a new test case work item.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
        title: z.string().describe("The title of the test case."),
        steps: z
          .string()
          .optional()
          .describe(
            "The steps to reproduce the test case. Make sure to format each step as '1. Step one|Expected result one\n2. Step two|Expected result two. USE '|' as the delimiter between step and expected result. DO NOT use '|' in the description of the step or expected result."
          ),
        priority: z.number().optional().describe("The priority of the test case."),
        areaPath: z.string().optional().describe("The area path for the test case."),
        iterationPath: z.string().optional().describe("The iteration path for the test case."),
        testsWorkItemId: z.number().optional().describe("Optional work item id that will be set as a Microsoft.VSTS.Common.TestedBy-Reverse link to the test case."),
      },
      {
        readOnlyHint: false,
      },
      async ({ project, title, steps, priority, areaPath, iterationPath, testsWorkItemId }) => {
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

        if (testsWorkItemId) {
          patchDocument.push({
            op: "add",
            path: "/relations/-",
            value: {
              rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
              url: `${connection.serverUrl}/${project}/_apis/wit/workItems/${testsWorkItemId}`,
            },
          });
        }

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

        const workItem = await witClient.createWorkItem({}, patchDocument, project, "Test Case");

        return {
          content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.update_test_case_steps,
      "Update an existing test case work item.",
      {
        id: z.number().describe("The ID of the test case work item to update."),
        steps: z
          .string()
          .describe(
            "The steps to reproduce the test case. Make sure to format each step as '1. Step one|Expected result one\n2. Step two|Expected result two. USE '|' as the delimiter between step and expected result. DO NOT use '|' in the description of the step or expected result."
          ),
      },
      {
        readOnlyHint: false,
      },
      async ({ id, steps }) => {
        const connection = await connectionProvider();
        const witClient = await connection.getWorkItemTrackingApi();

        let stepsXml;
        if (steps) {
          stepsXml = convertStepsToXml(steps);
        }

        // Create JSON patch document for work item
        const patchDocument = [];

        if (stepsXml) {
          patchDocument.push({
            op: "add",
            path: "/fields/Microsoft.VSTS.TCM.Steps",
            value: stepsXml,
          });
        }

        const workItem = await witClient.updateWorkItem({}, patchDocument, id);

        return {
          content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.list_test_cases,
      "Gets a list of test cases in the test plan.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
        planid: z.number().describe("The ID of the test plan."),
        suiteid: z.number().describe("The ID of the test suite."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, planid, suiteid }) => {
        const connection = await connectionProvider();
        const coreApi = await connection.getTestPlanApi();
        const testcases = await coreApi.getTestCaseList(project, planid, suiteid);

        return {
          content: [{ type: "text", text: JSON.stringify(testcases, null, 2) }],
        };
      }
    ),

    server.tool(
      Test_Plan_Tools.test_results_from_build_id,
      "Gets a list of test results for a given project and build ID.",
      {
        project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
        buildid: z.number().describe("The ID of the build."),
      },
      {
        readOnlyHint: true,
      },
      async ({ project, buildid }) => {
        const connection = await connectionProvider();
        const coreApi = await connection.getTestResultsApi();
        const testResults = await coreApi.getTestResultDetailsForBuild(project, buildid);

        return {
          content: [{ type: "text", text: JSON.stringify(testResults, null, 2) }],
        };
      }
    ),
  ];

  if (isReadOnlyMode) {
    for (const tool of registeredTools) {
      if (!tool.annotations?.readOnlyHint) {
        tool.remove();
      }
    }
  }
}

/*
 * Helper function to convert steps text to XML format required
 */
function convertStepsToXml(steps: string): string {
  // Accepts steps in the format: '1. Step one|Expected result one\n2. Step two|Expected result two'
  const stepsLines = steps.split("\n").filter((line) => line.trim() !== "");

  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    if (stepLine) {
      // Split step and expected result by '|', fallback to default if not provided
      const [stepPart, expectedPart] = stepLine.split("|").map((s) => s.trim());
      const stepMatch = stepPart.match(/^(\d+)\.\s*(.+)$/);
      const stepText = stepMatch ? stepMatch[2] : stepPart;
      const expectedText = expectedPart || "Verify step completes successfully";

      xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${escapeXml(stepText)}</parameterizedString>
                    <parameterizedString isformatted="true">${escapeXml(expectedText)}</parameterizedString>
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
