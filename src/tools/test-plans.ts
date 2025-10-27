// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TestPlanCreateParams } from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { z } from "zod";
import { parseTestCaseFile, validateParsedData, FileInput } from "../utils/csv-file-parser.js";
import { mapTestCasesFromData, mapTestCasesFromDataDynamic, generatePreview, mapTestCasesUsingProvidedMapping } from "../utils/test-case-mapper.js";
import { executeBulkTestCaseOperations } from "../utils/bulk-test-case-creation.js";

const Test_Plan_Tools = {
  create_test_plan: "testplan_create_test_plan",
  create_test_case: "testplan_create_test_case",
  update_test_case_steps: "testplan_update_test_case_steps",
  add_test_cases_to_suite: "testplan_add_test_cases_to_suite",
  test_results_from_build_id: "testplan_show_test_results_from_build_id",
  list_test_cases: "testplan_list_test_cases",
  list_test_plans: "testplan_list_test_plans",
  create_test_suite: "testplan_create_test_suite",
  bulk_import_test_cases: "testplan_bulk_import_test_cases",
  suggest_field_mapping: "testplan_suggest_field_mapping",
};

function configureTestPlanTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    Test_Plan_Tools.list_test_plans,
    "Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      filterActivePlans: z.boolean().default(true).describe("Filter to include only active test plans. Defaults to true."),
      includePlanDetails: z.boolean().default(false).describe("Include detailed information about each test plan."),
      continuationToken: z.string().optional().describe("Token to continue fetching test plans from a previous request."),
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
  );

  /*
    Suggest unified field mapping (CSV headers -> ADO work item fields) without segregating core/custom fields.
    This is a preview helper: Clients can review and optionally adjust the mapping, then pass the final
    mapping to 'testplan_bulk_import_test_cases' via the 'fieldMapping' parameter.
  */
  server.tool(
    Test_Plan_Tools.suggest_field_mapping,
    "Suggest a mapping between CSV headers and Azure DevOps Test Case work item fields (includes custom fields).",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      fileContent: z.string().describe("The base64 encoded content of the CSV file (first row used for headers)."),
      fileName: z.string().describe("The name of the file being uploaded (used to determine file type)."),
      workItemType: z.string().default('Test Case').describe("Work item type for which to fetch fields. Defaults to 'Test Case'."),
    },
    async ({ project, fileContent, fileName, workItemType }) => {
      try {
        const fileInput: FileInput = { content: fileContent, filename: fileName };
        const parseResult = await parseTestCaseFile(fileInput);
        const validated = validateParsedData(parseResult);
        if (validated.errors.length > 0) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, stage: 'file_parsing', errors: validated.errors, warnings: validated.warnings }, null, 2) }]
          };
        }

        // Fetch work item type fields using cached approach
        const connection = await connectionProvider();
        const { getCachedFieldMappings } = await import('../utils/dynamic-work-item-field-fetcher.js');
        const dynamicFields = await getCachedFieldMappings(connection, project, workItemType);
        const fields = dynamicFields.map(f => ({ referenceName: f.referenceName, name: f.field }));

        // Dynamic suggestion using new unified mapper
        const { suggestUnifiedFieldMapping } = await import('../utils/test-case-mapper.js');
        const suggestion = suggestUnifiedFieldMapping(validated.headers, fields);

        // Ensure System.Title is suggested if any header resembles it (fallback)
        const hasTitle = Object.values(suggestion.suggestedMapping).some(ref => ref.toLowerCase() === 'system.title');
        if (!hasTitle) {
          const titleLikeHeader = validated.headers.find(h => /title|name|summary|test case/i.test(h));
          if (titleLikeHeader) {
            suggestion.suggestions.push({ header: titleLikeHeader, suggestedReferenceName: 'System.Title', confidence: 60, reason: 'Fallback title heuristic' });
            suggestion.suggestedMapping[titleLikeHeader] = 'System.Title';
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            stage: 'suggestion',
            headers: suggestion.headers,
            suggestedMapping: suggestion.suggestedMapping,
            suggestions: suggestion.suggestions,
            unmappedHeaders: suggestion.unmappedHeaders,
            fieldCount: fields.length,
            note: 'Review suggestedMapping; adjust as needed and pass to testplan_bulk_import_test_cases.fieldMapping to proceed.'
          }, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, stage: 'fatal_error', error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }]
        };
      }
    }
  );

  /*
    Create Test Plan - CREATE
  */
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
  );

  server.tool(
    Test_Plan_Tools.create_test_suite,
    "Creates a new test suite in a test plan.",
    {
      project: z.string().describe("Project ID or project name"),
      planId: z.number().describe("ID of the test plan that contains the suites"),
      parentSuiteId: z.number().describe("ID of the parent suite under which the new suite will be created, if not given by user this can be id of a root suite of the test plan"),
      name: z.string().describe("Name of the child test suite"),
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
  );

  server.tool(
    Test_Plan_Tools.add_test_cases_to_suite,
    "Adds existing test cases to a test suite.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      planId: z.number().describe("The ID of the test plan."),
      suiteId: z.number().describe("The ID of the test suite."),
      testCaseIds: z.string().or(z.array(z.string())).describe("The ID(s) of the test case(s) to add. "),
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
  );

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
  );

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
  );

  server.tool(
    Test_Plan_Tools.list_test_cases,
    "Gets a list of test cases in the test plan.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      planid: z.number().describe("The ID of the test plan."),
      suiteid: z.number().describe("The ID of the test suite."),
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

  server.tool(
    Test_Plan_Tools.test_results_from_build_id,
    "Gets a list of test results for a given project and build ID.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      buildid: z.number().describe("The ID of the build."),
    },
    async ({ project, buildid }) => {
      const connection = await connectionProvider();
      const coreApi = await connection.getTestResultsApi();
      const testResults = await coreApi.getTestResultDetailsForBuild(project, buildid);

      return {
        content: [{ type: "text", text: JSON.stringify(testResults, null, 2) }],
      };
    }
  );

  /*
    Bulk Import Test Cases from CSV
  */
  server.tool(
    Test_Plan_Tools.bulk_import_test_cases,
  "Bulk import test cases from CSV (.csv) files. Supports both creating new test cases and updating existing ones. Intelligently maps column headers to test case fields. Excel formats are not supported.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      planId: z.number().optional().describe("The ID of the test plan (required if adding to suite)."),
      suiteId: z.number().optional().describe("The ID of the test suite (required if adding to suite)."),
      fileContent: z.string().describe("The base64 encoded content of the Excel or CSV file."),
      fileName: z.string().describe("The name of the file being uploaded (used to determine file type)."),
      previewOnly: z.boolean().default(false).describe("If true, only shows a preview without creating/updating test cases."),
      addToSuite: z.boolean().default(false).describe("Whether to add the test cases to the specified test suite after creation/update."),
      batchSize: z.number().default(10).describe("Number of test cases to process in each batch (1-50)."),
      ignoreIds: z.boolean().default(false).describe("If true, ignores any ID/TestCaseId columns and forces creation of new test cases."),
      fieldMapping: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Optional explicit mapping from CSV header to Azure DevOps field reference name (e.g. { 'Title': 'System.Title', 'Custom.MyRiskLevel': 'Custom.MyRiskLevel' }). Overrides automatic header mapping."
        ),
    },
  async ({ project, planId, suiteId, fileContent, fileName, previewOnly, addToSuite, batchSize, ignoreIds, fieldMapping }) => {
      try {
        // Validate inputs
        if (addToSuite && (!planId || !suiteId)) {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                error: "planId and suiteId are required when addToSuite is true"
              }, null, 2)
            }]
          };
        }

        if (batchSize < 1 || batchSize > 50) {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                error: "batchSize must be between 1 and 50"
              }, null, 2)
            }]
          };
        }

        // Parse the uploaded file
        const fileInput: FileInput = {
          content: fileContent,
          filename: fileName
        };

        const parseResult = await parseTestCaseFile(fileInput);
        const validatedResult = validateParsedData(parseResult);

        if (validatedResult.errors.length > 0) {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                success: false,
                stage: "file_parsing",
                errors: validatedResult.errors,
                warnings: validatedResult.warnings
              }, null, 2)
            }]
          };
        }

        // Get connection for dynamic field mapping
        const connection = await connectionProvider();

        // Map the data to test case format (dynamic mapping if provided)
        const mappingResult = fieldMapping
          ? mapTestCasesUsingProvidedMapping(validatedResult.data, validatedResult.headers, fieldMapping)
          : await mapTestCasesFromDataDynamic(validatedResult.data, validatedResult.headers, connection, project);

        // Force pure create mode by removing IDs
        if (ignoreIds) {
          mappingResult.mappedTestCases.forEach(tc => { if (tc.id !== undefined) { delete tc.id; } });
          mappingResult.warnings.push("ignoreIds=true: All IDs were removed; all rows will be created as new test cases.");
        }

        const headersLower = validatedResult.headers.map(h => h.toLowerCase());
        const hasStepsHeader = headersLower.some(h => h.includes("steps"));
        if (!hasStepsHeader) {
          const stepActionHeader = validatedResult.headers.find(h => h.toLowerCase().includes("step action"));
          const stepExpectedHeader = validatedResult.headers.find(h => h.toLowerCase().includes("step expected"));
          if (stepActionHeader || stepExpectedHeader) {
            let synthesizedCount = 0;
            mappingResult.mappedTestCases.forEach(tc => {
              if (!tc.steps) {
                const original = tc.originalData;
                const actionVal = stepActionHeader ? (original[stepActionHeader] as string | undefined)?.trim() : undefined;
                const expectedVal = stepExpectedHeader ? (original[stepExpectedHeader] as string | undefined)?.trim() : undefined;
                if ((actionVal && actionVal.length > 0) || (expectedVal && expectedVal.length > 0)) {
                  const safeAction = actionVal ?? "";
                  const safeExpected = expectedVal ?? "";
                  tc.steps = `1. ${safeAction}|${safeExpected}`;
                  synthesizedCount++;
                }
              }
            });
          }
        }

        if (mappingResult.errors.length > 0 && mappingResult.mappedTestCases.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                success: false,
                stage: "field_mapping",
                errors: mappingResult.errors,
                warnings: mappingResult.warnings,
                stats: mappingResult.stats
              }, null, 2)
            }]
          };
        }

        // Generate preview
      const preview = generatePreview(mappingResult);

        if (previewOnly) {
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                success: true,
                stage: "preview",
                preview: preview,
                stats: mappingResult.stats,
                errors: mappingResult.errors,
                warnings: mappingResult.warnings,
                mappedTestCases: mappingResult.mappedTestCases.map(tc => ({
                  rowIndex: tc.rowIndex,
                  title: tc.title,
                  id: tc.id,
                  hasSteps: !!tc.steps,
                  priority: tc.priority,
                  areaPath: tc.areaPath
                }))
              }, null, 2)
            }]
          };
        }

        // Execute bulk operations
        const bulkResult = await executeBulkTestCaseOperations(
          mappingResult.mappedTestCases,
          {
            project,
            planId,
            suiteId,
            batchSize,
            addToSuite
          },
          () => connectionProvider()
        );

        // Combine all results
        const finalResult = {
          success: bulkResult.success,
          stage: "completed",
          preview: preview,
          bulkOperationResult: {
            summary: bulkResult.summary,
            created: bulkResult.created,
            updated: bulkResult.updated,
            errors: bulkResult.errors
          },
          fileParsingWarnings: validatedResult.warnings,
          mappingWarnings: mappingResult.warnings,
          mappingErrors: mappingResult.errors,
          operationErrors: bulkResult.errors
        };

        return {
          content: [{ type: "text", text: JSON.stringify(finalResult, null, 2) }]
        };

      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: false,
              stage: "fatal_error",
              error: error instanceof Error ? error.message : "Unknown error occurred",
              message: "An unexpected error occurred during bulk import. Please check your file format and try again."
            }, null, 2)
          }]
        };
      }
    }
  );
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
