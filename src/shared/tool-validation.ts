// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared validation logic for tool names and parameter names
 * to ensure they conform to Claude API requirements.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  reason?: string;
}

/**
 * Validates that a name conforms to Claude API requirements.
 * Names must match pattern: ^[a-zA-Z0-9_.-]{1,64}$
 * @param name The name to validate
 * @returns Object with isValid boolean and error/reason message if invalid
 */
export function validateName(name: string): ValidationResult {
  // Check length
  if (name.length === 0) {
    return { isValid: false, error: "Name cannot be empty", reason: "name cannot be empty" };
  }

  if (name.length > 64) {
    return {
      isValid: false,
      error: `Name '${name}' is ${name.length} characters long, maximum allowed is 64`,
      reason: `name is ${name.length} characters long, maximum allowed is 64`,
    };
  }

  // Check pattern: only alphanumeric, underscore, dot, and hyphen allowed
  const validPattern = /^[a-zA-Z0-9_.-]+$/;
  if (!validPattern.test(name)) {
    return {
      isValid: false,
      error: `Name '${name}' contains invalid characters. Only alphanumeric characters, underscores, dots, and hyphens are allowed`,
      reason: "name contains invalid characters. Only alphanumeric characters, underscores, dots, and hyphens are allowed",
    };
  }

  return { isValid: true };
}

/**
 * Validates that a tool name conforms to Claude API requirements.
 * @param toolName The tool name to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateToolName(toolName: string): ValidationResult {
  const result = validateName(toolName);
  if (!result.isValid) {
    return { isValid: false, error: result.error?.replace("Name", "Tool name") };
  }
  return result;
}

/**
 * Validates that a parameter name conforms to Claude API requirements.
 * @param paramName The parameter name to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateParameterName(paramName: string): ValidationResult {
  const result = validateName(paramName);
  if (!result.isValid) {
    return { isValid: false, error: result.error?.replace("Name", "Parameter name") };
  }
  return result;
}

/**
 * Extracts tool names from tool constant definitions
 * @param fileContent - The content of a TypeScript file
 * @returns Array of tool names found
 */
export function extractToolNames(fileContent: string): string[] {
  const toolNames: string[] = [];

  // Pattern to match tool constant definitions in tool objects
  // This looks for patterns like: const SOMETHING_TOOLS = { ... } or const Test_Plan_Tools = { ... }
  const toolsObjectPattern = /const\s+\w*[Tt][Oo][Oo][Ll][Ss]?\s*=\s*\{([^}]+)\}/g;

  let toolsMatch;
  while ((toolsMatch = toolsObjectPattern.exec(fileContent)) !== null) {
    const objectContent = toolsMatch[1];

    // Now extract individual tool definitions from within the object
    const toolPattern = /^\s*[a-zA-Z_][a-zA-Z0-9_]*:\s*"([^"]+)"/gm;

    let match;
    while ((match = toolPattern.exec(objectContent)) !== null) {
      toolNames.push(match[1]);
    }
  }

  return toolNames;
}

/**
 * Extracts parameter names from Zod schema definitions
 * @param fileContent - The content of a TypeScript file
 * @returns Array of parameter names found
 */
export function extractParameterNames(fileContent: string): string[] {
  const paramNames: string[] = [];

  // Pattern to match parameter definitions like: paramName: z.string()
  const paramPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*z\./gm;

  let match;
  while ((match = paramPattern.exec(fileContent)) !== null) {
    paramNames.push(match[1]);
  }

  return paramNames;
}
