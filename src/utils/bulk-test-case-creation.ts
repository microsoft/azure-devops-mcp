// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { WebApi } from "azure-devops-node-api";
import { WorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi.js";
import { TestApi } from "azure-devops-node-api/TestApi.js";
import { MappedTestCase } from './test-case-mapper.js';

export interface BulkOperationResult {
  success: boolean;
  created: TestCaseResult[];
  updated: TestCaseResult[];
  errors: OperationError[];
  summary: {
    totalProcessed: number;
    successfulCreations: number;
    successfulUpdates: number;
    failures: number;
  };
}

export interface TestCaseResult {
  originalRowIndex: number;
  title: string;
  workItemId: number;
  url?: string;
  operation: 'created' | 'updated';
}

export interface OperationError {
  originalRowIndex: number;
  title: string;
  operation: 'create' | 'update' | 'lookup';
  error: string;
  originalId?: string | number;
}

export interface BulkOperationOptions {
  project: string;
  planId?: number;
  suiteId?: number;
  batchSize?: number;
  addToSuite?: boolean;
}

/**
 * Execute bulk test case creation and updates
 */
export async function executeBulkTestCaseOperations(
  testCases: MappedTestCase[],
  options: BulkOperationOptions,
  connectionProvider: () => Promise<WebApi>
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    success: false,
    created: [],
    updated: [],
    errors: [],
    summary: {
      totalProcessed: 0,
      successfulCreations: 0,
      successfulUpdates: 0,
      failures: 0
    }
  };

  if (testCases.length === 0) {
    result.success = true;
    return result;
  }

  try {
    const connection = await connectionProvider();
    const witApi = await connection.getWorkItemTrackingApi();
    const testApi = options.addToSuite ? await connection.getTestApi() : undefined;

    // Separate test cases by operation type
    const { toCreate, toUpdate } = await categorizeTestCases(testCases, witApi, options.project, result);

    // Process creations
    await processCreations(toCreate, witApi, options, result);

    // Process updates
    await processUpdates(toUpdate, witApi, options, result);

    // Add to test suite if requested
    if (options.addToSuite && options.planId && options.suiteId && testApi) {
      await addTestCasesToSuite(result.created.concat(result.updated), testApi, options, result);
    }

    // Calculate final statistics
    result.summary.totalProcessed = testCases.length;
    result.summary.successfulCreations = result.created.length;
    result.summary.successfulUpdates = result.updated.length;
    result.summary.failures = result.errors.length;
    result.success = result.summary.failures === 0;

    return result;
  } catch (error) {
    result.errors.push({
      originalRowIndex: 0,
      title: 'Bulk Operation',
      operation: 'create',
      error: `Fatal error during bulk operation: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    result.summary.failures = testCases.length;
    return result;
  }
}

/**
 * Categorize test cases into create vs update operations
 */
async function categorizeTestCases(
  testCases: MappedTestCase[],
  witApi: WorkItemTrackingApi,
  project: string,
  result: BulkOperationResult
): Promise<{ toCreate: MappedTestCase[], toUpdate: MappedTestCase[] }> {
  const toCreate: MappedTestCase[] = [];
  const toUpdate: MappedTestCase[] = [];

  for (const testCase of testCases) {
    if (!testCase.id) {
      // No ID provided, will create new
      toCreate.push(testCase);
    } else {
      // ID provided, check if it exists
      try {
        const numericId = typeof testCase.id === 'string' ? parseInt(testCase.id, 10) : testCase.id;
        
        if (isNaN(numericId)) {
          result.errors.push({
            originalRowIndex: testCase.rowIndex,
            title: testCase.title,
            operation: 'lookup',
            error: `Invalid test case ID: ${testCase.id}`,
            originalId: testCase.id
          });
          continue;
        }

        // Try to fetch the work item to see if it exists
        const workItem = await witApi.getWorkItem(numericId, ['System.WorkItemType'], undefined, undefined, project);
        
        if (workItem && workItem.fields && workItem.fields['System.WorkItemType'] === 'Test Case') {
          testCase.id = numericId; // Ensure it's numeric
          toUpdate.push(testCase);
        } else if (workItem) {
          result.errors.push({
            originalRowIndex: testCase.rowIndex,
            title: testCase.title,
            operation: 'lookup',
            error: `Work item ${numericId} exists but is not a Test Case (type: ${workItem.fields?.['System.WorkItemType']})`,
            originalId: testCase.id
          });
        } else {
          result.errors.push({
            originalRowIndex: testCase.rowIndex,
            title: testCase.title,
            operation: 'lookup',
            error: `Work item ${numericId} not found`,
            originalId: testCase.id
          });
        }
      } catch (error) {
        // Work item doesn't exist or access denied, treat as create
        if (error instanceof Error && error.message.includes('404')) {
          result.errors.push({
            originalRowIndex: testCase.rowIndex,
            title: testCase.title,
            operation: 'lookup',
            error: `Test case with ID ${testCase.id} not found. Cannot update non-existent test case.`,
            originalId: testCase.id
          });
        } else {
          result.errors.push({
            originalRowIndex: testCase.rowIndex,
            title: testCase.title,
            operation: 'lookup',
            error: `Error checking test case ID ${testCase.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            originalId: testCase.id
          });
        }
      }
    }
  }

  return { toCreate, toUpdate };
}

