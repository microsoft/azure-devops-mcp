import { WebApi } from "azure-devops-node-api";

export interface AdoFieldDefinition {
  referenceName: string;
  name: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
}

export interface DynamicFieldMapping {
  field: string;
  referenceName: string;
  possibleHeaders: string[];
  required: boolean;
  type: 'string' | 'number' | 'text' | 'boolean' | 'datetime';
  readOnly: boolean;
}

/**
 * Fetch all work item fields for a specific work item type from Azure DevOps
 */
export async function fetchWorkItemTypeFields(
  connection: WebApi,
  project: string,
  workItemType: string = 'Test Case'
): Promise<AdoFieldDefinition[]> {
  try {
    const witApi = await connection.getWorkItemTrackingApi();
    const wiType = await witApi.getWorkItemType(project, workItemType);
    
    if (!wiType.fields) {
      throw new Error(`No fields found for work item type: ${workItemType}`);
    }

    return wiType.fields.map(field => ({
      referenceName: field.referenceName || field.name || 'Unknown',
      name: field.name || field.referenceName || 'Unknown',
      required: field.alwaysRequired || false
    }));
  } catch (error) {
    throw new Error(`Failed to fetch work item type fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate dynamic field mappings based on fetched Azure DevOps fields
 */
export function generateDynamicFieldMappings(adoFields: AdoFieldDefinition[]): DynamicFieldMapping[] {
  const mappings: DynamicFieldMapping[] = [];

  // Define common header patterns for different field types
  const fieldHeaderPatterns: Record<string, string[]> = {
    'System.Id': ['id', 'testcaseid', 'test case id', 'case id', 'tcid', 'test id', 'workitemid', 'work item id'],
    'System.Title': ['title', 'name', 'test case title', 'testcasetitle', 'test name', 'testname', 'test case name', 'summary'],
    'Microsoft.VSTS.TCM.Steps': ['steps', 'test steps', 'teststeps', 'action', 'actions', 'procedure', 'instructions', 'step'],
    'Microsoft.VSTS.Common.Priority': ['priority', 'pri', 'importance', 'level', 'criticality'],
    'System.AreaPath': ['area path', 'areapath', 'area', 'component', 'module', 'feature area'],
    'System.IterationPath': ['iteration path', 'iterationpath', 'iteration', 'sprint', 'release', 'version'],
    'System.Description': ['description', 'desc', 'details', 'notes', 'comments', 'objective', 'purpose'],
    'System.Tags': ['tags', 'tag', 'labels', 'keywords', 'categories'],
    'Microsoft.VSTS.TCM.AutomationStatus': ['automation status', 'automationstatus', 'automation', 'automated', 'test type'],
    'System.AssignedTo': ['assigned to', 'assignedto', 'assigned for execution', 'assignee', 'owner'],
    'System.CreatedBy': ['created by', 'createdby', 'creator', 'author'],
    'System.State': ['state', 'status', 'condition'],
    'Microsoft.VSTS.Common.AcceptanceCriteria': ['acceptance criteria', 'acceptancecriteria', 'criteria', 'requirements'],
    'Microsoft.VSTS.TCM.ReproSteps': ['repro steps', 'reproduce steps', 'reproduction steps', 'steps to reproduce']
  };

  adoFields.forEach(field => {
    const referenceName = field.referenceName;
    const isRequired = field.required || referenceName === 'System.Title'; // Title is always required for test cases
    
    // Get predefined headers or generate from field name
    let possibleHeaders = fieldHeaderPatterns[referenceName] || [];
    
    // If no predefined patterns, generate from the field name
    if (possibleHeaders.length === 0) {
      const fieldName = field.name.toLowerCase();
      const refTail = referenceName.split('.').pop()?.toLowerCase() || '';
      
      possibleHeaders = [
        fieldName,
        refTail,
        fieldName.replace(/\s+/g, ''),
        refTail.replace(/\s+/g, ''),
        fieldName.replace(/\s+/g, '_'),
        refTail.replace(/\s+/g, '_')
      ].filter((header, index, array) => array.indexOf(header) === index); // Remove duplicates
    }

    // Determine the field type based on Azure DevOps field type
    let fieldType: 'string' | 'number' | 'text' | 'boolean' | 'datetime' = 'string';
    if (field.type) {
      const typeStr = field.type.toLowerCase();
      if (typeStr.includes('integer') || typeStr.includes('double')) {
        fieldType = 'number';
      } else if (typeStr.includes('html') || typeStr.includes('plaintext') || typeStr.includes('history')) {
        fieldType = 'text';
      } else if (typeStr.includes('boolean')) {
        fieldType = 'boolean';
      } else if (typeStr.includes('datetime')) {
        fieldType = 'datetime';
      }
    }

    mappings.push({
      field: referenceName,
      referenceName: referenceName,
      possibleHeaders,
      required: isRequired,
      type: fieldType,
      readOnly: field.readOnly || false
    });
  });

  return mappings;
}

/**
 * Get commonly used Test Case fields with their header patterns
 */
export function getCommonTestCaseFields(): DynamicFieldMapping[] {
  return [
    {
      field: 'System.Id',
      referenceName: 'System.Id',
      possibleHeaders: ['id', 'testcaseid', 'test case id', 'case id', 'tcid', 'test id', 'workitemid', 'work item id'],
      required: false,
      type: 'number',
      readOnly: true
    },
    {
      field: 'System.Title',
      referenceName: 'System.Title',
      possibleHeaders: ['title', 'name', 'test case title', 'testcasetitle', 'test name', 'testname', 'test case name', 'summary'],
      required: true,
      type: 'string',
      readOnly: false
    },
    {
      field: 'Microsoft.VSTS.TCM.Steps',
      referenceName: 'Microsoft.VSTS.TCM.Steps',
      possibleHeaders: ['steps', 'test steps', 'teststeps', 'action', 'actions', 'procedure', 'instructions', 'step'],
      required: false,
      type: 'text',
      readOnly: false
    },
    {
      field: 'Microsoft.VSTS.Common.Priority',
      referenceName: 'Microsoft.VSTS.Common.Priority',
      possibleHeaders: ['priority', 'pri', 'importance', 'level', 'criticality'],
      required: false,
      type: 'number',
      readOnly: false
    },
    {
      field: 'System.AreaPath',
      referenceName: 'System.AreaPath',
      possibleHeaders: ['area path', 'areapath', 'area', 'component', 'module', 'feature area'],
      required: false,
      type: 'string',
      readOnly: false
    },
    {
      field: 'System.IterationPath',
      referenceName: 'System.IterationPath',
      possibleHeaders: ['iteration path', 'iterationpath', 'iteration', 'sprint', 'release', 'version'],
      required: false,
      type: 'string',
      readOnly: false
    },
    {
      field: 'System.Description',
      referenceName: 'System.Description',
      possibleHeaders: ['description', 'desc', 'details', 'notes', 'comments', 'objective', 'purpose'],
      required: false,
      type: 'text',
      readOnly: false
    },
    {
      field: 'System.Tags',
      referenceName: 'System.Tags',
      possibleHeaders: ['tags', 'tag', 'labels', 'keywords', 'categories'],
      required: false,
      type: 'string',
      readOnly: false
    },
    {
      field: 'Microsoft.VSTS.TCM.AutomationStatus',
      referenceName: 'Microsoft.VSTS.TCM.AutomationStatus',
      possibleHeaders: ['automation status', 'automationstatus', 'automation', 'automated', 'test type'],
      required: false,
      type: 'string',
      readOnly: false
    },
    {
      field: 'System.AssignedTo',
      referenceName: 'System.AssignedTo',
      possibleHeaders: ['assigned to', 'assignedto', 'assigned for execution', 'assignee', 'owner'],
      required: false,
      type: 'string',
      readOnly: false
    }
  ];
}

/**
 * Cache for storing fetched field mappings to avoid repeated API calls
 */
const fieldMappingCache = new Map<string, DynamicFieldMapping[]>();

/**
 * Get field mappings with caching support
 */
export async function getCachedFieldMappings(
  connection: WebApi,
  project: string,
  workItemType: string = 'Test Case',
  useCache: boolean = true
): Promise<DynamicFieldMapping[]> {
  const cacheKey = `${project}:${workItemType}`;
  
  if (useCache && fieldMappingCache.has(cacheKey)) {
    return fieldMappingCache.get(cacheKey)!;
  }

  try {
    const adoFields = await fetchWorkItemTypeFields(connection, project, workItemType);
    const mappings = generateDynamicFieldMappings(adoFields);
    
    if (useCache) {
      fieldMappingCache.set(cacheKey, mappings);
    }
    
    return mappings;
  } catch (error) {
    // Fallback to common test case fields if API call fails
    console.warn(`Failed to fetch dynamic fields, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return getCommonTestCaseFields();
  }
}

/**
 * Clear the field mapping cache
 */
export function clearFieldMappingCache(project?: string, workItemType?: string): void {
  if (project && workItemType) {
    const cacheKey = `${project}:${workItemType}`;
    fieldMappingCache.delete(cacheKey);
  } else {
    fieldMappingCache.clear();
  }
}