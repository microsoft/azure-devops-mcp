import { ParsedTestCase } from './csv-file-parser.js';
import { DynamicFieldMapping, getCachedFieldMappings } from './dynamic-work-item-field-fetcher.js';
import { WebApi } from "azure-devops-node-api";

export interface MappedTestCase {
  id?: string | number;
  title: string;
  steps?: string;
  priority?: number;
  areaPath?: string;
  iterationPath?: string;
  description?: string;
  tags?: string;
  automationStatus?: string;
  /**
   * Arbitrary additional mapped fields (referenceName => value) captured via dynamic mapping.
   * These are applied later when constructing the work item patch document.
   */
  extraFields?: Record<string, any>;
  originalData: ParsedTestCase;
  rowIndex: number;
}

export interface MappingResult {
  mappedTestCases: MappedTestCase[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    rowsWithId: number;
    rowsWithoutId: number;
  };
}

// Unified dynamic mapping suggestion types
export interface AdoFieldDefinition {
  referenceName: string;
  name: string;
  type?: string;
}

export interface UnifiedFieldMappingSuggestion {
  header: string;
  suggestedReferenceName?: string; // e.g. System.Title
  confidence: number; // 0-100 heuristic score
  candidates?: { referenceName: string; name: string; score: number }[]; // When ambiguous
  reason?: string;
}

export interface UnifiedMappingResult {
  headers: string[];
  suggestions: UnifiedFieldMappingSuggestion[];
  unmappedHeaders: string[];
  // Convenience direct mapping (header -> referenceName) for high-confidence suggestions
  suggestedMapping: Record<string, string>;
}

export interface FieldMapping {
  field: keyof MappedTestCase;
  possibleHeaders: string[];
  required: boolean;
  type: 'string' | 'number' | 'text' | 'boolean' | 'datetime';
}

/**
 * Define intelligent mapping rules for test case fields (kept as fallback)
 */
const FIELD_MAPPINGS: FieldMapping[] = [
  {
    field: 'id',
    possibleHeaders: ['id', 'testcaseid', 'test case id', 'case id', 'tcid', 'test id', 'workitemid', 'work item id'],
    required: false,
    type: 'number'
  },
  {
    field: 'title',
    possibleHeaders: ['title', 'name', 'test case title', 'testcasetitle', 'test name', 'testname', 'test case name', 'summary'],
    required: true,
    type: 'string'
  },
  {
    field: 'steps',
    possibleHeaders: ['steps', 'test steps', 'teststeps', 'action', 'actions', 'procedure', 'instructions', 'step'],
    required: false,
    type: 'text'
  },
  {
    field: 'priority',
    possibleHeaders: ['priority', 'pri', 'importance', 'level', 'criticality'],
    required: false,
    type: 'number'
  },
  {
    field: 'areaPath',
    possibleHeaders: ['area path', 'areapath', 'area', 'component', 'module', 'feature area'],
    required: false,
    type: 'string'
  },
  {
    field: 'iterationPath',
    possibleHeaders: ['iteration path', 'iterationpath', 'iteration', 'sprint', 'release', 'version'],
    required: false,
    type: 'string'
  },
  {
    field: 'description',
    possibleHeaders: ['description', 'desc', 'details', 'notes', 'comments', 'objective', 'purpose'],
    required: false,
    type: 'text'
  },
  {
    field: 'tags',
    possibleHeaders: ['tags', 'tag', 'labels', 'keywords', 'categories'],
    required: false,
    type: 'string'
  },
  {
    field: 'automationStatus',
    possibleHeaders: ['automation status', 'automationstatus', 'automation', 'automated', 'test type', 'type'],
    required: false,
    type: 'string'
  }
];

/**
 * Convert legacy FieldMapping to DynamicFieldMapping format for fallback
 */
const FIELD_MAPPINGS_FALLBACK: DynamicFieldMapping[] = FIELD_MAPPINGS.map(fm => ({
  field: fm.field.toString(),
  referenceName: getSystemReferenceName(fm.field.toString()),
  possibleHeaders: fm.possibleHeaders,
  required: fm.required,
  type: fm.type === 'text' ? 'text' : fm.type === 'number' ? 'number' : 'string',
  readOnly: false
}));

/**
 * Map legacy field names to system reference names
 */
