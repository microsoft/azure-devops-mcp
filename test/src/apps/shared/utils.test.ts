/**
 * @jest-environment jsdom
 */

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import {
  TYPE_COLORS,
  STATE_COLORS,
  PRIORITY_COLORS,
  colorForType,
  getFieldLabel,
  getPriorityLabel,
  formatAssignedTo,
  isHtmlContent,
  renderSafeHtml,
  stripHtml,
} from "../../../../src/apps/shared/utils";

// ---------------------------------------------------------------------------
// colorForType
// ---------------------------------------------------------------------------
describe("colorForType", () => {
  it("returns known color for 'Bug'", () => {
    expect(colorForType("Bug")).toEqual(TYPE_COLORS["bug"]);
  });

  it("returns known color for 'Task'", () => {
    expect(colorForType("Task")).toEqual(TYPE_COLORS["task"]);
  });

  it("returns known color for 'User Story' (with space)", () => {
    expect(colorForType("User Story")).toEqual(TYPE_COLORS["userstory"]);
  });

  it("is case-insensitive", () => {
    expect(colorForType("BUG")).toEqual(TYPE_COLORS["bug"]);
    expect(colorForType("feature")).toEqual(TYPE_COLORS["feature"]);
    expect(colorForType("EPIC")).toEqual(TYPE_COLORS["epic"]);
  });

  it("strips whitespace before lookup", () => {
    expect(colorForType("Test Case")).toEqual(TYPE_COLORS["testcase"]);
    expect(colorForType("Test Suite")).toEqual(TYPE_COLORS["testsuite"]);
    expect(colorForType("Test Plan")).toEqual(TYPE_COLORS["testplan"]);
  });

  it("returns all known types correctly", () => {
    for (const [key, value] of Object.entries(TYPE_COLORS)) {
      expect(colorForType(key)).toEqual(value);
    }
  });

  it("returns deterministic HSL hash for unknown types", () => {
    const result = colorForType("CustomWorkItemType");
    expect(result.bg).toMatch(/^hsl\(\d+, 55%, 45%\)$/);
    expect(result.fg).toBe("#fff");
  });

  it("returns same HSL hash for same unknown type", () => {
    const first = colorForType("SomeUnknownType");
    const second = colorForType("SomeUnknownType");
    expect(first).toEqual(second);
  });

  it("returns different HSL hash for different unknown types", () => {
    const a = colorForType("TypeA");
    const b = colorForType("TypeB");
    // Different inputs should (usually) produce different hues
    expect(a.bg).not.toBe(b.bg);
  });
});

// ---------------------------------------------------------------------------
// getFieldLabel
// ---------------------------------------------------------------------------
describe("getFieldLabel", () => {
  it("returns known label for System.Id", () => {
    expect(getFieldLabel("System.Id")).toBe("ID");
  });

  it("returns known label for System.Title", () => {
    expect(getFieldLabel("System.Title")).toBe("Title");
  });

  it("returns known label for System.WorkItemType", () => {
    expect(getFieldLabel("System.WorkItemType")).toBe("Type");
  });

  it("returns known label for System.AssignedTo", () => {
    expect(getFieldLabel("System.AssignedTo")).toBe("Assigned To");
  });

  it("returns known label for Microsoft.VSTS.Common.Priority", () => {
    expect(getFieldLabel("Microsoft.VSTS.Common.Priority")).toBe("Priority");
  });

  it("returns known label for Microsoft.VSTS.Scheduling.StoryPoints", () => {
    expect(getFieldLabel("Microsoft.VSTS.Scheduling.StoryPoints")).toBe("Story Points");
  });

  it("converts camelCase suffix for unknown fields", () => {
    expect(getFieldLabel("Custom.MyCustomField")).toBe("My Custom Field");
  });

  it("converts PascalCase suffix for unknown fields", () => {
    expect(getFieldLabel("Custom.StoryPoints")).toBe("Story Points");
  });

  it("converts underscore-separated suffixes", () => {
    expect(getFieldLabel("Custom.my_field_name")).toBe("My field name");
  });

  it("converts hyphen-separated suffixes", () => {
    expect(getFieldLabel("Custom.my-field-name")).toBe("My field name");
  });

  it("handles single-segment field name", () => {
    expect(getFieldLabel("Title")).toBe("Title");
  });

  it("capitalizes first letter of derived label", () => {
    expect(getFieldLabel("custom.lowercaseField")).toBe("Lowercase Field");
  });

  it("handles consecutive uppercase letters", () => {
    expect(getFieldLabel("Custom.HTMLContent")).toBe("HTML Content");
  });
});

