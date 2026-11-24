// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TestPlanCreateParams } from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { TestCaseResult, TestOutcome, TestRun } from "azure-devops-node-api/interfaces/TestInterfaces.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiVersion } from "../utils.js";
import {
  testPlanWriteShape,
  testSuiteWriteShape,
  testCaseWriteShape,
  CreateTestPlanArgs,
  TestPlanWriteArgs,
  CreateTestSuiteArgs,
  AddTestCasesToSuiteArgs,
  TestSuiteWriteArgs,
  CreateTestCaseArgs,
  UpdateTestCaseStepsArgs,
  TestCaseWriteArgs,
} from "./test-plans.dto.js";

const errorResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

async function createTestPlan(args: CreateTestPlanArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  if (!args.name) return errorResult("name is required for create");
  if (!args.iteration) return errorResult("iteration is required for create");

  const connection = await connectionProvider();
  const testPlanApi = await connection.getTestPlanApi();
  const testPlanToCreate: TestPlanCreateParams = {
    name: args.name,
    iteration: args.iteration,
    description: args.description,
    startDate: args.startDate ? new Date(args.startDate) : undefined,
    endDate: args.endDate ? new Date(args.endDate) : undefined,
    areaPath: args.areaPath,
  };
  const createdTestPlan = await testPlanApi.createTestPlan(testPlanToCreate, args.project);

  return { content: [{ type: "text", text: JSON.stringify(createdTestPlan, null, 2) }] };
}

async function createTestSuite(args: CreateTestSuiteArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  if (!args.planId) return errorResult("planId is required for create");
  if (!args.parentSuiteId) return errorResult("parentSuiteId is required for create");
  if (!args.name) return errorResult("name is required for create");

  const maxRetries = 5;
  const baseDelay = 500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();
      const testSuiteToCreate = {
        name: args.name,
        parentSuite: { id: args.parentSuiteId, name: "" },
        suiteType: 2,
      };
      const createdTestSuite = await testPlanApi.createTestSuite(testSuiteToCreate, args.project, args.planId);

      return { content: [{ type: "text", text: JSON.stringify(createdTestSuite, null, 2) }] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const isConcurrencyError = errorMessage.includes("TF26071") || errorMessage.includes("got update") || errorMessage.includes("changed by someone else");

      if (!isConcurrencyError || attempt >= maxRetries) return errorResult(`Error creating test suite: ${errorMessage}`);

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /* istanbul ignore next */
  return errorResult("Error creating test suite: Maximum retries exceeded");
}

async function addTestCasesToSuite(args: AddTestCasesToSuiteArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  if (!args.planId) return errorResult("planId is required for add_test_cases");
  if (!args.suiteId) return errorResult("suiteId is required for add_test_cases");
  if (!args.testCaseIds) return errorResult("testCaseIds is required for add_test_cases");

  const connection = await connectionProvider();
  const testApi = await connection.getTestApi();
  const testCaseIdsString = Array.isArray(args.testCaseIds) ? args.testCaseIds.join(",") : args.testCaseIds;
  const addedTestCases = await testApi.addTestCasesToSuite(args.project, args.planId, args.suiteId, testCaseIdsString);

  return { content: [{ type: "text", text: JSON.stringify(addedTestCases, null, 2) }] };
}

async function createTestCase(args: CreateTestCaseArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  if (!args.project) return errorResult("project is required for create");
  if (!args.title) return errorResult("title is required for create");

  const connection = await connectionProvider();
  const witClient = await connection.getWorkItemTrackingApi();
  const patchDocument: any[] = [{ op: "add", path: "/fields/System.Title", value: args.title }];

  if (args.testsWorkItemId) {
    patchDocument.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "Microsoft.VSTS.Common.TestedBy-Reverse",
        url: `${connection.serverUrl}/${args.project}/_apis/wit/workItems/${args.testsWorkItemId}`,
      },
    });
  }
  if (args.steps) patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: convertStepsToXml(args.steps) });
  if (args.priority) patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: args.priority });
  if (args.areaPath) patchDocument.push({ op: "add", path: "/fields/System.AreaPath", value: args.areaPath });
  if (args.iterationPath) patchDocument.push({ op: "add", path: "/fields/System.IterationPath", value: args.iterationPath });

  const workItem = await witClient.createWorkItem({}, patchDocument, args.project, "Test Case");

  return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
}

async function updateTestCaseSteps(args: UpdateTestCaseStepsArgs, connectionProvider: () => Promise<WebApi>): Promise<CallToolResult> {
  if (!args.id) return errorResult("id is required for update_steps");
  if (!args.steps) return errorResult("steps is required for update_steps");

  const connection = await connectionProvider();
  const witClient = await connection.getWorkItemTrackingApi();
  const patchDocument = [{ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: convertStepsToXml(args.steps) }];
  const workItem = await witClient.updateWorkItem({}, patchDocument, args.id);

  return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
}

const testPlanWriteErrorPrefixes: Record<TestPlanWriteArgs["action"], string> = {
  create: "Error creating test plan: ",
};

const testSuiteWriteErrorPrefixes: Record<TestSuiteWriteArgs["action"], string> = {
  create: "Error creating test suite: ",
  add_test_cases: "Error adding test cases to suite: ",
};

const testCaseWriteErrorPrefixes: Record<TestCaseWriteArgs["action"], string> = {
  create: "Error creating test case: ",
  update_steps: "Error updating test case steps: ",
};

