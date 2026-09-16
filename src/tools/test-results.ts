// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { CoverageQueryFlags, ResultDetails, TestOutcome } from "azure-devops-node-api/interfaces/TestInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { extractAdoStreamError } from "../utils.js";
import { optionalProject } from "../shared/common-params.js";

const TEST_RESULTS_TOOLS = {
  list_test_runs: "testresults_list_test_runs",
  get_test_run: "testresults_get_test_run",
  list_test_results: "testresults_list_test_results",
  get_test_result: "testresults_get_test_result",
  get_build_code_coverage: "testresults_get_build_code_coverage",
  get_code_coverage_summary: "testresults_get_code_coverage_summary",
  get_run_code_coverage: "testresults_get_run_code_coverage",
  list_run_attachments: "testresults_list_run_attachments",
  list_result_attachments: "testresults_list_result_attachments",
  get_attachment_content: "testresults_get_attachment_content",
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

  const failed = (action: string, error: unknown) => ({
    content: [{ type: "text" as const, text: `Error ${action}: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });
  const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

  // The coverage APIs take a bitmask rather than named options.
  const coverageFlags = (modules: boolean, functions: boolean, blockData: boolean) =>
    (modules ? CoverageQueryFlags.Modules : 0) | (functions ? CoverageQueryFlags.Functions : 0) | (blockData ? CoverageQueryFlags.BlockData : 0);

  const coverageDetailFields = {
    includeModules: z.boolean().default(true).describe("Include per-module coverage."),
    includeFunctions: z.boolean().default(false).describe("Include per-function coverage. Large on real builds."),
    includeBlockData: z.boolean().default(false).describe("Include raw block coverage data. Very large; only useful when computing coverage yourself."),
  };

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_code_coverage_summary,
    "Get the code coverage summary for a build — the aggregate line and block totals. Pass a second build to get the delta between them, which is what a coverage gate compares.",
    {
      project: projectField,
      buildId: z.coerce.number().describe("The ID of the build."),
      deltaBuildId: z.coerce.number().optional().describe("Compare against this build, e.g. the target branch's last build."),
    },
    async ({ project, buildId, deltaBuildId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const summary = await testApi.getCodeCoverageSummary(ctx.project, buildId, deltaBuildId);
        return ok(summary);
      } catch (error) {
        return failed(`fetching the coverage summary for build ${buildId}`, error);
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_build_code_coverage,
    "Get the code coverage a build produced, broken down by module. Use testresults_get_code_coverage_summary for just the totals.",
    {
      project: projectField,
      buildId: z.coerce.number().describe("The ID of the build."),
      ...coverageDetailFields,
    },
    async ({ project, buildId, includeModules, includeFunctions, includeBlockData }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const coverage = await testApi.getBuildCodeCoverage(ctx.project, buildId, coverageFlags(includeModules, includeFunctions, includeBlockData));
        return ok(coverage);
      } catch (error) {
        return failed(`fetching code coverage for build ${buildId}`, error);
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_run_code_coverage,
    "Get the code coverage attributed to one test run.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run."),
      ...coverageDetailFields,
    },
    async ({ project, runId, includeModules, includeFunctions, includeBlockData }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const coverage = await testApi.getTestRunCodeCoverage(ctx.project, runId, coverageFlags(includeModules, includeFunctions, includeBlockData));
        return ok(coverage);
      } catch (error) {
        return failed(`fetching code coverage for test run ${runId}`, error);
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.list_run_attachments,
    "List the files attached to a test run — console logs, the .trx or similar result file, diagnostics. Returns metadata; fetch one with testresults_get_attachment_content.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run."),
    },
    async ({ project, runId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const attachments = await testApi.getTestRunAttachments(ctx.project, runId);
        return ok(attachments);
      } catch (error) {
        return failed(`listing attachments of test run ${runId}`, error);
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.list_result_attachments,
    "List the files attached to one test result — usually the screenshots and logs captured when that test failed.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run."),
      testCaseResultId: z.coerce.number().describe("The ID of the test case result within the run."),
    },
    async ({ project, runId, testCaseResultId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const attachments = await testApi.getTestResultAttachments(ctx.project, runId, testCaseResultId);
        return ok(attachments);
      } catch (error) {
        return failed(`listing attachments of test result ${testCaseResultId}`, error);
      }
    }
  );

  registerTool(
    server,
    TEST_RESULTS_TOOLS.get_attachment_content,
    "Read the content of a test attachment. Meant for text — console output, stack traces, .trx files. Binary attachments such as screenshots or video are not returned; use the attachment's URL from the listing instead.",
    {
      project: projectField,
      runId: z.coerce.number().describe("The ID of the test run."),
      attachmentId: z.coerce.number().describe("The ID of the attachment, from one of the list tools."),
      testCaseResultId: z.coerce.number().optional().describe("Set when the attachment belongs to a single test result rather than the run as a whole."),
      maxLength: z.coerce.number().default(100000).describe("Truncate the content to this many characters. Test logs are routinely megabytes."),
    },
    async ({ project, runId, attachmentId, testCaseResultId, maxLength }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const testApi = await connection.getTestApi();
        const stream =
          testCaseResultId === undefined
            ? await testApi.getTestRunAttachmentContent(ctx.project, runId, attachmentId)
            : await testApi.getTestResultAttachmentContent(ctx.project, runId, testCaseResultId, attachmentId);

        const buffer = await streamToBuffer(stream);

        // Screenshots and videos are the common case for result attachments;
        // decoding them as UTF-8 would hand the model megabytes of mojibake.
        if (looksBinary(buffer)) {
          return {
            content: [{ type: "text", text: `Attachment ${attachmentId} is binary (${buffer.length} bytes). Download it from the attachment URL reported by the list tools.` }],
            isError: true,
          };
        }

        const text = buffer.toString("utf8");
        const adoError = extractAdoStreamError(text);
        if (adoError) {
          return { content: [{ type: "text", text: `Error reading attachment ${attachmentId}: ${adoError}` }], isError: true };
        }

        const truncated = text.length > maxLength;
        // Attachment content is written by whatever the test run executed, so
        // it is untrusted input rather than instructions.
        return createExternalContentResponse(truncated ? `${text.slice(0, maxLength)}\n\n[truncated at ${maxLength} characters of ${text.length}]` : text, `test attachment ${attachmentId}`);
      } catch (error) {
        return failed(`reading attachment ${attachmentId}`, error);
      }
    }
  );
}

/** Collect a stream as bytes, so binary content can be recognised before decoding. */
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** A NUL byte in the first kilobyte means this is not text. */
function looksBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes(0);
}

export { TEST_RESULTS_TOOLS, configureTestResultsTools };
