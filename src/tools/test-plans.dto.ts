// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for the testplan_test_plan_write, testplan_test_suite_write and
// testplan_test_case_write tools.
//
// Each action's inputs are declared once as a Zod "raw shape". The shapes are
// the single source of truth: each tool's input schema is composed from them,
// and the TypeScript argument types are derived via `z.infer` (no hand-written,
// drift-prone duplicate types). These types are safe to export — they are
// compile-time only and erased at runtime, so they have no effect on the MCP
// protocol or a local server.
// ─────────────────────────────────────────────────────────────────────────────

/** Project field shared by the test plan and test suite write actions. */
const projectShape = {
  project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
};

/** testplan_test_plan_write: create inputs. */
export const createTestPlanShape = {
  ...projectShape,
  name: z.string().optional().describe("The name of the test plan. Required for: create."),
  iteration: z.string().optional().describe("The iteration path for the test plan. Required for: create."),
  description: z.string().optional().describe("The description of the test plan. Used for: create."),
  startDate: z.string().optional().describe("The start date of the test plan. Used for: create."),
  endDate: z.string().optional().describe("The end date of the test plan. Used for: create."),
  areaPath: z.string().optional().describe("The area path for the test plan. Used for: create."),
};

/** The composed input shape for the grouped `testplan_test_plan_write` tool. */
export const testPlanWriteShape = {
  action: z.enum(["create"]).describe("The action to perform. Options: create (create a new test plan)."),
  ...createTestPlanShape,
};

/** testplan_test_suite_write: create inputs. */
export const createTestSuiteShape = {
  ...projectShape,
  planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: create, add_test_cases."),
  parentSuiteId: z.coerce.number().min(1).optional().describe("ID of the parent suite under which the new suite will be created. Required for: create."),
  name: z.string().optional().describe("Name of the child test suite. Required for: create."),
};

/** testplan_test_suite_write: add_test_cases inputs. */
export const addTestCasesToSuiteShape = {
  ...projectShape,
  planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: create, add_test_cases."),
  suiteId: z.coerce.number().min(1).optional().describe("The ID of the test suite. Required for: add_test_cases."),
  testCaseIds: z.string().or(z.array(z.string())).optional().describe("The ID(s) of the test case(s) to add. Required for: add_test_cases."),
};

/** The composed input shape for the grouped `testplan_test_suite_write` tool. */
export const testSuiteWriteShape = {
  action: z.enum(["create", "add_test_cases"]).describe("The action to perform. Options: create (create a new test suite in a test plan), add_test_cases (add existing test cases to a test suite)."),
  ...createTestSuiteShape,
  ...addTestCasesToSuiteShape,
};

const testCaseStepsField = z
  .string()
  .optional()
  .describe(
    "The steps for the test case. Format each step as '1. Step one|Expected result one\n2. Step two|Expected result two'. Use '|' as the delimiter between step and expected result. Required for: update_steps. Used for: create."
  );

/** testplan_test_case_write: create inputs. */
export const createTestCaseShape = {
  project: z.string().optional().describe("The unique identifier (ID or name) of the Azure DevOps project. Required for: create."),
  title: z.string().optional().describe("The title of the test case. Required for: create."),
  priority: z.coerce.number().optional().describe("The priority of the test case. Used for: create."),
  areaPath: z.string().optional().describe("The area path for the test case. Used for: create."),
  iterationPath: z.string().optional().describe("The iteration path for the test case. Used for: create."),
  testsWorkItemId: z.coerce.number().min(1).optional().describe("Work item ID to set as a Microsoft.VSTS.Common.TestedBy-Reverse link. Used for: create."),
  steps: testCaseStepsField,
};

/** testplan_test_case_write: update_steps inputs. */
export const updateTestCaseStepsShape = {
  id: z.coerce.number().min(1).optional().describe("The ID of the test case work item to update. Required for: update_steps."),
  steps: testCaseStepsField,
};

/** The composed input shape for the grouped `testplan_test_case_write` tool. */
export const testCaseWriteShape = {
  action: z.enum(["create", "update_steps"]).describe("The action to perform. Options: create (create a new test case work item), update_steps (update steps on an existing test case)."),
  ...createTestCaseShape,
  ...updateTestCaseStepsShape,
};

// Per-action schemas + inferred argument DTOs. `z.infer` keeps these types in
// lockstep with the schemas above.
export const createTestPlanSchema = z.object(createTestPlanShape);
export const testPlanWriteSchema = z.object(testPlanWriteShape);
export const createTestSuiteSchema = z.object(createTestSuiteShape);
export const addTestCasesToSuiteSchema = z.object(addTestCasesToSuiteShape);
export const testSuiteWriteSchema = z.object(testSuiteWriteShape);
export const createTestCaseSchema = z.object(createTestCaseShape);
export const updateTestCaseStepsSchema = z.object(updateTestCaseStepsShape);
export const testCaseWriteSchema = z.object(testCaseWriteShape);

export type CreateTestPlanArgs = z.infer<typeof createTestPlanSchema>;
export type TestPlanWriteArgs = z.infer<typeof testPlanWriteSchema>;
export type CreateTestSuiteArgs = z.infer<typeof createTestSuiteSchema>;
export type AddTestCasesToSuiteArgs = z.infer<typeof addTestCasesToSuiteSchema>;
export type TestSuiteWriteArgs = z.infer<typeof testSuiteWriteSchema>;
export type CreateTestCaseArgs = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseStepsArgs = z.infer<typeof updateTestCaseStepsSchema>;
export type TestCaseWriteArgs = z.infer<typeof testCaseWriteSchema>;
