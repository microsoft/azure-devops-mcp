// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export type { ContentItem, ColumnConfig } from "../shared/types.ts";
import type { ColumnConfig } from "../shared/types.ts";

export interface WorkItemFields {
  "System.Id"?: number;
  "System.Title"?: string;
  "System.State"?: string;
  "System.WorkItemType"?: string;
  "System.AssignedTo"?: string | { displayName?: string; uniqueName?: string };
  "System.Tags"?: string;
  "System.AreaPath"?: string;
  "System.IterationPath"?: string;
  "System.CreatedDate"?: string;
  "System.ChangedDate"?: string;
  "System.Description"?: string;
  "Microsoft.VSTS.Common.Priority"?: number;
  "Microsoft.VSTS.Common.AcceptanceCriteria"?: string;
  "Microsoft.VSTS.TCM.ReproSteps"?: string;
  "Microsoft.VSTS.TCM.SystemInfo"?: string;
  "Microsoft.VSTS.Common.Severity"?: string;
  "Microsoft.VSTS.Common.Activity"?: string;
  "Microsoft.VSTS.Common.ValueArea"?: string;
  "Microsoft.VSTS.Scheduling.StoryPoints"?: number;
  "Microsoft.VSTS.Scheduling.RemainingWork"?: number;
  "Microsoft.VSTS.Scheduling.CompletedWork"?: number;
  "Microsoft.VSTS.Scheduling.OriginalEstimate"?: number;
  "Microsoft.VSTS.Common.FoundIn"?: string;
  "Microsoft.VSTS.Build.IntegrationBuild"?: string;
  "Microsoft.VSTS.Common.Risk"?: string;
  "System.Reason"?: string;
  [key: string]: unknown;
}

export interface WorkItem {
  id?: number;
  fields?: WorkItemFields;
  url?: string;
}

export interface ActiveFilters {
  search: string;
  state: string;
  type: string;
  assignedTo: string;
  priority: string;
  tag: string;
}

export interface QueryContext {
  project?: string;
  queryType?: string;
  iterationPath?: string;
  areaPath?: string;
  includeCompleted?: boolean;
  team?: string;
  iterationId?: string;
  stateFilter?: string[];
  workItemTypeFilter?: string[];
}

export interface EditState {
  id: number;
  fields: Record<string, string | number>;
  saving: boolean;
  statusMsg: string;
  statusType: "success" | "error" | "";
}

export interface WorkItemTypeState {
  name: string;
  color: string;
  category: string;
}

export interface WorkItemTypeMetadata {
  states: WorkItemTypeState[];
  transitions: Record<string, Array<{ to: string }>>;
}

export interface FilterOptions {
  states: string[];
  types: string[];
  assignees: string[];
  priorities: string[];
  tags: string[];
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface SuggestedValue {
  workItemId: number;
  field: string;
  value: string | number;
  reason?: string;
}

export interface DisplayConfig {
  columns?: ColumnConfig[];
  sort?: SortConfig;
  suggestedValues?: SuggestedValue[];
  pageSize?: number;
}
