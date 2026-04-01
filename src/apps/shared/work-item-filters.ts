// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Server-side work item filter used by MCP app tools before returning data to the UI. */
export function applyWorkItemFilters(workItems: any[], args: Record<string, any>): any[] {
  let result = workItems;

  if (args.stateFilter && Array.isArray(args.stateFilter) && args.stateFilter.length > 0) {
    const allowed = new Set(args.stateFilter.map((s: string) => s.toLowerCase()));
    result = result.filter((wi) => {
      const state = wi.fields?.["System.State"];
      return state && allowed.has(String(state).toLowerCase());
    });
  }

  if (args.workItemType && Array.isArray(args.workItemType) && args.workItemType.length > 0) {
    const allowed = new Set(args.workItemType.map((t: string) => t.toLowerCase().replace(/\s+/g, "")));
    result = result.filter((wi) => {
      const type = wi.fields?.["System.WorkItemType"];
      return type && allowed.has(String(type).toLowerCase().replace(/\s+/g, ""));
    });
  }

  if (args.assignedTo && Array.isArray(args.assignedTo) && args.assignedTo.length > 0) {
    const patterns = args.assignedTo.map((a: string) => a.toLowerCase());
    result = result.filter((wi) => {
      const assigned = wi.fields?.["System.AssignedTo"];
      if (!assigned) return false;
      const str = typeof assigned === "object" ? `${assigned.displayName ?? ""} ${assigned.uniqueName ?? ""}`.toLowerCase() : String(assigned).toLowerCase();
      return patterns.some((p: string) => str.includes(p));
    });
  }

  if (args.tags && Array.isArray(args.tags) && args.tags.length > 0) {
    const requestedTags = new Set(args.tags.map((t: string) => t.toLowerCase().trim()));
    result = result.filter((wi) => {
      const tagStr = wi.fields?.["System.Tags"];
      if (!tagStr) return false;
      const wiTags = String(tagStr)
        .split(";")
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean);
      return wiTags.some((t: string) => requestedTags.has(t));
    });
  }

  if (args.priorityFilter && Array.isArray(args.priorityFilter) && args.priorityFilter.length > 0) {
    const allowed = new Set(args.priorityFilter.map(Number));
    result = result.filter((wi) => {
      const priority = wi.fields?.["Microsoft.VSTS.Common.Priority"];
      return priority !== undefined && priority !== null && allowed.has(Number(priority));
    });
  }

  if (args.areaPath && typeof args.areaPath === "string" && args.areaPath.trim()) {
    const prefix = args.areaPath.trim().toLowerCase();
    result = result.filter((wi) => {
      const area = wi.fields?.["System.AreaPath"];
      return area && String(area).toLowerCase().startsWith(prefix);
    });
  }

  if (args.iterationPath && typeof args.iterationPath === "string" && args.iterationPath.trim()) {
    const prefix = args.iterationPath.trim().toLowerCase();
    result = result.filter((wi) => {
      const iter = wi.fields?.["System.IterationPath"];
      return iter && String(iter).toLowerCase().startsWith(prefix);
    });
  }

  if (args.searchText && typeof args.searchText === "string" && args.searchText.trim()) {
    const needle = args.searchText.trim().toLowerCase();
    result = result.filter((wi) => {
      const title = String(wi.fields?.["System.Title"] ?? "").toLowerCase();
      const desc = String(wi.fields?.["System.Description"] ?? "").toLowerCase();
      const id = String(wi.fields?.["System.Id"] ?? wi.id ?? "");
      return title.includes(needle) || desc.includes(needle) || id.includes(needle);
    });
  }

  return result;
}
