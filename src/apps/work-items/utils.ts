// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ActiveFilters, ColumnConfig, WorkItem } from "./types.ts";
export { formatAssignedTo, getFieldLabel, getPriorityLabel, renderSafeHtml, isHtmlContent, stripHtml, sanitizeSvg } from "../shared/utils.ts";
import { formatAssignedTo, getPriorityLabel, isHtmlContent, renderSafeHtml } from "../shared/utils.ts";

export const PAGE_SIZE = 10;

export const EMPTY_FILTERS: ActiveFilters = { search: "", state: "", type: "", assignedTo: "", priority: "", tag: "" };

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: "System.Id", label: "ID", width: 80 },
  { field: "System.Title", label: "Title" },
  { field: "System.WorkItemType", label: "Type", width: 80 },
  { field: "System.State", label: "State", width: 90 },
  { field: "System.AssignedTo", label: "Assigned To", width: 130 },
];

/** Sensible default widths for well-known ADO fields (px). Title intentionally omitted — it fills remaining space. */
export const KNOWN_FIELD_WIDTHS: Record<string, number> = {
  "System.Id": 80,
  "System.WorkItemType": 80,
  "System.State": 90,
  "System.AssignedTo": 130,
  "System.Tags": 130,
  "Microsoft.VSTS.Common.Priority": 80,
  "Microsoft.VSTS.Scheduling.StoryPoints": 70,
  "Microsoft.VSTS.Scheduling.OriginalEstimate": 70,
  "Microsoft.VSTS.Scheduling.RemainingWork": 70,
};

export function formatCellValue(field: string, wi: WorkItem): string {
  const value = field === "System.Id" ? (wi.id ?? wi.fields?.["System.Id"]) : wi.fields?.[field];
  if (value === undefined || value === null || value === "") return "";

  if (field === "System.AssignedTo") return formatAssignedTo(value as string | { displayName?: string; uniqueName?: string });
  if (field === "Microsoft.VSTS.Common.Priority") return getPriorityLabel(Number(value));
  if (field.includes("Date")) {
    try {
      return new Date(String(value)).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return String(obj.displayName ?? obj.uniqueName ?? JSON.stringify(value));
  }
  return String(value);
}

export function compareCellValues(field: string, a: WorkItem, b: WorkItem, direction: "asc" | "desc"): number {
  const aVal = field === "System.Id" ? (a.id ?? a.fields?.["System.Id"] ?? 0) : (a.fields?.[field] ?? "");
  const bVal = field === "System.Id" ? (b.id ?? b.fields?.["System.Id"] ?? 0) : (b.fields?.[field] ?? "");
  const dir = direction === "asc" ? 1 : -1;

  if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;

  const toStr = (val: unknown): string => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return String(obj.displayName ?? obj.uniqueName ?? "");
    }
    return String(val);
  };
  const aStr = field === "System.AssignedTo" ? formatAssignedTo(aVal as string | { displayName?: string; uniqueName?: string }) : toStr(aVal);
  const bStr = field === "System.AssignedTo" ? formatAssignedTo(bVal as string | { displayName?: string; uniqueName?: string }) : toStr(bVal);
  return aStr.localeCompare(bStr) * dir;
}

export function getPriorityBadgeClass(priority: number): string {
  const map: Record<number, string> = { 1: "priority-critical", 2: "priority-high", 3: "priority-medium", 4: "priority-low" };
  return map[priority] ?? "priority-default";
}

/** Constructs an Azure DevOps web URL from the work item REST API URL. */
export function getWorkItemWebUrl(wi: WorkItem): string | null {
  if (wi.url) {
    const webUrl = wi.url.replace(/_apis\/wit\/workItems\/\d+/, `_workitems/edit/${getWorkItemId(wi)}`);
    if (webUrl !== wi.url) {
      try {
        const parsed = new URL(webUrl);
        if (parsed.hostname.endsWith(".visualstudio.com") || parsed.hostname.endsWith("dev.azure.com")) {
          return webUrl;
        }
      } catch {
        /* invalid URL */
      }
    }
  }
  return null;
}

export function getStateClass(state: string): string {
  const s = state.toLowerCase().replace(/\s+/g, "");
  const map: Record<string, string> = {
    new: "state-new",
    active: "state-active",
    inprogress: "state-inprogress",
    resolved: "state-resolved",
    closed: "state-closed",
    done: "state-closed",
    removed: "state-removed",
  };
  return map[s] ?? "state-default";
}

export function getWorkItemId(wi: WorkItem): number {
  return wi.id ?? wi.fields?.["System.Id"] ?? 0;
}