/**
 * Process test case creations
 */
async function processCreations(
  testCases: MappedTestCase[],
  witApi: WorkItemTrackingApi,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  const batchSize = options.batchSize || 10;
  
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);
    await Promise.all(batch.map(testCase => createSingleTestCase(testCase, witApi, options, result)));
  }
}

/**
 * Process test case updates
 */
async function processUpdates(
  testCases: MappedTestCase[],
  witApi: WorkItemTrackingApi,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  const batchSize = options.batchSize || 10;
  
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);
    await Promise.all(batch.map(testCase => updateSingleTestCase(testCase, witApi, options, result)));
  }
}

/**
 * Create a single test case
 */
async function createSingleTestCase(
  testCase: MappedTestCase,
  witApi: WorkItemTrackingApi,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  try {
    const patchDocument = buildPatchDocument(testCase, 'create');
    const workItem = await witApi.createWorkItem({}, patchDocument, options.project, 'Test Case');

    if (workItem && workItem.id) {
      result.created.push({
        originalRowIndex: testCase.rowIndex,
        title: testCase.title,
        workItemId: workItem.id,
        url: workItem.url,
        operation: 'created'
      });
    } else {
      result.errors.push({
        originalRowIndex: testCase.rowIndex,
        title: testCase.title,
        operation: 'create',
        error: 'Work item was created but no ID was returned'
      });
    }
  } catch (error) {
    result.errors.push({
      originalRowIndex: testCase.rowIndex,
      title: testCase.title,
      operation: 'create',
      error: error instanceof Error ? error.message : 'Unknown error during creation'
    });
  }
}

/**
 * Update a single test case
 */
async function updateSingleTestCase(
  testCase: MappedTestCase,
  witApi: WorkItemTrackingApi,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  try {
    const patchDocument = buildPatchDocument(testCase, 'update');
    const workItemId = Number(testCase.id);
    
    const workItem = await witApi.updateWorkItem({}, patchDocument, workItemId, options.project);

    if (workItem && workItem.id) {
      result.updated.push({
        originalRowIndex: testCase.rowIndex,
        title: testCase.title,
        workItemId: workItem.id,
        url: workItem.url,
        operation: 'updated'
      });
    } else {
      result.errors.push({
        originalRowIndex: testCase.rowIndex,
        title: testCase.title,
        operation: 'update',
        error: 'Work item update completed but no confirmation received',
        originalId: testCase.id
      });
    }
  } catch (error) {
    result.errors.push({
      originalRowIndex: testCase.rowIndex,
      title: testCase.title,
      operation: 'update',
      error: error instanceof Error ? error.message : 'Unknown error during update',
      originalId: testCase.id
    });
  }
}

/**
 * Build JSON patch document for work item operations
 */
