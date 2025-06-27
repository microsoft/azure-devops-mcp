// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { TestPlanCreateParams } from "azure-devops-node-api/interfaces/TestPlanInterfaces.js";
import { RunCreateModel } from "azure-devops-node-api/interfaces/TestInterfaces.js";
import { ReleaseStartMetadata } from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";
import { z } from "zod";

const Test_Plan_Tools = {
  create_test_plan: "testplan_create_test_plan",
  create_test_case: "testplan_create_test_case",
  add_test_cases_to_suite: "testplan_add_test_cases_to_suite",
  test_results_from_build_id: "testplan_show_test_results_from_build_id",
  list_test_cases: "testplan_list_test_cases",
  list_test_plans: "testplan_list_test_plans",
  run_test_points_with_options: "testplan_run_test_points_with_options",
};

function configureTestPlanTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  /*
    LIST OF TEST PLANS
    get list of test plans by project
  */
  server.tool(
    Test_Plan_Tools.list_test_plans,
    "Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.",
    {
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      filterActivePlans: z.boolean().default(true).describe("Filter to include only active test plans. Defaults to true."),
      includePlanDetails: z.boolean().default(false).describe("Include detailed information about each test plan."),
      continuationToken: z.string().optional().describe("Token to continue fetching test plans from a previous request."),
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
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project where the test plan will be created."),
      name: z.string().describe("The name of the test plan to be created."),
      iteration: z.string().describe("The iteration path for the test plan"),
      description: z.string().optional().describe("The description of the test plan"),
      startDate: z.string().optional().describe("The start date of the test plan"),
      endDate: z.string().optional().describe("The end date of the test plan"),
      areaPath: z.string().optional().describe("The area path for the test plan"),
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
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      planId: z.number().describe("The ID of the test plan."),
      suiteId: z.number().describe("The ID of the test suite."),
      testCaseIds: z.string().or(z.array(z.string())).describe("The ID(s) of the test case(s) to add. "),
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
      project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
      title: z.string().describe("The title of the test case."),
      steps: z.string().optional().describe("The steps to reproduce the test case. Make sure to format each step as '1. Step one\\n2. Step two' etc."),
      priority: z.number().optional().describe("The priority of the test case."),
      areaPath: z.string().optional().describe("The area path for the test case."),
      iterationPath: z.string().optional().describe("The iteration path for the test case."),
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

  /*
    Gets a list of test results for a given project and build ID
  */
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
      const testResults = await coreApi.getTestResultDetailsForBuild(
        project,
        buildid
      );

      return {
        content: [{ type: "text", text: JSON.stringify(testResults, null, 2) }],
      };
    }
  );

  /*
    Runs selected test points from a test plan using an automated release pipeline stage.
  */
  server.tool(
    Test_Plan_Tools.run_test_points_with_options,
    "Runs selected test points from a test plan using an automated release pipeline stage.",
    {
      project: z.string().describe("Azure DevOps project ID or name."),
      planId: z.number().describe("Test plan ID."),
      testPointIds: z.array(z.number()).describe("List of test point IDs to run.")
    },
    async ({
      project,
      planId,
      testPointIds
    }) => {
      const connection = await connectionProvider();
      const testPlanApi = await connection.getTestPlanApi();
      const buildApi = await connection.getBuildApi();
      const releaseApi = await connection.getReleaseApi();
      const testApi = await connection.getTestApi();

      // Retrieve the test plan configuration
      const testPlanDefinition = await testPlanApi.getTestPlanById(project, planId);
      if (!testPlanDefinition) throw new Error("Test plan not found.");

      // Extract build definition ID from test plan - required for getting build artifacts
      const buildId = testPlanDefinition.buildDefinition?.id;
      if (!buildId) throw new Error("No build ID found in test plan definition.");

      // Get the latest successful build from the build definition to use as artifact source
      const buildDefinition = await buildApi.getLatestBuild(project, buildId.toString());
      const artifactBuildId = buildDefinition?.id;
      if (!artifactBuildId) throw new Error("No latest build ID found in test plan definition.");

      // Extract release definition ID - required for creating the release pipeline
      const releaseDefinitionId = testPlanDefinition.releaseEnvironmentDefinition?.definitionId;
      if (!releaseDefinitionId) throw new Error("No release definition ID found in test plan definition.");

      // Step 1: Get release definition and extract alias and stage name
      const releaseDefinition = await releaseApi.getReleaseDefinition(project, releaseDefinitionId);
      const artifact = releaseDefinition.artifacts?.[0];
      if (!artifact?.alias) throw new Error("No artifact alias found in release definition.");

      const releaseStageName = releaseDefinition?.environments?.[0]?.name;
      if (!releaseStageName) throw new Error("No stage name found in release definition.");

      const alias = artifact.alias;

      // Step 2: Create the test run
      const testRunPayload : RunCreateModel = {
        name: `RunWithOptions ${new Date().toLocaleString()}`,
        automated: true,
        plan: { id: planId.toString() },
        pointIds: testPointIds,
        filter: {
          sourceFilter: "*.dll",
          testCaseFilter: ""
        },
        dtlTestEnvironment: { id: "vstfs://dummy" },
        state: "NotStarted",
      };

      const testRun = await testApi.createTestRun(testRunPayload, project);
      if (!testRun?.id) throw new Error("Failed to create test run.");

      // Step 3: Create a release
      const releasePayload : ReleaseStartMetadata = {
        definitionId: releaseDefinitionId,
        artifacts: [{
          alias,
          instanceReference: {
            id: artifactBuildId.toString(),
            name: `Build-${artifactBuildId}`
          }
        }],
        reason: 1,
        description: "Triggered via MCP tool",
        isDraft: false,
        manualEnvironments: [releaseStageName],
        variables: {
          "test.RunId": {
            value: testRun.id.toString(),
            isSecret: false,
            allowOverride: true
          }
        },
      };

      const release = await releaseApi.createRelease(releasePayload, project);
      if (!release?.id) throw new Error("Failed to create release.");

      const releaseEnv = release.environments?.find(env => env.name === releaseStageName);
      if (!releaseEnv?.id) throw new Error("Could not extract release environment ID from newly created release.");

      // Step 4: Trigger the release environment to start test execution
      try {
        await releaseApi.updateReleaseEnvironment(
          {
            status: 2, // InProgress
            comment: "Triggered via MCP tool with runId"
          },
          project,
          release.id,
          releaseEnv.id
        );
      } catch (error) {
        throw new Error("Failed to update release environment status.");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(testRun, null, 2)
          }
        ]
      };
    }
  );

}

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