// ---------------------------------------------------------------------------
// getPriorityLabel
// ---------------------------------------------------------------------------
describe("getPriorityLabel", () => {
  it("returns 'Critical' for priority 1", () => {
    expect(getPriorityLabel(1)).toBe("Critical");
  });

  it("returns 'High' for priority 2", () => {
    expect(getPriorityLabel(2)).toBe("High");
  });

  it("returns 'Medium' for priority 3", () => {
    expect(getPriorityLabel(3)).toBe("Medium");
  });

  it("returns 'Low' for priority 4", () => {
    expect(getPriorityLabel(4)).toBe("Low");
  });

  it("returns 'P5' for priority 5 (unknown)", () => {
    expect(getPriorityLabel(5)).toBe("P5");
  });

  it("returns 'P0' for priority 0", () => {
    expect(getPriorityLabel(0)).toBe("P0");
  });

  it("returns 'P99' for large priority values", () => {
    expect(getPriorityLabel(99)).toBe("P99");
  });
});

// ---------------------------------------------------------------------------
// formatAssignedTo
// ---------------------------------------------------------------------------
describe("formatAssignedTo", () => {
  it("returns 'Unassigned' for undefined", () => {
    expect(formatAssignedTo(undefined)).toBe("Unassigned");
  });

  it("returns 'Unassigned' for null", () => {
    expect(formatAssignedTo(null as unknown as undefined)).toBe("Unassigned");
  });

  it("returns 'Unassigned' for empty string", () => {
    expect(formatAssignedTo("")).toBe("Unassigned");
  });

  it("returns plain string name as-is", () => {
    expect(formatAssignedTo("Jane Doe")).toBe("Jane Doe");
  });

  it("extracts display name from email-format string", () => {
    expect(formatAssignedTo("Jane Doe <jane@example.com>")).toBe("Jane Doe");
  });

  it("trims whitespace from extracted display name", () => {
    expect(formatAssignedTo("  Jane Doe  <jane@example.com>")).toBe("Jane Doe");
  });

  it("returns displayName from object", () => {
    expect(formatAssignedTo({ displayName: "Jamal Hartnett" })).toBe("Jamal Hartnett");
  });

  it("falls back to uniqueName when displayName is missing", () => {
    expect(formatAssignedTo({ uniqueName: "jamal@example.com" })).toBe("jamal@example.com");
  });

  it("returns 'Unassigned' when object has neither displayName nor uniqueName", () => {
    expect(formatAssignedTo({} as { displayName?: string; uniqueName?: string })).toBe("Unassigned");
  });

  it("prefers displayName over uniqueName", () => {
    expect(formatAssignedTo({ displayName: "Jane", uniqueName: "jane@example.com" })).toBe("Jane");
  });
});