/** Fields that are read-only (system-managed) and cannot be updated via the API */
export const READ_ONLY_FIELDS = new Set([
  "System.Id",
  "System.Rev",
  "System.WorkItemType",
  "System.CreatedDate",
  "System.CreatedBy",
  "System.ChangedDate",
  "System.ChangedBy",
  "System.TeamProject",
  "System.AreaId",
  "System.IterationId",
  "System.NodeName",
  "System.BoardColumn",
  "System.BoardColumnDone",
  "System.Watermark",
  "System.AuthorizedAs",
  "System.PersonId",
  "System.AuthorizedDate",
  "System.RevisedDate",
  "System.ExternalLinkCount",
  "System.HyperLinkCount",
  "System.AttachedFileCount",
  "System.RelatedLinkCount",
  "System.CommentCount",
]);

/** Prepare work item fields for edit state - transforms values for editing */
export function prepareEditFields(fields: Record<string, unknown>): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (READ_ONLY_FIELDS.has(field)) continue;
    if (field === "System.AssignedTo") {
      result[field] = formatAssignedTo(value as string | { displayName?: string; uniqueName?: string });
    } else if (isHtmlContent(value)) {
      result[field] = renderSafeHtml(value as string);
    } else if (typeof value === "number") {
      result[field] = value;
    } else if (typeof value === "string") {
      result[field] = value;
    } else if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      result[field] = String(obj.displayName ?? obj.uniqueName ?? JSON.stringify(value));
    } else {
      result[field] = String(value);
    }
  }
  return result;
}

export function generateWiql(
  filters: ActiveFilters,
  ctx?: { project?: string; queryType?: string; iterationPath?: string; areaPath?: string; includeCompleted?: boolean; stateFilter?: string[]; workItemTypeFilter?: string[] }
): string {
  const selectFields = ["[System.Id]", "[System.Title]", "[System.State]", "[System.AssignedTo]", "[System.WorkItemType]"];
  const conditions: string[] = [];

  if (ctx?.project) conditions.push(`[System.TeamProject] = '${ctx.project.replace(/'/g, "''")}'`);

  if (ctx?.queryType === "assignedtome") {
    conditions.push("[System.AssignedTo] = @Me");
  } else if (ctx?.queryType === "myactivity") {
    conditions.push("[System.ChangedBy] = @Me");
  }

  if (ctx?.iterationPath) conditions.push(`[System.IterationPath] UNDER '${ctx.iterationPath.replace(/'/g, "''")}'`);
  if (ctx?.areaPath) conditions.push(`[System.AreaPath] UNDER '${ctx.areaPath.replace(/'/g, "''")}'`);
  if (ctx?.stateFilter?.length) {
    const states = ctx.stateFilter.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ");
    conditions.push(`[System.State] IN (${states})`);
  }
  if (ctx?.workItemTypeFilter?.length) {
    const types = ctx.workItemTypeFilter.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ");
    conditions.push(`[System.WorkItemType] IN (${types})`);
  }

  // UI filters (applied by user in the filter bar)
  if (filters.state) conditions.push(`[System.State] = '${filters.state.replace(/'/g, "''")}'`);
  if (filters.type) conditions.push(`[System.WorkItemType] = '${filters.type.replace(/'/g, "''")}'`);
  if (filters.assignedTo) conditions.push(`[System.AssignedTo] = '${filters.assignedTo.replace(/'/g, "''")}'`);
  if (filters.priority) {
    const priorityMap: Record<string, number> = { Critical: 1, High: 2, Medium: 3, Low: 4 };
    const num = priorityMap[filters.priority];
    if (num) conditions.push(`[Microsoft.VSTS.Common.Priority] = ${num}`);
  }
  if (filters.tag) conditions.push(`[System.Tags] CONTAINS '${filters.tag.replace(/'/g, "''")}'`);
  if (filters.search) conditions.push(`[System.Title] CONTAINS '${filters.search.replace(/'/g, "''")}'`);

  let query = `SELECT ${selectFields.join(", ")}\nFROM WorkItems`;
  if (conditions.length > 0) query += `\nWHERE ${conditions.join("\n  AND ")}`;
  query += `\nORDER BY [System.Id] DESC`;
  return query;
}

export function highlightWiql(wiql: string): string {
  return wiql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|ASC|DESC|CONTAINS|IN|NOT IN|NOT|UNDER|EVER)\b/g, '<span class="kw">$1</span>')
    .replace(/@Me\b/g, '<span class="kw">@Me</span>')
    .replace(/'([^']*)'/g, "<span class=\"str\">'$1'</span>");
}