function getSystemReferenceName(field: string): string {
  const mapping: Record<string, string> = {
    'id': 'System.Id',
    'title': 'System.Title',
    'steps': 'Microsoft.VSTS.TCM.Steps',
    'priority': 'Microsoft.VSTS.Common.Priority',
    'areaPath': 'System.AreaPath',
    'iterationPath': 'System.IterationPath',
    'description': 'System.Description',
    'tags': 'System.Tags',
    'automationStatus': 'Microsoft.VSTS.TCM.AutomationStatus'
  };
  return mapping[field] || field;
}

/**
 * Apply a caller-provided mapping of CSV header -> Azure DevOps field reference name.
 * This supports dynamic/custom fields beyond the static FIELD_MAPPINGS list.
 * The mapping object keys MUST match raw headers from the uploaded file.
 * Values should be field reference names (e.g., 'System.Title', 'Custom.MyField').
 */
export function mapTestCasesUsingProvidedMapping(
  data: ParsedTestCase[],
  headers: string[],
  fieldMapping: Record<string, string>
): MappingResult {
  const result: MappingResult = {
    mappedTestCases: [],
    errors: [],
    warnings: [],
    stats: {
      totalRows: data.length,
      validRows: 0,
      rowsWithId: 0,
      rowsWithoutId: 0
    }
  };

  // Determine which header maps to System.Title (required)
  const titleHeader = Object.entries(fieldMapping).find(([, ref]) => ref.toLowerCase() === 'system.title')?.[0];
  if (!titleHeader) {
    result.errors.push("Provided fieldMapping does not map any header to 'System.Title'.");
    return result;
  }

  // Iterate rows
  data.forEach((row, index) => {
    try {
      const rawTitle = row[titleHeader];
      if (!rawTitle || typeof rawTitle !== 'string' || rawTitle.trim() === '') {
        // Skip rows without a title
        return;
      }

      const mapped: MappedTestCase = {
        title: String(rawTitle).trim(),
        originalData: row,
        rowIndex: index + 2 // account for header row
      };

      const extra: Record<string, any> = {};

      for (const [csvHeader, referenceName] of Object.entries(fieldMapping)) {
        const value = row[csvHeader];
        if (value === undefined || value === null || value === '') continue;

        const refLower = referenceName.toLowerCase();
        // Map well-known fields to typed properties; everything else goes to extraFields
        if (refLower === 'system.title') {
          continue; // already handled
        } else if (refLower === 'microsoft.vsts.tcm.steps') {
          if (typeof value === 'string' && value.trim()) {
            mapped.steps = value.trim();
          }
        } else if (refLower === 'microsoft.vsts.common.priority') {
            const numeric = parseInt(String(value).trim(), 10);
            if (!isNaN(numeric)) mapped.priority = numeric;
        } else if (refLower === 'system.area path' || refLower === 'system.areapath') {
            if (typeof value === 'string') mapped.areaPath = value.trim();
        } else if (refLower === 'system.iteration path' || refLower === 'system.iterationpath') {
            if (typeof value === 'string') mapped.iterationPath = value.trim();
        } else if (refLower === 'system.description') {
            if (typeof value === 'string') mapped.description = value.trim();
        } else if (refLower === 'system.tags') {
            if (typeof value === 'string') mapped.tags = value.trim();
        } else if (refLower === 'microsoft.vsts.tcm.automationstatus') {
            if (typeof value === 'string') mapped.automationStatus = value.trim();
        } else if (refLower === 'system.id') {
            // Allow mapping to ID to drive update operations
            const parsed = parseInt(String(value).trim(), 10);
            if (!isNaN(parsed)) mapped.id = parsed; else mapped.id = String(value).trim();
        } else {
            // Capture as extra field using referenceName as key
            extra[referenceName] = value;
        }
      }

      if (Object.keys(extra).length > 0) {
        mapped.extraFields = extra;
      }

      result.mappedTestCases.push(mapped);
      result.stats.validRows++;
      if (mapped.id !== undefined) result.stats.rowsWithId++; else result.stats.rowsWithoutId++;
    } catch (err) {
      result.errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  });

  // Record mapping transparency (warnings list reused for info display)
  const mappingInfo = Object.entries(fieldMapping).map(([k,v]) => `${k} -> ${v}`);
  if (mappingInfo.length > 0) {
    result.warnings.push(`Dynamic field mapping applied: ${mappingInfo.join(', ')}`);
  }

  return result;
}

/**
 * Create a mapping between file headers and test case fields using dynamic field mappings
 */
export function createHeaderMapping(headers: string[], fieldMappings: DynamicFieldMapping[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  fieldMappings.forEach(fieldMapping => {
    // Find the first matching header for this field
    const matchedHeaderIndex = normalizedHeaders.findIndex(header => 
      fieldMapping.possibleHeaders.some(possible => 
        header === possible.toLowerCase() || 
        header.includes(possible.toLowerCase()) ||
        possible.toLowerCase().includes(header)
      )
    );

    if (matchedHeaderIndex !== -1) {
      // Map to the field's reference name (e.g., 'System.Title') instead of the short field name
      mapping.set(fieldMapping.referenceName, headers[matchedHeaderIndex]);
    }
  });

  return mapping;
}

/**
 * Create a mapping between file headers and test case fields using dynamic field mappings from Azure DevOps
 */
export async function createDynamicHeaderMapping(
  headers: string[], 
  connection: WebApi, 
  project: string, 
  workItemType: string = 'Test Case'
): Promise<Map<string, string>> {
  try {
    const fieldMappings = await getCachedFieldMappings(connection, project, workItemType);
    return createHeaderMapping(headers, fieldMappings);
  } catch (error) {
    // Fallback to static mappings if dynamic fetching fails
    console.warn(`Failed to fetch dynamic field mappings, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return createHeaderMapping(headers, FIELD_MAPPINGS_FALLBACK);
  }
}

/**
 * Map parsed data to test case format with intelligent field mapping (using fallback static mappings)
 */
export function mapTestCasesFromData(
  data: ParsedTestCase[], 
  headers: string[]
): MappingResult {
  const result: MappingResult = {
    mappedTestCases: [],
    errors: [],
    warnings: [],
    stats: {
      totalRows: data.length,
      validRows: 0,
      rowsWithId: 0,
      rowsWithoutId: 0
    }
  };

  // Create header mapping using fallback static mappings
  const headerMapping = createHeaderMapping(headers, FIELD_MAPPINGS_FALLBACK);
  
  // Check for required fields - look for System.Title mapping
  const titleHeader = headerMapping.get('System.Title');
  if (!titleHeader) {
    const titleMapping = FIELD_MAPPINGS_FALLBACK.find(f => f.referenceName === 'System.Title');
    result.errors.push(
      `Required field 'Title' not found. Please ensure your file has one of these column headers: ${
        titleMapping?.possibleHeaders.join(', ') || 'title, name'
      }`
    );
    return result;
  }

  // Log field mappings for transparency
  const mappingInfo: string[] = [];
  headerMapping.forEach((header, referenceName) => {
    mappingInfo.push(`${referenceName} → "${header}"`);
  });
  
  if (mappingInfo.length > 0) {
    result.warnings.push(`Field mappings detected: ${mappingInfo.join(', ')}`);
  }

  // Map each row
  data.forEach((row, index) => {
    try {
      const mappedTestCase = mapSingleTestCaseWithDynamicFields(row, headerMapping, index);
      
      if (mappedTestCase) {
        result.mappedTestCases.push(mappedTestCase);
        result.stats.validRows++;
        
        if (mappedTestCase.id) {
          result.stats.rowsWithId++;
        } else {
          result.stats.rowsWithoutId++;
        }
      }
    } catch (error) {
      result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  return result;
}

/**
 * Map parsed data to test case format with dynamic field mappings from Azure DevOps
 */
export async function mapTestCasesFromDataDynamic(
  data: ParsedTestCase[], 
  headers: string[],
  connection: WebApi,
  project: string,
  workItemType: string = 'Test Case'
): Promise<MappingResult> {
  const result: MappingResult = {
    mappedTestCases: [],
    errors: [],
    warnings: [],
    stats: {
      totalRows: data.length,
      validRows: 0,
      rowsWithId: 0,
      rowsWithoutId: 0
    }
  };

  try {
    // Create header mapping using dynamic field mappings
    const headerMapping = await createDynamicHeaderMapping(headers, connection, project, workItemType);
    
    // Check for required fields - look for System.Title mapping
    const titleHeader = headerMapping.get('System.Title');
    if (!titleHeader) {
      result.errors.push(
        `Required field 'Title' not found. Please ensure your file has one of these column headers: title, name, test case title, summary`
      );
      return result;
    }

    // Log field mappings for transparency
    const mappingInfo: string[] = [];
    headerMapping.forEach((header, referenceName) => {
      mappingInfo.push(`${referenceName} → "${header}"`);
    });
    
    if (mappingInfo.length > 0) {
      result.warnings.push(`Dynamic field mappings detected: ${mappingInfo.join(', ')}`);
    }

    // Map each row
    data.forEach((row, index) => {
      try {
        const mappedTestCase = mapSingleTestCaseWithDynamicFields(row, headerMapping, index);
        
        if (mappedTestCase) {
          result.mappedTestCases.push(mappedTestCase);
          result.stats.validRows++;
          
          if (mappedTestCase.id) {
            result.stats.rowsWithId++;
          } else {
            result.stats.rowsWithoutId++;
          }
        }
      } catch (error) {
        result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  } catch (error) {
    result.errors.push(`Failed to create dynamic field mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Map a single test case row using dynamic field mappings (reference names as keys)
 */
function mapSingleTestCaseWithDynamicFields(
  row: ParsedTestCase, 
  headerMapping: Map<string, string>,
  rowIndex: number
): MappedTestCase | null {
  const titleHeader = headerMapping.get('System.Title');
  const title = titleHeader ? row[titleHeader] : undefined;

  // Skip rows without title
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return null;
  }

  const mappedTestCase: MappedTestCase = {
    title: String(title).trim(),
    originalData: row,
    rowIndex: rowIndex + 2 // +2 because index is 0-based and we skip header row
  };

  // Map other fields using reference names
  headerMapping.forEach((header, referenceName) => {
    if (referenceName === 'System.Title') return; // Already handled

    const value = row[header];
    if (value !== undefined && value !== '') {
      // Map based on reference name instead of field name
      switch (referenceName) {
        case 'System.Id':
          const numericId = parseNumber(value);
          if (numericId !== null) {
            mappedTestCase.id = numericId;
          } else if (typeof value === 'string' && value.trim()) {
            mappedTestCase.id = value.trim(); // Keep as string if not numeric
          }
          break;
          
        case 'Microsoft.VSTS.Common.Priority':
          const priority = parseNumber(value);
          if (priority !== null && priority >= 1 && priority <= 4) {
            mappedTestCase.priority = priority;
          }
          break;
          
        case 'Microsoft.VSTS.TCM.Steps':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.steps = value.trim();
          }
          break;

        case 'System.Description':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.description = value.trim();
          }
          break;

        case 'System.AreaPath':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.areaPath = value.trim();
          }
          break;

        case 'System.IterationPath':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.iterationPath = value.trim();
          }
          break;

        case 'System.Tags':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.tags = value.trim();
          }
          break;

        case 'Microsoft.VSTS.TCM.AutomationStatus':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase.automationStatus = value.trim();
          }
          break;

        default:
          // For any other fields, store in extraFields
          if (!mappedTestCase.extraFields) {
            mappedTestCase.extraFields = {};
          }
          mappedTestCase.extraFields[referenceName] = value;
          break;
      }
    }
  });

  return mappedTestCase;
}