// ---------------------------------------------------------------------------
// isHtmlContent
// ---------------------------------------------------------------------------
describe("isHtmlContent", () => {
  it("returns true for string with <div>", () => {
    expect(isHtmlContent("<div>hello</div>")).toBe(true);
  });

  it("returns true for string with <p>", () => {
    expect(isHtmlContent("<p>paragraph</p>")).toBe(true);
  });

  it("returns true for string with <br>", () => {
    expect(isHtmlContent("line1<br>line2")).toBe(true);
  });

  it("returns true for string with <strong>", () => {
    expect(isHtmlContent("<strong>bold</strong>")).toBe(true);
  });

  it("returns true for string with <table>", () => {
    expect(isHtmlContent("<table><tr><td>cell</td></tr></table>")).toBe(true);
  });

  it("returns true for string with <a> tag", () => {
    expect(isHtmlContent('<a href="#">link</a>')).toBe(true);
  });

  it("returns true for string with <img>", () => {
    expect(isHtmlContent('<img src="test.png" />')).toBe(true);
  });

  it("returns true for string with heading tags", () => {
    expect(isHtmlContent("<h1>Title</h1>")).toBe(true);
    expect(isHtmlContent("<h6>Sub</h6>")).toBe(true);
  });

  it("returns true for <pre> and <code>", () => {
    expect(isHtmlContent("<pre>code</pre>")).toBe(true);
    expect(isHtmlContent("<code>inline</code>")).toBe(true);
  });

  it("returns true for <blockquote>", () => {
    expect(isHtmlContent("<blockquote>quote</blockquote>")).toBe(true);
  });

  it("returns true for <hr>", () => {
    expect(isHtmlContent("<hr>")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("just plain text")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isHtmlContent("")).toBe(false);
  });

  it("returns false for non-string types", () => {
    expect(isHtmlContent(42)).toBe(false);
    expect(isHtmlContent(null)).toBe(false);
    expect(isHtmlContent(undefined)).toBe(false);
    expect(isHtmlContent({})).toBe(false);
  });

  it("returns false for HTML-like text without matching tags", () => {
    expect(isHtmlContent("Use <angle> brackets")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Constant maps
// ---------------------------------------------------------------------------
describe("constant maps", () => {
  it("STATE_COLORS contains expected states", () => {
    expect(STATE_COLORS["new"]).toBeDefined();
    expect(STATE_COLORS["active"]).toBeDefined();
    expect(STATE_COLORS["closed"]).toBeDefined();
    expect(STATE_COLORS["done"]).toBeDefined();
    expect(STATE_COLORS["in progress"]).toBeDefined();
    expect(STATE_COLORS["resolved"]).toBeDefined();
  });

  it("PRIORITY_COLORS contains priorities 1-4", () => {
    expect(PRIORITY_COLORS[1]).toBeDefined();
    expect(PRIORITY_COLORS[2]).toBeDefined();
    expect(PRIORITY_COLORS[3]).toBeDefined();
    expect(PRIORITY_COLORS[4]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// renderSafeHtml (requires jsdom)
// ---------------------------------------------------------------------------
describe("renderSafeHtml", () => {
  it("returns safe HTML without script tags", () => {
    const result = renderSafeHtml('<div>Hello</div><script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
  });

  it("removes style tags", () => {
    const result = renderSafeHtml("<div>Text</div><style>body{color:red}</style>");
    expect(result).not.toContain("<style>");
    expect(result).toContain("Text");
  });

  it("removes link tags", () => {
    const result = renderSafeHtml('<link rel="stylesheet" href="evil.css"><div>Safe</div>');
    expect(result).not.toContain("<link");
    expect(result).toContain("Safe");
  });

  it("removes inline event handlers", () => {
    const result = renderSafeHtml('<div onclick="alert(1)">Click</div>');
    expect(result).not.toContain("onclick");
    expect(result).toContain("Click");
  });

  it("removes onmouseover event handlers", () => {
    const result = renderSafeHtml('<span onmouseover="steal()">Hover</span>');
    expect(result).not.toContain("onmouseover");
  });

  it("removes inline style attributes", () => {
    const result = renderSafeHtml('<div style="background:url(evil)">Styled</div>');
    expect(result).not.toContain("style=");
    expect(result).toContain("Styled");
  });

  it("preserves safe attributes like class and id", () => {
    const result = renderSafeHtml('<div class="safe" id="content">Text</div>');
    expect(result).toContain('class="safe"');
    expect(result).toContain('id="content"');
  });

  it("preserves nested safe HTML structure", () => {
    const result = renderSafeHtml("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
    expect(result).toContain("Item 1");
  });

  it("handles empty input", () => {
    const result = renderSafeHtml("");
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// stripHtml (requires jsdom)
// ---------------------------------------------------------------------------
describe("stripHtml", () => {
  it("strips all HTML tags and returns text content", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns empty string for falsy input", () => {
    expect(stripHtml(null as unknown as string)).toBe("");
    expect(stripHtml(undefined as unknown as string)).toBe("");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><ul><li>Item</li></ul></div>")).toBe("Item");
  });

  it("handles multiple block elements", () => {
    const result = stripHtml("<div>Line 1</div><div>Line 2</div>");
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("handles entities in HTML", () => {
    expect(stripHtml("<p>&amp; &lt; &gt;</p>")).toBe("& < >");
  });

  it("preserves plain text without tags", () => {
    expect(stripHtml("no tags here")).toBe("no tags here");
  });
});
