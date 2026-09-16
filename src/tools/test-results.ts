// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { ResultDetails, TestOutcome } from "azure-devops-node-api/interfaces/TestInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { optionalProject } from "../shared/common-params.js";

const TEST_RESULTS_TOOLS = {
  list_test_runs: "testresults_list_test_runs",
  get_test_run: "testresults_get_test_run",
  list_test_results: "testresults_list_test_results",
  get_test_result: "testresults_get_test_result",
};

const RESULT_DETAILS_MAP: Record<string, ResultDetails> = {
  none: ResultDetails.None,
  iterations: ResultDetails.Iterations,
  workItems: ResultDetails.WorkItems,
  subResults: ResultDetails.SubResults,
  point: ResultDetails.Point,
};

const TEST_OUTCOME_MAP: Record<string, TestOutcome> = {
  Passed: TestOutcome.Passed,
  Failed: TestOutcome.Failed,
  Inconclusive: TestOutcome.Inconclusive,
  Timeout: TestOutcome.Timeout,
  Aborted: TestOutcome.Aborted,
  Blocked: TestOutcome.Blocked,
  NotExecuted: TestOutcome.NotExecuted,
  Warning: TestOutcome.Warning,
  Error: TestOutcome.Error,
  NotApplicable: TestOutcome.NotApplicable,
  InProgress: TestOutcome.InProgress,
  NotImpacted: TestOutcome.NotImpacted,
};

function configureTestResultsTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  const resolveProject = async (connection: WebApi, project: string | undefined) => {
    if (project) return { project };
    const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
    if ("response" in result) return result;
    return { project: result.resolved };
  };

  const projectField = optionalProject;

  registerTool(
    server,
    TEST_RESULTS_TOOLS.list_test_runs,
    "List test runs in a project, optionally filtered by test plan, build, or automation status. A test run is one execution of a set of tests. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      planId: z.coerce.number().optional().describe("Filter to runs belonging to this test plan ID."),
      buildUri: z.string().optional().describe("Filter to runs for this build URI (e.g. 'vstfs:///Build/Build/1234')."),
      automated: z.boolean().optional().describe("Filter by automation: true for automated runs, false for manual runs."),
      includeRunDetails: z.boolean().optional().describe("Include detailed run statistics in each result."),
      top: z.coerce.number().default(50).describe("Maximum number of runs to return. Defaults to 50."),
      skip: z.coerce.number().optional().describe("Number of runs to skip (for pagination)."),
    },
    async ({ project, planId, buildUri, automated, includeRunDetails, top, skip }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const runs = await testApi.getTestRuns(ctx.project, buildUri, undefined, undefined, planId, includeRunDetails, automated, skip, top);

        return { content: [{ type: "text", text: JSON.stringify(runs, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing test runs: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_test_run,
    "Get a single test run by its ID, including its overall statistics. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run."),
      includeDetails: z.boolean().optional().default(true).describe("Include detailed run statistics. Defaults to true."),
    },
    async ({ project, runId, includeDetails = true }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const run = await testApi.getTestRunById(ctx.project, runId, includeDetails);

        if (!run) {
          return { content: [{ type: "text", text: `Test run ${runId} not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(run, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching test run: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.list_test_results,
    "List the individual test case results for a test run, optionally filtered by outcome. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run to list results for."),
      outcomes: z
        .array(z.enum(["Passed", "Failed", "Inconclusive", "Timeout", "Aborted", "Blocked", "NotExecuted", "Warning", "Error", "NotApplicable", "InProgress", "NotImpacted"]))
        .optional()
        .describe("Filter results to these outcomes (e.g. ['Failed']). If omitted, all outcomes are returned."),
      detailsToInclude: z.enum(["none", "iterations", "workItems", "subResults", "point"]).optional().describe("Additional detail to include with each result. Defaults to 'none'."),
      top: z.coerce.number().default(100).describe("Maximum number of results to return. Defaults to 100."),
      skip: z.coerce.number().optional().describe("Number of results to skip (for pagination)."),
    },
    async ({ project, runId, outcomes, detailsToInclude, top, skip }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const mappedOutcomes = outcomes?.map((outcome) => TEST_OUTCOME_MAP[outcome]);
        const mappedDetails = detailsToInclude ? RESULT_DETAILS_MAP[detailsToInclude] : undefined;
        const results = await testApi.getTestResults(ctx.project, runId, mappedDetails, skip, top, mappedOutcomes);

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing test results: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_test_result,
    "Get a single test case result by its ID within a test run. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run that contains the result."),
      testCaseResultId: z.coerce.number().describe("The ID of the test case result."),
      detailsToInclude: z.enum(["none", "iterations", "workItems", "subResults", "point"]).optional().describe("Additional detail to include with the result. Defaults to 'none'."),
    },
    async ({ project, runId, testCaseResultId, detailsToInclude }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const mappedDetails = detailsToInclude ? RESULT_DETAILS_MAP[detailsToInclude] : undefined;
        const result = await testApi.getTestResultById(ctx.project, runId, testCaseResultId, mappedDetails);

        if (!result) {
          return { content: [{ type: "text", text: `Test result ${testCaseResultId} not found in run ${runId}` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching test result: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { TEST_RESULTS_TOOLS, configureTestResultsTools };
