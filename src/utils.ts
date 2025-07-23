// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { packageVersion } from "./version.js";

export const apiVersion = "7.2-preview.1";
export const batchApiVersion = "5.0";
export const markdownCommentsApiVersion = "7.2-preview.4";

export function createEnumMapping<T extends Record<string, string | number>>(enumObject: T, keyTransform?: (key: string) => string): Record<string, T[keyof T]> {
  const mapping: Record<string, T[keyof T]> = {};
  for (const [key, value] of Object.entries(enumObject)) {
    if (typeof key === "string" && typeof value === "number") {
      mapping[keyTransform ? keyTransform(key) : key.toLowerCase()] = value as T[keyof T];
    }
  }
  return mapping;
}

export function mapStringToEnum<T>(value: string | undefined, enumMapping: Record<string, T>, defaultValue?: T): T | undefined {
  if (!value) return defaultValue;
  return enumMapping[value.toLowerCase()] ?? defaultValue;
}