/**
 * Map a single test case row (legacy version for backward compatibility)
 */
function mapSingleTestCase(
  row: ParsedTestCase, 
  headerMapping: Map<string, string>,
  rowIndex: number
): MappedTestCase | null {
  const titleHeader = headerMapping.get('title');
  const title = titleHeader ? row[titleHeader] : undefined;

  // Skip rows without title
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return null;
  }

  const mappedTestCase: MappedTestCase = {
    title: String(title).trim(),
    originalData: row,
    rowIndex: rowIndex + 2 // +2 because index is 0-based and we skip header row
  };

  // Map other fields
  headerMapping.forEach((header, field) => {
    if (field === 'title') return; // Already handled

    const value = row[header];
    if (value !== undefined && value !== '') {
      switch (field) {
        case 'id':
          const numericId = parseNumber(value);
          if (numericId !== null) {
            mappedTestCase.id = numericId;
          } else if (typeof value === 'string' && value.trim()) {
            mappedTestCase.id = value.trim(); // Keep as string if not numeric
          }
          break;
          
        case 'priority':
          const priority = parseNumber(value);
          if (priority !== null && priority >= 1 && priority <= 4) {
            mappedTestCase.priority = priority;
          }
          break;
          
        case 'steps':
        case 'description':
        case 'areaPath':
        case 'iterationPath':
        case 'tags':
        case 'automationStatus':
          if (typeof value === 'string' && value.trim()) {
            mappedTestCase[field] = value.trim();
          }
          break;
      }
    }
  });

  return mappedTestCase;
}

