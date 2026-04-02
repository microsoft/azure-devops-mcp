// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Content item from an MCP tool result. */
export interface ContentItem {
  type: string;
  text?: string;
}

/** Column configuration for work item tables. */
export interface ColumnConfig {
  field: string;
  label?: string;
  width?: number;
}

/** Field definition from a work item type. */
export interface FieldInfo {
  referenceName: string;
  name: string;
  type: number;
  allowedValues: string[];
  alwaysRequired: boolean;
}

/** Iteration/sprint info from the project. */
export interface IterationInfo {
  id: string;
  name: string;
  path: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
    timeFrame?: string;
  };
}

/** Area path info from the project. */
export interface AreaInfo {
  id: string;
  name: string;
  path: string;
}
