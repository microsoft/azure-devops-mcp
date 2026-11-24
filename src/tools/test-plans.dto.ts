// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

const projectShape = {
  project: z.string().describe("The unique identifier (ID or name) of the Azure DevOps project."),
};

export const createTestPlanShape = {
  ...projectShape,
  name: z.string().optional().describe("The name of the test plan. Required for: create."),
  iteration: z.string().optional().describe("The iteration path for the test plan. Required for: create."),
  description: z.string().optional().describe("The description of the test plan. Used for: create."),
  startDate: z.string().optional().describe("The start date of the test plan. Used for: create."),
  endDate: z.string().optional().describe("The end date of the test plan. Used for: create."),
  areaPath: z.string().optional().describe("The area path for the test plan. Used for: create."),
};

export const testplanTestPlanWriteShape = {
  action: z.enum(["create"]).describe("The action to perform. Options: create (create a new test plan)."),
  ...createTestPlanShape,
};

export const createTestSuiteShape = {
  ...projectShape,
  planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: create, add_test_cases."),
  parentSuiteId: z.coerce.number().min(1).optional().describe("ID of the parent suite under which the new suite will be created. Required for: create."),
  name: z.string().optional().describe("Name of the child test suite. Required for: create."),
};

export const addTestCasesToSuiteShape = {
  ...projectShape,
  planId: z.coerce.number().min(1).optional().describe("The ID of the test plan. Required for: create, add_test_cases."),
  suiteId: z.coerce.number().min(1).optional().describe("The ID of the test suite. Required for: add_test_cases."),
  testCaseIds: z.string().or(z.array(z.string())).optional().describe("The ID(s) of the test case(s) to add. Required for: add_test_cases."),
};

export const testplanTestSuiteWriteShape = {
  action: z.enum(["create", "add_test_cases"]).describe("The action to perform. Options: create (create a new test suite in a test plan), add_test_cases (add existing test cases to a test suite)."),
  ...createTestSuiteShape,
  ...addTestCasesToSuiteShape,
};

export const createTestCaseShape = {
  project: z.string().optional().describe("The unique identifier (ID or name) of the Azure DevOps project. Required for: create."),
  title: z.string().optional().describe("The title of the test case. Required for: create."),
  priority: z.coerce.number().optional().describe("The priority of the test case. Used for: create."),
  areaPath: z.string().optional().describe("The area path for the test case. Used for: create."),
  iterationPath: z.string().optional().describe("The iteration path for the test case. Used for: create."),
  testsWorkItemId: z.coerce.number().min(1).optional().describe("Work item ID to set as a Microsoft.VSTS.Common.TestedBy-Reverse link. Used for: create."),
  steps: z
    .string()
    .optional()
    .describe(
      "The steps for the test case. Format each step as '1. Step one|Expected result one\n2. Step two|Expected result two'. Use '|' as the delimiter between step and expected result. Required for: update_steps. Used for: create."
    ),
};

export const updateTestCaseStepsShape = {
  id: z.coerce.number().min(1).optional().describe("The ID of the test case work item to update. Required for: update_steps."),
  steps: z
    .string()
    .optional()
    .describe(
      "The steps for the test case. Format each step as '1. Step one|Expected result one\n2. Step two|Expected result two'. Use '|' as the delimiter between step and expected result. Required for: update_steps. Used for: create."
    ),
};

export const testplanTestCaseWriteShape = {
  action: z.enum(["create", "update_steps"]).describe("The action to perform. Options: create (create a new test case work item), update_steps (update steps on an existing test case)."),
  ...createTestCaseShape,
  ...updateTestCaseStepsShape,
};

export const createTestPlanSchema = z.object(createTestPlanShape);
export const testplanTestPlanWriteSchema = z.object(testplanTestPlanWriteShape);
export const createTestSuiteSchema = z.object(createTestSuiteShape);
export const addTestCasesToSuiteSchema = z.object(addTestCasesToSuiteShape);
export const testplanTestSuiteWriteSchema = z.object(testplanTestSuiteWriteShape);
export const createTestCaseSchema = z.object(createTestCaseShape);
export const updateTestCaseStepsSchema = z.object(updateTestCaseStepsShape);
export const testplanTestCaseWriteSchema = z.object(testplanTestCaseWriteShape);

export type CreateTestPlanArgs = z.infer<typeof createTestPlanSchema>;
export type TestplanTestPlanWriteArgs = z.infer<typeof testplanTestPlanWriteSchema>;
export type CreateTestSuiteArgs = z.infer<typeof createTestSuiteSchema>;
export type AddTestCasesToSuiteArgs = z.infer<typeof addTestCasesToSuiteSchema>;
export type TestplanTestSuiteWriteArgs = z.infer<typeof testplanTestSuiteWriteSchema>;
export type CreateTestCaseArgs = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseStepsArgs = z.infer<typeof updateTestCaseStepsSchema>;
export type TestplanTestCaseWriteArgs = z.infer<typeof testplanTestCaseWriteSchema>;