function buildPatchDocument(testCase: MappedTestCase, operation: 'create' | 'update'): any[] {
  const patchDocument = [];

  // Always include title
  patchDocument.push({
    op: operation === 'create' ? 'add' : 'replace',
    path: '/fields/System.Title',
    value: testCase.title
  });

  // Add steps if provided
  if (testCase.steps) {
    const stepsXml = convertStepsToXml(testCase.steps);
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/Microsoft.VSTS.TCM.Steps',
      value: stepsXml
    });
  }

  // Add priority if provided
  if (testCase.priority) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/Microsoft.VSTS.Common.Priority',
      value: testCase.priority
    });
  }

  // Add area path if provided
  if (testCase.areaPath) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/System.AreaPath',
      value: testCase.areaPath
    });
  }

  // Add iteration path if provided
  if (testCase.iterationPath) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/System.IterationPath',
      value: testCase.iterationPath
    });
  }

  // Add description if provided
  if (testCase.description) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/System.Description',
      value: testCase.description
    });
  }

  // Add tags if provided
  if (testCase.tags) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/System.Tags',
      value: testCase.tags
    });
  }

  // Add automation status if provided
  if (testCase.automationStatus) {
    patchDocument.push({
      op: operation === 'create' ? 'add' : 'replace',
      path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
      value: testCase.automationStatus
    });
  }

  // Add any extra custom / dynamic fields captured
  if (testCase.extraFields) {
    for (const [referenceName, value] of Object.entries(testCase.extraFields)) {
      if (value === undefined || value === null || value === '') continue;
      // Avoid duplicating core fields already set above
      const lowered = referenceName.toLowerCase();
      if ([
        'system.title',
        'microsoft.vsts.tcm.steps',
        'microsoft.vsts.common.priority',
        'system.area path',
        'system.areapath',
        'system.iteration path',
        'system.iterationpath',
        'system.description',
        'system.tags',
        'microsoft.vsts.tcm.automationstatus'
      ].includes(lowered)) {
        continue;
      }
      patchDocument.push({
        op: operation === 'create' ? 'add' : 'replace',
        path: `/fields/${referenceName}`,
        value
      });
    }
  }

  return patchDocument;
}

/**
 * Add test cases to test suite
 */
async function addTestCasesToSuite(
  testCaseResults: TestCaseResult[],
  testApi: TestApi,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  if (!options.planId || !options.suiteId || testCaseResults.length === 0) {
    return;
  }

  try {
    const testCaseIds = testCaseResults.map(tc => tc.workItemId.toString());
    const testCaseIdsString = testCaseIds.join(',');
    
    await testApi.addTestCasesToSuite(options.project, options.planId, options.suiteId, testCaseIdsString);
    
    // Note: We don't track individual suite addition failures here as it's a bulk operation
    // The Azure DevOps API will add all valid test cases and ignore invalid ones
  } catch (error) {
    // Add a warning about suite addition failure, but don't fail the entire operation
    result.errors.push({
      originalRowIndex: 0,
      title: 'Suite Addition',
      operation: 'create',
      error: `Failed to add test cases to suite ${options.suiteId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

/**
 * Convert steps text to XML format (reused from existing code)
 */
function convertStepsToXml(steps: string): string {
  // Handle both formatted and plain text steps
  const stepsLines = steps.split('\n').filter((line) => line.trim() !== '');

  let xmlSteps = `<steps id="0" last="${stepsLines.length}">`;

  for (let i = 0; i < stepsLines.length; i++) {
    const stepLine = stepsLines[i].trim();
    if (stepLine) {
      // Check if step is already formatted (number. text|expected)
      const formattedMatch = stepLine.match(/^(\d+)\.\s*(.+?)(?:\|(.+))?$/);
      
      let stepText: string;
      let expectedText: string;
      
      if (formattedMatch) {
        // Already formatted
        stepText = formattedMatch[2].trim();
        expectedText = formattedMatch[3]?.trim() || 'Verify step completes successfully';
      } else {
        // Plain text, treat as single step
        stepText = stepLine;
        expectedText = 'Verify step completes successfully';
      }

      xmlSteps += `
                <step id="${i + 1}" type="ActionStep">
                    <parameterizedString isformatted="true">${escapeXml(stepText)}</parameterizedString>
                    <parameterizedString isformatted="true">${escapeXml(expectedText)}</parameterizedString>
                </step>`;
    }
  }

  xmlSteps += '</steps>';
  return xmlSteps;
}

/**
 * Escape XML special characters (reused from existing code)
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}