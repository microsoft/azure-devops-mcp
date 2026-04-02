/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import {
  PAGE_SIZE,
  EMPTY_FILTERS,
  DEFAULT_COLUMNS,
  KNOWN_FIELD_WIDTHS,
  formatCellValue,
  compareCellValues,
  getPriorityBadgeClass,
  getWorkItemWebUrl,
  getStateClass,
  getWorkItemId,
  READ_ONLY_FIELDS,
  prepareEditFields,
  generateWiql,
  highlightWiql,
} from "../../../../src/apps/work-items/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("PAGE_SIZE is a positive number", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });

  it("EMPTY_FILTERS has all empty string values", () => {
    for (const value of Object.values(EMPTY_FILTERS)) {
      expect(value).toBe("");
    }
  });

  it("DEFAULT_COLUMNS includes System.Id, System.Title, System.State", () => {
    const fields = DEFAULT_COLUMNS.map((c) => c.field);
    expect(fields).toContain("System.Id");
    expect(fields).toContain("System.Title");
    expect(fields).toContain("System.State");
  });

  it("KNOWN_FIELD_WIDTHS has numeric width values", () => {
    for (const value of Object.values(KNOWN_FIELD_WIDTHS)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    }
  });

  it("READ_ONLY_FIELDS contains system fields", () => {
    expect(READ_ONLY_FIELDS.has("System.Id")).toBe(true);
    expect(READ_ONLY_FIELDS.has("System.Rev")).toBe(true);
    expect(READ_ONLY_FIELDS.has("System.CreatedDate")).toBe(true);
    expect(READ_ONLY_FIELDS.has("System.Title")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatCellValue
// ---------------------------------------------------------------------------
describe("formatCellValue", () => {
  it("returns empty string for missing fields", () => {
    expect(formatCellValue("System.Title", { id: 1 })).toBe("");
  });

  it("returns ID from wi.id", () => {
    expect(formatCellValue("System.Id", { id: 42 })).toBe("42");
  });

  it("returns ID from fields when wi.id is missing", () => {
    expect(formatCellValue("System.Id", { fields: { "System.Id": 99 } })).toBe("99");
  });

  it("formats assigned to identity object", () => {
    const wi = { id: 1, fields: { "System.AssignedTo": { displayName: "Jane Doe", uniqueName: "jane@test.com" } } };
    expect(formatCellValue("System.AssignedTo", wi)).toBe("Jane Doe");
  });

  it("formats assigned to string", () => {
    const wi = { id: 1, fields: { "System.AssignedTo": "Jane Doe <jane@test.com>" } };
    expect(formatCellValue("System.AssignedTo", wi)).toBe("Jane Doe");
  });

  it("returns priority label for priority field", () => {
    const wi = { id: 1, fields: { "Microsoft.VSTS.Common.Priority": 1 } };
    expect(formatCellValue("Microsoft.VSTS.Common.Priority", wi)).toBe("Critical");
  });

  it("formats date fields", () => {
    const wi = { id: 1, fields: { "System.CreatedDate": "2025-01-15T00:00:00Z" } };
    const result = formatCellValue("System.CreatedDate", wi);
    expect(result).toBeTruthy();
    // Should be a formatted date string, not the raw ISO
    expect(result).not.toBe("2025-01-15T00:00:00Z");
  });

  it("returns string for generic fields", () => {
    const wi = { id: 1, fields: { "System.State": "Active" } };
    expect(formatCellValue("System.State", wi)).toBe("Active");
  });

  it("formats object values with displayName", () => {
    const wi = { id: 1, fields: { "Custom.Reviewer": { displayName: "Jane Doe", uniqueName: "jane@test.com" } } };
    expect(formatCellValue("Custom.Reviewer", wi)).toBe("Jane Doe");
  });

  it("formats object values without displayName using uniqueName", () => {
    const wi = { id: 1, fields: { "Custom.Field": { uniqueName: "user@test.com" } } };
    expect(formatCellValue("Custom.Field", wi)).toBe("user@test.com");
  });

  it("JSON-stringifies object values without displayName or uniqueName", () => {
    const wi = { id: 1, fields: { "Custom.Field": { key: "val" } } };
    expect(formatCellValue("Custom.Field", wi)).toContain("val");
  });
});

// ---------------------------------------------------------------------------
// compareCellValues
// ---------------------------------------------------------------------------
describe("compareCellValues", () => {
  const wiA = { id: 1, fields: { "System.Title": "Alpha", "Microsoft.VSTS.Common.Priority": 1 } };
  const wiB = { id: 2, fields: { "System.Title": "Beta", "Microsoft.VSTS.Common.Priority": 3 } };

  it("sorts by ID ascending", () => {
    expect(compareCellValues("System.Id", wiA, wiB, "asc")).toBeLessThan(0);
  });

  it("sorts by ID descending", () => {
    expect(compareCellValues("System.Id", wiA, wiB, "desc")).toBeGreaterThan(0);
  });

  it("sorts by string field ascending", () => {
    expect(compareCellValues("System.Title", wiA, wiB, "asc")).toBeLessThan(0);
  });

  it("sorts by numeric field ascending", () => {
    expect(compareCellValues("Microsoft.VSTS.Common.Priority", wiA, wiB, "asc")).toBeLessThan(0);
  });

  it("sorts by numeric field descending", () => {
    expect(compareCellValues("Microsoft.VSTS.Common.Priority", wiA, wiB, "desc")).toBeGreaterThan(0);
  });

  it("handles equal values", () => {
    expect(compareCellValues("System.Title", wiA, wiA, "asc")).toBe(0);
  });

  it("sorts by object field values using displayName", () => {
    const wiObjA = { id: 1, fields: { "Custom.Reviewer": { displayName: "Alice", uniqueName: "alice@test.com" } } };
    const wiObjB = { id: 2, fields: { "Custom.Reviewer": { displayName: "Bob", uniqueName: "bob@test.com" } } };
    expect(compareCellValues("Custom.Reviewer", wiObjA, wiObjB, "asc")).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// getPriorityBadgeClass
// ---------------------------------------------------------------------------
describe("getPriorityBadgeClass", () => {
  it("returns correct class for each priority", () => {
    expect(getPriorityBadgeClass(1)).toBe("priority-critical");
    expect(getPriorityBadgeClass(2)).toBe("priority-high");
    expect(getPriorityBadgeClass(3)).toBe("priority-medium");
    expect(getPriorityBadgeClass(4)).toBe("priority-low");
  });

  it("returns default for unknown priority", () => {
    expect(getPriorityBadgeClass(0)).toBe("priority-default");
    expect(getPriorityBadgeClass(5)).toBe("priority-default");
  });
});

// ---------------------------------------------------------------------------
// getStateClass
// ---------------------------------------------------------------------------
describe("getStateClass", () => {
  it("returns correct class for known states", () => {
    expect(getStateClass("New")).toBe("state-new");
    expect(getStateClass("Active")).toBe("state-active");
    expect(getStateClass("Resolved")).toBe("state-resolved");
    expect(getStateClass("Closed")).toBe("state-closed");
    expect(getStateClass("Done")).toBe("state-closed");
    expect(getStateClass("Removed")).toBe("state-removed");
  });

  it("returns default for unknown states", () => {
    expect(getStateClass("Custom")).toBe("state-default");
  });

  it("handles In Progress (whitespace collapsed)", () => {
    expect(getStateClass("In Progress")).toBe("state-inprogress");
  });
});

// ---------------------------------------------------------------------------
// getWorkItemId
// ---------------------------------------------------------------------------
describe("getWorkItemId", () => {
  it("returns wi.id when present", () => {
    expect(getWorkItemId({ id: 42 })).toBe(42);
  });

  it("falls back to fields System.Id", () => {
    expect(getWorkItemId({ fields: { "System.Id": 99 } })).toBe(99);
  });

  it("returns 0 when no id available", () => {
    expect(getWorkItemId({})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getWorkItemWebUrl
// ---------------------------------------------------------------------------
describe("getWorkItemWebUrl", () => {
  it("converts REST API URL to web URL", () => {
    const wi = { id: 42, url: "https://dev.azure.com/org/proj/_apis/wit/workItems/42" };
    const result = getWorkItemWebUrl(wi);
    expect(result).toBe("https://dev.azure.com/org/proj/_workitems/edit/42");
  });

  it("converts visualstudio.com REST API URL to web URL", () => {
    const wi = { id: 10, url: "https://org.visualstudio.com/proj/_apis/wit/workItems/10" };
    expect(getWorkItemWebUrl(wi)).toBe("https://org.visualstudio.com/proj/_workitems/edit/10");
  });

  it("returns null for non-ADO domain even if URL pattern matches", () => {
    const wi = { id: 1, url: "https://evil.com/proj/_apis/wit/workItems/1" };
    expect(getWorkItemWebUrl(wi)).toBeNull();
  });

  it("returns null when no url", () => {
    expect(getWorkItemWebUrl({ id: 1 })).toBeNull();
  });

  it("returns null when url doesn't match pattern", () => {
    expect(getWorkItemWebUrl({ id: 1, url: "https://example.com/other" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// prepareEditFields
// ---------------------------------------------------------------------------
describe("prepareEditFields", () => {
  it("skips read-only fields", () => {
    const result = prepareEditFields({ "System.Id": 1, "System.Title": "Test", "System.Rev": 5 });
    expect(result["System.Title"]).toBe("Test");
    expect(result["System.Id"]).toBeUndefined();
    expect(result["System.Rev"]).toBeUndefined();
  });

  it("skips null/undefined values", () => {
    const result = prepareEditFields({ "System.Title": "Test", "System.Description": null as any });
    expect(result["System.Title"]).toBe("Test");
    expect(result["System.Description"]).toBeUndefined();
  });

  it("formats assigned to identity object", () => {
    const result = prepareEditFields({
      "System.AssignedTo": { displayName: "Jane", uniqueName: "jane@test.com" },
    });
    expect(result["System.AssignedTo"]).toBe("Jane");
  });

  it("preserves numeric values", () => {
    const result = prepareEditFields({ "Microsoft.VSTS.Common.Priority": 2 });
    expect(result["Microsoft.VSTS.Common.Priority"]).toBe(2);
  });

  it("preserves string values", () => {
    const result = prepareEditFields({ "System.State": "Active" });
    expect(result["System.State"]).toBe("Active");
  });

  it("sanitizes HTML content fields", () => {
    const result = prepareEditFields({ "System.Description": "<p>Hello <strong>world</strong></p>" });
    expect(result["System.Description"]).toContain("Hello");
    expect(result["System.Description"]).toContain("strong");
  });

  it("formats object fields with displayName", () => {
    const result = prepareEditFields({ "Custom.Reviewer": { displayName: "Bob", uniqueName: "bob@test.com" } });
    expect(result["Custom.Reviewer"]).toBe("Bob");
  });

  it("formats object fields without displayName using uniqueName", () => {
    const result = prepareEditFields({ "Custom.Reviewer": { uniqueName: "bob@test.com" } });
    expect(result["Custom.Reviewer"]).toBe("bob@test.com");
  });

  it("converts boolean values to string", () => {
    const result = prepareEditFields({ "Custom.Flag": true as any });
    expect(result["Custom.Flag"]).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// generateWiql
// ---------------------------------------------------------------------------
describe("generateWiql", () => {
  it("generates basic SELECT query", () => {
    const wiql = generateWiql(EMPTY_FILTERS);
    expect(wiql).toContain("SELECT");
    expect(wiql).toContain("FROM WorkItems");
    expect(wiql).toContain("ORDER BY [System.Id] DESC");
  });

  it("adds project condition", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { project: "MyProject" });
    expect(wiql).toContain("[System.TeamProject] = 'MyProject'");
  });

  it("adds @Me for assignedtome query type", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { queryType: "assignedtome" });
    expect(wiql).toContain("[System.AssignedTo] = @Me");
  });

  it("adds @Me for myactivity query type", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { queryType: "myactivity" });
    expect(wiql).toContain("[System.ChangedBy] = @Me");
  });

  it("adds iteration path UNDER clause", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { iterationPath: "Project\\Sprint 1" });
    expect(wiql).toContain("[System.IterationPath] UNDER 'Project\\Sprint 1'");
  });

  it("adds area path UNDER clause", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { areaPath: "Project\\Team" });
    expect(wiql).toContain("[System.AreaPath] UNDER 'Project\\Team'");
  });

  it("adds state filter from context", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { stateFilter: ["Active", "New"] });
    expect(wiql).toContain("[System.State] IN ('Active', 'New')");
  });

  it("adds work item type filter from context", () => {
    const wiql = generateWiql(EMPTY_FILTERS, { workItemTypeFilter: ["Bug", "Task"] });
    expect(wiql).toContain("[System.WorkItemType] IN ('Bug', 'Task')");
  });

  it("adds UI filter for state", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, state: "Active" });
    expect(wiql).toContain("[System.State] = 'Active'");
  });

  it("adds UI filter for type", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, type: "Bug" });
    expect(wiql).toContain("[System.WorkItemType] = 'Bug'");
  });

  it("adds UI filter for priority", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, priority: "Critical" });
    expect(wiql).toContain("[Microsoft.VSTS.Common.Priority] = 1");
  });

  it("adds UI filter for tag", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, tag: "frontend" });
    expect(wiql).toContain("[System.Tags] CONTAINS 'frontend'");
  });

  it("adds UI filter for search", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, search: "login" });
    expect(wiql).toContain("[System.Title] CONTAINS 'login'");
  });

  it("escapes single quotes in values", () => {
    const wiql = generateWiql({ ...EMPTY_FILTERS, state: "O'Brien" });
    expect(wiql).toContain("O''Brien");
  });
});

// ---------------------------------------------------------------------------
// highlightWiql
// ---------------------------------------------------------------------------
describe("highlightWiql", () => {
  it("wraps SQL keywords in span.kw", () => {
    const result = highlightWiql("SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'");
    expect(result).toContain('<span class="kw">SELECT</span>');
    expect(result).toContain('<span class="kw">FROM</span>');
    expect(result).toContain('<span class="kw">WHERE</span>');
  });

  it("wraps @Me in span.kw", () => {
    const result = highlightWiql("[System.AssignedTo] = @Me");
    expect(result).toContain('<span class="kw">@Me</span>');
  });

  it("wraps string literals in span.str", () => {
    const result = highlightWiql("[System.State] = 'Active'");
    expect(result).toContain("<span class=\"str\">'Active'</span>");
  });

  it("escapes HTML characters", () => {
    const result = highlightWiql("<script>alert('xss')</script>");
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });
});
