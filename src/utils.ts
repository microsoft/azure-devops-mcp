// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// API versions – overridable via environment for on-prem / older servers
export const apiVersion = process.env.ADO_MCP_API_VERSION || "7.2-preview.1";
export const batchApiVersion = process.env.ADO_MCP_BATCH_API_VERSION || "5.0";
export const markdownCommentsApiVersion = process.env.ADO_MCP_MARKDOWN_COMMENTS_API_VERSION || "7.2-preview.4";

export type AzureDevOpsDeploymentMode = "cloud" | "onprem";

export interface AzureDevOpsConfig {
  mode: AzureDevOpsDeploymentMode;
  /** Base URL for Azure DevOps organization, e.g. https://dev.azure.com/myOrg or https://myserver/tfs/MyCollection */
  orgUrl: string;
}

/**
 * Resolve Azure DevOps base URL and deployment mode from environment.
 *
 * Env vars:
 * - ADO_MCP_MODE: "cloud" (default) or "onprem"
 * - ADO_MCP_ORG_URL: full base URL to use instead of constructing from org name
 */
export function getAzureDevOpsConfig(orgName: string): AzureDevOpsConfig {
  const rawMode = (process.env.ADO_MCP_MODE || "cloud").toLowerCase();
  const mode: AzureDevOpsDeploymentMode = rawMode === "onprem" ? "onprem" : "cloud";

  let orgUrl: string;
  if (process.env.ADO_MCP_ORG_URL) {
    orgUrl = process.env.ADO_MCP_ORG_URL;
  } else if (mode === "cloud") {
    orgUrl = `https://dev.azure.com/${orgName}`;
  } else {
    // On-prem without explicit URL – fall back to cloud-style URL so behavior is predictable
    orgUrl = `https://dev.azure.com/${orgName}`;
  }

  return { mode, orgUrl };
}

export function createEnumMapping<T extends Record<string, string | number>>(enumObject: T): Record<string, T[keyof T]> {
  const mapping: Record<string, T[keyof T]> = {};
  for (const [key, value] of Object.entries(enumObject)) {
    if (typeof key === "string" && typeof value === "number") {
      mapping[key.toLowerCase()] = value as T[keyof T];
    }
  }
  return mapping;
}

export function mapStringToEnum<T extends Record<string, string | number>>(value: string | undefined, enumObject: T, defaultValue?: T[keyof T]): T[keyof T] | undefined {
  if (!value) return defaultValue;
  const enumMapping = createEnumMapping(enumObject);
  return enumMapping[value.toLowerCase()] ?? defaultValue;
}

/**
 * Maps an array of strings to an array of enum values, filtering out invalid values.
 * @param values Array of string values to map
 * @param enumObject The enum object to map to
 * @returns Array of valid enum values
 */
export function mapStringArrayToEnum<T extends Record<string, string | number>>(values: string[] | undefined, enumObject: T): T[keyof T][] {
  if (!values) return [];
  return values.map((value) => mapStringToEnum(value, enumObject)).filter((v): v is T[keyof T] => v !== undefined);
}

/**
 * Converts a TypeScript numeric enum to an array of string keys for use with z.enum().
 * This ensures that enum schemas generate string values rather than numeric values.
 * @param enumObject The TypeScript enum object
 * @returns Array of string keys from the enum
 */
export function getEnumKeys<T extends Record<string, string | number>>(enumObject: T): string[] {
  return Object.keys(enumObject).filter((key) => isNaN(Number(key)));
}

/**
 * Safely converts a string enum key to its corresponding enum value.
 * Validates that the key exists in the enum before conversion.
 * @param enumObject The TypeScript enum object
 * @param key The string key to convert
 * @returns The enum value if key is valid, undefined otherwise
 */
export function safeEnumConvert<T extends Record<string, string | number>>(enumObject: T, key: string | undefined): T[keyof T] | undefined {
  if (!key) return undefined;

  const validKeys = getEnumKeys(enumObject);
  if (!validKeys.includes(key)) {
    return undefined;
  }

  return enumObject[key as keyof T];
}

/**
 * Encodes `>` and `<` for Markdown formatted fields.
 *
 * @param value The text value to encode
 * @param format The format of the field ('Markdown' or 'Html')
 * @returns The encoded text, or original text if format is not Markdown
 */
export function encodeFormattedValue(value: string, format?: "Markdown" | "Html"): string {
  if (!value || format !== "Markdown") return value;
  const result = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return result;
}
