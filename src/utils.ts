// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { packageVersion } from "./version.js";

export const apiVersion = "7.2-preview.1";
export const batchApiVersion = "5.0";
export const markdownCommentsApiVersion = "7.2-preview.4";

/**
 * Converts a TypeScript numeric enum to an array of string keys for use with z.enum().
 * This ensures that enum schemas generate string values rather than numeric values.
 * @param enumObject The TypeScript enum object
 * @returns Array of string keys from the enum
 */
export function getEnumKeys<T extends Record<string, string | number>>(enumObject: T): string[] {
  return Object.keys(enumObject).filter((key) => isNaN(Number(key)));
}
