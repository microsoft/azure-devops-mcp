// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Canonical ADO work item type colors — shared across all MCP apps. */
export const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  bug: { bg: "#cc293d", fg: "#fff" },
  task: { bg: "#f2cb1d", fg: "#1a1a1a" },
  userstory: { bg: "#009ccc", fg: "#fff" },
  feature: { bg: "#773b93", fg: "#fff" },
  epic: { bg: "#ff7b00", fg: "#fff" },
  issue: { bg: "#b4009e", fg: "#fff" },
  testcase: { bg: "#004b50", fg: "#fff" },
  testplan: { bg: "#004b50", fg: "#fff" },
  testsuite: { bg: "#004b50", fg: "#fff" },
};

/** Canonical ADO state colors — shared across all MCP apps. */
export const STATE_COLORS: Record<string, string> = {
  "new": "#3b82f6",
  "active": "#eab308",
  "in progress": "#f97316",
  "resolved": "#22c55e",
  "closed": "#6b7280",
  "done": "#6b7280",
  "removed": "#cc293d",
  "committed": "#2563eb",
  "approved": "#7c3aed",
  "design": "#8b5cf6",
};

/** Canonical ADO priority colors — shared across all MCP apps. */
export const PRIORITY_COLORS: Record<number, string> = {
  1: "#cc293d",
  2: "#ff7b00",
  3: "#eab308",
  4: "#22c55e",
};

/** Get bg/fg colors for a work item type. Falls back to deterministic HSL hash. */
export function colorForType(type: string): { bg: string; fg: string } {
  const key = type.toLowerCase().replace(/\s+/g, "");
  const known = TYPE_COLORS[key];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return { bg: `hsl(${hue}, 55%, 45%)`, fg: "#fff" };
}

const FIELD_LABELS: Record<string, string> = {
  "System.Id": "ID",
  "System.Title": "Title",
  "System.WorkItemType": "Type",
  "System.State": "State",
  "System.AssignedTo": "Assigned To",
  "System.Tags": "Tags",
  "System.AreaPath": "Area Path",
  "System.IterationPath": "Iteration Path",
  "System.CreatedDate": "Created",
  "System.ChangedDate": "Changed",
  "System.Description": "Description",
  "System.Reason": "Reason",
  "Microsoft.VSTS.Common.Priority": "Priority",
  "Microsoft.VSTS.Common.Severity": "Severity",
  "Microsoft.VSTS.Common.Activity": "Activity",
  "Microsoft.VSTS.Common.ValueArea": "Value Area",
  "Microsoft.VSTS.Scheduling.StoryPoints": "Story Points",
  "Microsoft.VSTS.Scheduling.RemainingWork": "Remaining Work",
  "Microsoft.VSTS.Scheduling.CompletedWork": "Completed Work",
  "Microsoft.VSTS.Scheduling.OriginalEstimate": "Original Estimate",
  "Microsoft.VSTS.Common.AcceptanceCriteria": "Acceptance Criteria",
  "Microsoft.VSTS.TCM.ReproSteps": "Reproduction Steps",
  "Microsoft.VSTS.TCM.SystemInfo": "System Info",
  "Microsoft.VSTS.Common.FoundIn": "Found In",
  "Microsoft.VSTS.Build.IntegrationBuild": "Integration Build",
  "Microsoft.VSTS.Common.Risk": "Risk",
};

export function getFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const suffix = field.split(".").pop() ?? field;
  return suffix
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return "Critical";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return `P${priority}`;
  }
}

export function formatAssignedTo(value: string | { displayName?: string; uniqueName?: string } | undefined): string {
  if (!value) return "Unassigned";
  if (typeof value === "string") {
    const match = value.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : value;
  }
  return value.displayName ?? value.uniqueName ?? "Unassigned";
}

export function renderSafeHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("script, style, link").forEach((el) => el.remove());
  tmp.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("on") || attr.name === "style") el.removeAttribute(attr.name);
    }
  });
  return tmp.innerHTML;
}

export function isHtmlContent(value: unknown): boolean {
  return typeof value === "string" && /<(?:p|div|span|br|ul|ol|li|h[1-6]|table|tr|td|th|a|img|strong|em|b|i|u|s|blockquote|pre|code|hr)\b/i.test(value);
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? "";
}
