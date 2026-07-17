// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TestPlanCreateParams } from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { z } from "zod";
import { apiVersion } from "../utils.js";

const TEST_PLAN_TOOLS = {
  testplan: "testplan",
  test_results_from_build_id: "testplan_show_test_results_from_build_id",
  testplan_test_plan_write: "testplan_test_plan_write",
  testplan_test_suite_write: "testplan_test_suite_write",
  testplan_test_case_write: "testplan_test_case_write",
};

function configureTestPlanTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider?: () => string) {
  // ─── testplan (read-only) ────────────────────────────────────────────
  server.tool(
    TEST_PLAN_TOOLS.testplan,
    "Retrieve test plan data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list_plans", "list_suites", "list_cases"])
        .describe("The action to perform. Options: list_plans (list test plans in a project), list_suites (list test suites under a test plan), list_cases (list test cases under a test suite)."),
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      filterActivePlans: z.boolean().default(true).describe("Filter to include only active test plans. Used for: list_plans. Defaults to true."),
      includePlanDetails: z.boolean().default(false).describe("Include detailed information about each test plan. Used for: list_plans."),
      planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: list_suites, list_cases."),
      suiteId: z.coerce.number().min(1).optional().describe("The ID of the test suite. Required for: list_cases."),
      continuationToken: z.string().optional().describe("Token to continue fetching results from a previous request. Used for: list_plans, list_suites, list_cases."),
    },
    async ({ action, project, filterActivePlans, includePlanDetails, planId, suiteId, continuationToken }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();

        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
        };

        const userAgent = userAgentProvider?.();

        if (userAgent) {
          headers["User-Agent"] = userAgent;
        }

        if (action === "list_plans") {
          const params = new URLSearchParams({ "api-version": apiVersion });
          if (filterActivePlans) params.append("filterActivePlans", "true");
          if (includePlanDetails) params.append("includePlanDetails", "true");
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test plans (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testPlans = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const result: { testPlans: typeof testPlans; continuationToken?: string } = { testPlans };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } else if (action === "list_suites") {
          if (!planId) return { content: [{ type: "text", text: "planId is required for list_suites" }], isError: true };

          const params = new URLSearchParams({ "api-version": apiVersion, "expand": "children" });
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans/${planId}/Suites?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test suites (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testSuites = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const suiteMap = new Map();
          testSuites.forEach((suite: any) => {
            suiteMap.set(suite.id, {
              id: suite.id,
              name: suite.name,
              parentSuiteId: suite.parentSuite?.id,
              children: [] as any[],
            });
          });

          const roots: any[] = [];
          suiteMap.forEach((suite: any) => {
            if (suite.parentSuiteId && suiteMap.has(suite.parentSuiteId)) {
              suiteMap.get(suite.parentSuiteId).children.push(suite);
            } else {
              roots.push(suite);
            }
          });

          const cleanSuite = (suite: any): any => {
            const cleaned: any = { id: suite.id, name: suite.name };
            if (suite.children && suite.children.length > 0) {
              cleaned.children = suite.children.map((child: any) => cleanSuite(child));
            }
            return cleaned;
          };

          const cleanedSuites = roots.map((root: any) => cleanSuite(root));
          const result: { testSuites: typeof cleanedSuites; continuationToken?: string } = { testSuites: cleanedSuites };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } else {
          if (!planId) return { content: [{ type: "text", text: "planId is required for list_cases" }], isError: true };
          if (!suiteId) return { content: [{ type: "text", text: "suiteId is required for list_cases" }], isError: true };

          const params = new URLSearchParams({ "api-version": "7.2-preview.3" });
          if (continuationToken) params.append("continuationToken", continuationToken);
          const url = `${connection.serverUrl}/${encodeURIComponent(project)}/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?${params.toString()}`;

          const response = await fetch(url, { method: "GET", headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list test cases (${response.status}): ${errorText}`);
          }

          const body = await response.json();
          const testcases = body.value ?? [];
          const nextToken = response.headers.get("x-ms-continuationtoken") ?? undefined;

          const result: { testCases: typeof testcases; continuationToken?: string } = { testCases: testcases };
          if (nextToken) result.continuationToken = nextToken;

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const prefix = action === "list_plans" ? "Error listing test plans" : action === "list_suites" ? "Error listing test suites" : "Error listing test cases";
        return {
          content: [{ type: "text", text: `${prefix}: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // ─── testplan_show_test_results_from_build_id ──────────────────────────────────────
  server.tool(
    TEST_PLAN_TOOLS.test_results_from_build_id,
    "Gets a list of test results for a given project and build ID. Can filter by test outcome (e.g. Failed, Passed, Aborted). Returns test case titles, error messages, stack traces, and outcomes. Efficiently handles builds with large numbers of test runs.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      buildid: z.coerce.number().min(1).describe("The ID of the build."),
      outcomes: z.array(z.string()).optional().describe("Filter results by test outcome, e.g. ['Failed', 'Passed', 'Aborted']."),
    },
    async ({ project, buildid, outcomes }) => {
      try {
        const connection = await connectionProvider();
        const testResultsApi = await connection.getTestResultsApi();

        const outcomeFilter = outcomes?.length ? `Outcome eq ${outcomes.join(",")}` : undefined;

        const testResultDetails = await testResultsApi.getTestResultDetailsForBuild(project, buildid, undefined, undefined, outcomeFilter, undefined, true);

        const allResults: any[] = [];
        if (testResultDetails.resultsForGroup) {
          for (const group of testResultDetails.resultsForGroup) {
            if (group.results) {
              for (const result of group.results) {
                allResults.push(result);
              }
            }
          }
        }

        const formattedResults = allResults.map((r) => ({
          id: r.id,
          testCaseTitle: r.testCaseTitle,
          outcome: r.outcome,
          errorMessage: r.errorMessage,
          stackTrace: r.stackTrace,
          automatedTestName: r.automatedTestName,
          automatedTestStorage: r.automatedTestStorage,
          durationInMs: r.durationInMs,
          runId: r.testRun?.id,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(formattedResults, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error fetching test results: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // ─── testplan_test_plan_write ─────────────────────────────────────────────────────
  server.tool(
    TEST_PLAN_TOOLS.testplan_test_plan_write,
    "Write operations for test plans. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create"]).describe("The action to perform. Options: create (create a new test plan)."),
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      name: z.string().optional().describe("The name of the test plan. Required for: create."),
      iteration: z.string().optional().describe("The iteration path for the test plan. Required for: create."),
      description: z.string().optional().describe("The description of the test plan. Used for: create."),
      startDate: z.string().optional().describe("The start date of the test plan. Used for: create."),
      endDate: z.string().optional().describe("The end date of the test plan. Used for: create."),
      areaPath: z.string().optional().describe("The area path for the test plan. Used for: create."),
    },
    async ({ project, name, iteration, description, startDate, endDate, areaPath }) => {
      try {
        if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };
        if (!iteration) return { content: [{ type: "text", text: "iteration is required for create" }], isError: true };

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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error creating test plan: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // ─── testplan_test_suite_write ────────────────────────────────────────────────────
  server.tool(
    TEST_PLAN_TOOLS.testplan_test_suite_write,
    "Write operations for test suites. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["create", "add_test_cases"])
        .describe("The action to perform. Options: create (create a new test suite in a test plan), add_test_cases (add existing test cases to a test suite)."),
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: create, add_test_cases."),
      parentSuiteId: z.coerce.number().min(1).optional().describe("ID of the parent suite under which the new suite will be created. Required for: create."),
      name: z.string().optional().describe("Name of the child test suite. Required for: create."),
      suiteId: z.coerce.number().min(1).optional().describe("The ID of the test suite. Required for: add_test_cases."),
      testCaseIds: z.string().or(z.array(z.string())).optional().describe("The ID(s) of the test case(s) to add. Required for: add_test_cases."),
    },
    async ({ action, project, planId, parentSuiteId, name, suiteId, testCaseIds }) => {
      try {
        if (action === "create") {
          if (!planId) return { content: [{ type: "text", text: "planId is required for create" }], isError: true };
          if (!parentSuiteId) return { content: [{ type: "text", text: "parentSuiteId is required for create" }], isError: true };
          if (!name) return { content: [{ type: "text", text: "name is required for create" }], isError: true };

          const maxRetries = 5;
          const baseDelay = 500;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const connection = await connectionProvider();
              const testPlanApi = await connection.getTestPlanApi();

              const testSuiteToCreate = {
                name,
                parentSuite: { id: parentSuiteId, name: "" },
                suiteType: 2,
              };

              const createdTestSuite = await testPlanApi.createTestSuite(testSuiteToCreate, project, planId);

              return {
                content: [{ type: "text", text: JSON.stringify(createdTestSuite, null, 2) }],
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
              const isConcurrencyError = errorMessage.includes("TF26071") || errorMessage.includes("got update") || errorMessage.includes("changed by someone else");

              if (isConcurrencyError && attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }

              return {
                content: [{ type: "text", text: `Error creating test suite: ${errorMessage}` }],
                isError: true,
              };
            }
          }

          /* istanbul ignore next */
          return {
            content: [{ type: "text", text: "Error creating test suite: Maximum retries exceeded" }],
            isError: true,
          };
        } else if (action === "add_test_cases") {
          if (!planId) return { content: [{ type: "text", text: "planId is required for add_test_cases" }], isError: true };
          if (!suiteId) return { content: [{ type: "text", text: "suiteId is required for add_test_cases" }], isError: true };
          if (!testCaseIds) return { content: [{ type: "text", text: "testCaseIds is required for add_test_cases" }], isError: true };

          const connection = await connectionProvider();
          const testApi = await connection.getTestApi();

          const testCaseIdsString = Array.isArray(testCaseIds) ? testCaseIds.join(",") : testCaseIds;
          const addedTestCases = await testApi.addTestCasesToSuite(project, planId, suiteId, testCaseIdsString);

          return {
            content: [{ type: "text", text: JSON.stringify(addedTestCases, null, 2) }],
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error adding test cases to suite: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // ─── testplan_test_case_write ─────────────────────────────────────────────────────
  server.tool(
    TEST_PLAN_TOOLS.testplan_test_case_write,
    "Write operations for test cases. Use the action parameter to specify the operation.",
    {
      action: z.enum(["create", "update_steps"]).describe("The action to perform. Options: create (create a new test case work item), update_steps (update steps on an existing test case)."),
      project: z.string().optional().describe("The unique identifier (ID or name) of the Azure DevOps project. Required for: create."),
      title: z.string().optional().describe("The title of the test case. Required for: create."),
      priority: z.coerce.number().optional().describe("The priority of the test case. Used for: create."),
      areaPath: z.string().optional().describe("The area path for the test case. Used for: create."),
      iterationPath: z.string().optional().describe("The iteration path for the test case. Used for: create."),
      testsWorkItemId: z.coerce.number().min(1).optional().describe("Work item ID to set as a Microsoft.VSTS.Common.TestedBy-Reverse link. Used for: create."),
      id: z.coerce.number().min(1).optional().describe("The ID of the test case work item to update. Required for: update_steps."),
      steps: z
        .string()
        .optional()
        .describe(
          "The steps for the test case. Format each step as '1. Step one|Expected result one\n2. Step two|Expected result two'. Use '|' as the delimiter between step and expected result. Required for: update_steps. Used for: create."
        ),
    },
    async ({ action, project, title, steps, priority, areaPath, iterationPath, testsWorkItemId, id }) => {
      try {
        if (action === "create") {
          if (!project) return { content: [{ type: "text", text: "project is required for create" }], isError: true };
          if (!title) return { content: [{ type: "text", text: "title is required for create" }], isError: true };

          const connection = await connectionProvider();
          const witClient = await connection.getWorkItemTrackingApi();

          let stepsXml;
          if (steps) {
            stepsXml = convertStepsToXml(steps);
          }

          const patchDocument: any[] = [];

          patchDocument.push({ op: "add", path: "/fields/System.Title", value: title });

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
            patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: stepsXml });
          }

          if (priority) {
            patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: priority });
          }

          if (areaPath) {
            patchDocument.push({ op: "add", path: "/fields/System.AreaPath", value: areaPath });
          }

          if (iterationPath) {
            patchDocument.push({ op: "add", path: "/fields/System.IterationPath", value: iterationPath });
          }

          const workItem = await witClient.createWorkItem({}, patchDocument, project, "Test Case");

          return {
            content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
          };
        } else {
          if (!id) return { content: [{ type: "text", text: "id is required for update_steps" }], isError: true };
          if (!steps) return { content: [{ type: "text", text: "steps is required for update_steps" }], isError: true };

          const connection = await connectionProvider();
          const witClient = await connection.getWorkItemTrackingApi();

          const stepsXml = convertStepsToXml(steps);
          const patchDocument: any[] = [];

          patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: stepsXml });

          const workItem = await witClient.updateWorkItem({}, patchDocument, id);

          return {
            content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }],
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const prefix = action === "create" ? "Error creating test case" : "Error updating test case steps";
        return {
          content: [{ type: "text", text: `${prefix}: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

/*
 * Format step content by converting Markdown markers to HTML and wrapping in the ADO rich text
 * envelope. The entire HTML string is then XML-escaped for storage in the parameterizedString
 * element, which is the format Azure DevOps expects for rendered step content.
 */
function formatStepContent(text: string): string {
  const htmlContent = text
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');

  return escapeXml(`${htmlContent}`);
}

/*
 * Helper function to convert steps text to XML format required
 */
function convertStepsToXml(steps: string): string {
  const stepsLines = steps.split("\n").filter((line) => line.trim() !== "");

  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    const [stepPart, expectedPart] = stepLine.split("|").map((s) => s.trim());
    const stepMatch = stepPart.match(/^(\d+)\.\s*(.+)$/);
    const stepText = stepMatch ? stepMatch[2] : stepPart;
    const expectedText = expectedPart || "Verify step completes successfully";

    xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${formatStepContent(stepText)}</parameterizedString>
                    <parameterizedString isformatted="true">${formatStepContent(expectedText)}</parameterizedString>
                </step>`;
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
      /* istanbul ignore next */
      default:
        return c;
    }
  });
}

export { TEST_PLAN_TOOLS, configureTestPlanTools };