/**
 * Parse a value as number, return null if not a valid number
 */
function parseNumber(value: any): number | null {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.floor(value); // Ensure integer
  }
  
  if (typeof value === 'string') {
    const parsed = parseInt(value.trim(), 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * Generate preview information for user confirmation
 */
export function generatePreview(mappingResult: MappingResult, maxPreviewRows: number = 5): string {
  const { mappedTestCases, stats, errors, warnings } = mappingResult;
  
  let preview = '## Test Case Import Preview\n\n';
  
  // Statistics
  preview += `### Statistics:\n`;
  preview += `- Total rows processed: ${stats.totalRows}\n`;
  preview += `- Valid test cases: ${stats.validRows}\n`;
  preview += `- Test cases with ID (will be updated): ${stats.rowsWithId}\n`;
  preview += `- Test cases without ID (will be created): ${stats.rowsWithoutId}\n\n`;
  
  // Errors
  if (errors.length > 0) {
    preview += `### ❌ Errors (${errors.length}):\n`;
    errors.forEach(error => preview += `- ${error}\n`);
    preview += '\n';
  }
  
  // Warnings
  if (warnings.length > 0) {
    preview += `### ⚠️ Warnings (${warnings.length}):\n`;
    warnings.forEach(warning => preview += `- ${warning}\n`);
    preview += '\n';
  }
  
  // Sample test cases
  if (mappedTestCases.length > 0) {
    preview += `### Sample Test Cases (showing first ${Math.min(maxPreviewRows, mappedTestCases.length)}):\n\n`;
    
    mappedTestCases.slice(0, maxPreviewRows).forEach((testCase, index) => {
      preview += `**${index + 1}. ${testCase.title}**\n`;
      if (testCase.id) preview += `   - ID: ${testCase.id} (will update existing)\n`;
      if (testCase.priority) preview += `   - Priority: ${testCase.priority}\n`;
      if (testCase.areaPath) preview += `   - Area Path: ${testCase.areaPath}\n`;
      if (testCase.steps) {
        const truncatedSteps = testCase.steps.length > 100 
          ? testCase.steps.substring(0, 100) + '...' 
          : testCase.steps;
        preview += `   - Steps: ${truncatedSteps}\n`;
      }
      preview += '\n';
    });
    
    if (mappedTestCases.length > maxPreviewRows) {
      preview += `... and ${mappedTestCases.length - maxPreviewRows} more test cases\n\n`;
    }
  }
  
  return preview;
}

/**
 * Produce a unified mapping suggestion for arbitrary CSV headers against the live set of
 * Azure DevOps Test Case work item fields (includes custom fields). No segregation of
 * core vs custom – every field is treated uniformly with lightweight heuristics.
 * This is LLM-friendly: callers can optionally pass the suggestions to an LLM for refinement,
 * but the heuristic alone should cover the common cases (pluralization, synonyms, typos).
 */
export function suggestUnifiedFieldMapping(headers: string[], adoFields: AdoFieldDefinition[]): UnifiedMappingResult {
  const normalizedFields = adoFields.map(f => ({
    ...f,
    _normName: normalizeName(f.name),
    _normRefTail: normalizeName(f.referenceName.split('.').pop() || f.referenceName)
  }));

  const suggestions: UnifiedFieldMappingSuggestion[] = [];
  const suggestedMapping: Record<string, string> = {};

  headers.forEach(header => {
    const normHeader = normalizeName(header);
    if (!normHeader) return;

    const headerSingular = singularize(normHeader);

    // Special system synonyms map
    const specialSynonyms: Record<string, string> = {
      'title': 'System.Title',
      'name': 'System.Title',
      'titles': 'System.Title',
      'testcasetitle': 'System.Title',
      'testcasename': 'System.Title',
      'summary': 'System.Title',
      'id': 'System.Id',
      'testcaseid': 'System.Id',
      'caseid': 'System.Id',
      'tcid': 'System.Id',
      'workitemid': 'System.Id',
      'steps': 'Microsoft.VSTS.TCM.Steps',
      'teststeps': 'Microsoft.VSTS.TCM.Steps',
      'action': 'Microsoft.VSTS.TCM.Steps',
      'actions': 'Microsoft.VSTS.TCM.Steps',
      'procedure': 'Microsoft.VSTS.TCM.Steps',
      'priority': 'Microsoft.VSTS.Common.Priority',
      'pri': 'Microsoft.VSTS.Common.Priority',
      'importance': 'Microsoft.VSTS.Common.Priority',
      'level': 'Microsoft.VSTS.Common.Priority',
      'areapath': 'System.AreaPath',
      'area': 'System.AreaPath',
      'iterationpath': 'System.IterationPath',
      'iteration': 'System.IterationPath',
      'sprint': 'System.IterationPath',
      'description': 'System.Description',
      'desc': 'System.Description',
      'tags': 'System.Tags',
      'tag': 'System.Tags',
      'labels': 'System.Tags',
      'automationstatus': 'Microsoft.VSTS.TCM.AutomationStatus',
      'automation': 'Microsoft.VSTS.TCM.AutomationStatus',
      'automated': 'Microsoft.VSTS.TCM.AutomationStatus'
    };

    // Direct synonym mapping first
    if (specialSynonyms[normHeader]) {
      suggestions.push({
        header,
        suggestedReferenceName: specialSynonyms[normHeader],
        confidence: 100,
        reason: 'Direct synonym match'
      });
      suggestedMapping[header] = specialSynonyms[normHeader];
      return;
    }
    if (specialSynonyms[headerSingular] && headerSingular !== normHeader) {
      suggestions.push({
        header,
        suggestedReferenceName: specialSynonyms[headerSingular],
        confidence: 95,
        reason: 'Singular synonym match'
      });
      suggestedMapping[header] = specialSynonyms[headerSingular];
      return;
    }

    // Score against all fields
    let bestScore = 0;
    let bestField: AdoFieldDefinition | undefined;
    const candidateList: { referenceName: string; name: string; score: number }[] = [];

    normalizedFields.forEach(f => {
      const scores: number[] = [];
      if (normHeader === f._normName) scores.push(100);
      if (normHeader === f._normRefTail) scores.push(95);
      if (headerSingular === f._normName || headerSingular === f._normRefTail) scores.push(90);
      if (f._normName.includes(normHeader) || normHeader.includes(f._normName)) scores.push(80);
      if (f._normRefTail.includes(normHeader) || normHeader.includes(f._normRefTail)) scores.push(78);
      const distName = levenshtein(normHeader, f._normName);
      const distTail = levenshtein(normHeader, f._normRefTail);
      const minDist = Math.min(distName, distTail);
      if (minDist === 1) scores.push(75);
      else if (minDist === 2) scores.push(70);

      if (scores.length > 0) {
        const score = Math.max(...scores);
        candidateList.push({ referenceName: f.referenceName, name: f.name, score });
        if (score > bestScore) {
          bestScore = score;
          bestField = f;
        }
      }
    });

    candidateList.sort((a, b) => b.score - a.score);

    if (bestField && bestScore >= 70) {
      // Check ambiguity: other candidates within 5 points
      const topCandidates = candidateList.filter(c => bestScore - c.score <= 5).slice(0, 5);
      if (topCandidates.length > 1) {
        suggestions.push({
          header,
          suggestedReferenceName: bestField.referenceName,
            confidence: bestScore,
          candidates: topCandidates,
          reason: 'Multiple close matches'
        });
        // Only auto-apply if confidence very high
        if (bestScore >= 90) {
          suggestedMapping[header] = bestField.referenceName;
        }
      } else {
        suggestions.push({
          header,
          suggestedReferenceName: bestField.referenceName,
          confidence: bestScore,
          reason: 'Best heuristic match'
        });
        suggestedMapping[header] = bestField.referenceName;
      }
    } else {
      suggestions.push({ header, confidence: 0, reason: 'No confident match found' });
    }
  });

  const unmappedHeaders = suggestions.filter(s => !s.suggestedReferenceName).map(s => s.header);

  return {
    headers: [...headers],
    suggestions,
    unmappedHeaders,
    suggestedMapping
  };
}

// --------- Helper functions for unified mapping ---------
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function singularize(value: string): string {
  if (value.endsWith('ies')) return value.slice(0, -3) + 'y';
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}

// Lightweight Levenshtein distance (small inputs only)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}