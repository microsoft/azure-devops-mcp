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

/** Derive a readable foreground color (black or white) for a given hex background. */
function contrastFg(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // W3C relative luminance threshold
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1a1a1a" : "#fff";
}

/** Get bg/fg colors for a work item type.
 *  Uses the dynamic color from the ADO API if provided, otherwise falls back to a deterministic HSL hash. */
export function colorForType(type: string, apiColor?: string): { bg: string; fg: string } {
  if (apiColor) {
    const bg = apiColor.startsWith("#") ? apiColor : `#${apiColor}`;
    return { bg, fg: contrastFg(bg) };
  }
  const key = type.toLowerCase().replace(/\s+/g, "");
  const known = TYPE_COLORS[key];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return { bg: `hsl(${hue}, 55%, 45%)`, fg: "#fff" };
}

/** Normalize editor HTML for ADO comments: convert <p> to <div>, fill empty <div>s with <br>. */
export function normalizeAdoHtml(html: string): string {
  if (!html) return html;
  let result = html;
  if (/<\/p>/i.test(result)) {
    result = result.replace(/<p([^>]*)>/gi, "<div$1>").replace(/<\/p>/gi, "</div>");
  }
  return result.replace(/<div><\/div>/gi, "<div><br></div>");
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