const TEST_RESULT_PAGE_SIZE = 1_000;
const TEST_RESULT_CONCURRENCY = 5;
const TEST_OUTCOMES = [
  "Unspecified",
  "None",
  "Passed",
  "Failed",
  "Inconclusive",
  "Timeout",
  "Aborted",
  "Blocked",
  "NotExecuted",
  "Warning",
  "Error",
  "NotApplicable",
  "Paused",
  "InProgress",
  "NotImpacted",
] as const;

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
    "Retrieve paginated test plan, suite, and case data for a project. Use the action parameter to specify the operation. When a response includes a continuationToken, pass it back with the same action and query parameters to fetch the next batch; null token indicates the last batch.",
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
        } else if (action === "list_cases") {
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
        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
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
      outcomes: z.array(z.enum(TEST_OUTCOMES)).optional().describe("Filter results by test outcome, e.g. ['Failed', 'Passed', 'Aborted']."),
    },
    async ({ project, buildid, outcomes }) => {
      try {
        const connection = await connectionProvider();
        const testResultsApi = await connection.getTestResultsApi();
        const buildUri = `vstfs:///Build/Build/${buildid}`;
        const testRuns: TestRun[] = [];

        for (let skip = 0; ; skip += TEST_RESULT_PAGE_SIZE) {
          const page = await testResultsApi.getTestRuns(project, buildUri, undefined, undefined, undefined, undefined, undefined, skip, TEST_RESULT_PAGE_SIZE);
          testRuns.push(...page);
          if (page.length < TEST_RESULT_PAGE_SIZE) {
            break;
          }
        }

        const outcomeFilter = outcomes?.map((outcome) => TestOutcome[outcome]);
        const runsWithIds = testRuns.filter((run): run is TestRun & { id: number } => run.id !== undefined);
        const allResults: { result: TestCaseResult; runId: number }[] = [];

        for (let index = 0; index < runsWithIds.length; index += TEST_RESULT_CONCURRENCY) {
          const batch = runsWithIds.slice(index, index + TEST_RESULT_CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(async (run) => {
              const results: { result: TestCaseResult; runId: number }[] = [];
              for (let skip = 0; ; skip += TEST_RESULT_PAGE_SIZE) {
                const page = await testResultsApi.getTestResults(project, run.id, undefined, skip, TEST_RESULT_PAGE_SIZE, outcomeFilter);
                results.push(...page.map((result) => ({ result, runId: run.id })));
                if (page.length < TEST_RESULT_PAGE_SIZE) {
                  break;
                }
              }
              return results;
            })
          );
          for (const results of batchResults) {
            allResults.push(...results);
          }
        }

        const formattedResults = allResults.map(({ result, runId }) => ({
          id: result.id,
          testCaseTitle: result.testCaseTitle,
          outcome: result.outcome,
          errorMessage: result.errorMessage,
          stackTrace: result.stackTrace,
          automatedTestName: result.automatedTestName,
          automatedTestStorage: result.automatedTestStorage,
          durationInMs: result.durationInMs,
          runId,
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
  server.tool(TEST_PLAN_TOOLS.testplan_test_plan_write, "Write operations for test plans. Use the action parameter to specify the operation.", testPlanWriteShape, async (args) => {
    try {
      switch (args.action) {
        case "create":
          return await createTestPlan(args, connectionProvider);
        default: {
          const unsupportedAction: never = args.action;
          return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(testPlanWriteErrorPrefixes).sort().join(", ")}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return errorResult(`${testPlanWriteErrorPrefixes[args.action]}${message}`);
    }
  });

  // ─── testplan_test_suite_write ────────────────────────────────────────────────────
  server.tool(TEST_PLAN_TOOLS.testplan_test_suite_write, "Write operations for test suites. Use the action parameter to specify the operation.", testSuiteWriteShape, async (args) => {
    try {
      switch (args.action) {
        case "create":
          return await createTestSuite(args, connectionProvider);
        case "add_test_cases":
          return await addTestCasesToSuite(args, connectionProvider);
        default: {
          const unsupportedAction: never = args.action;
          return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(testSuiteWriteErrorPrefixes).sort().join(", ")}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return errorResult(`${testSuiteWriteErrorPrefixes[args.action]}${message}`);
    }
  });

  // ─── testplan_test_case_write ─────────────────────────────────────────────────────
  server.tool(TEST_PLAN_TOOLS.testplan_test_case_write, "Write operations for test cases. Use the action parameter to specify the operation.", testCaseWriteShape, async (args) => {
    try {
      switch (args.action) {
        case "create":
          return await createTestCase(args, connectionProvider);
        case "update_steps":
          return await updateTestCaseSteps(args, connectionProvider);
        default: {
          const unsupportedAction: never = args.action;
          return errorResult(`Unknown action: ${unsupportedAction}. Supported actions: ${Object.keys(testCaseWriteErrorPrefixes).sort().join(", ")}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return errorResult(`${testCaseWriteErrorPrefixes[args.action]}${message}`);
    }
  });
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

export { TEST_PLAN_TOOLS, configureTestPlanTools, createTestPlan, createTestSuite, addTestCasesToSuite, createTestCase, updateTestCaseSteps };
export type { CreateTestPlanArgs, CreateTestSuiteArgs, AddTestCasesToSuiteArgs, CreateTestCaseArgs, UpdateTestCaseStepsArgs };
