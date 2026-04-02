/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { colorForType, normalizeAdoHtml, getFieldLabel, formatAssignedTo, getPriorityLabel, renderSafeHtml, isHtmlContent, stripHtml, sanitizeSvg } from "../../../../src/apps/shared/utils";

// ---------------------------------------------------------------------------
// colorForType
// ---------------------------------------------------------------------------
describe("colorForType", () => {
  describe("with API color", () => {
    it("uses the provided hex color as background", () => {
      const result = colorForType("Bug", "#CC293D");
      expect(result.bg).toBe("#CC293D");
    });

    it("adds # prefix if missing", () => {
      const result = colorForType("Bug", "CC293D");
      expect(result.bg).toBe("#CC293D");
    });

    it("returns white foreground for dark backgrounds", () => {
      const result = colorForType("Bug", "#CC293D");
      expect(result.fg).toBe("#fff");
    });

    it("returns dark foreground for light backgrounds", () => {
      const result = colorForType("Task", "#F2CB1D");
      expect(result.fg).toBe("#1a1a1a");
    });

    it("computes correct contrast for mid-range colors", () => {
      const dark = colorForType("Epic", "#004B50");
      expect(dark.fg).toBe("#fff");

      const light = colorForType("Item", "#AADDAA");
      expect(light.fg).toBe("#1a1a1a");
    });
  });

  describe("without API color (fallback)", () => {
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
      expect(a.bg).not.toBe(b.bg);
    });

    it("returns known color or HSL when apiColor is undefined", () => {
      const result = colorForType("Feature", undefined);
      // "Feature" is now a known type with a static color
      expect(result.bg).toBe("#773b93");
    });
  });
});

// ---------------------------------------------------------------------------
// normalizeAdoHtml
// ---------------------------------------------------------------------------
describe("normalizeAdoHtml", () => {
  it("returns falsy input as-is", () => {
    expect(normalizeAdoHtml("")).toBe("");
    expect(normalizeAdoHtml(null as unknown as string)).toBe(null);
  });

  it("converts <p> tags to <div> tags", () => {
    expect(normalizeAdoHtml("<p>Hello</p>")).toBe("<div>Hello</div>");
  });

  it("converts multiple <p> tags", () => {
    expect(normalizeAdoHtml("<p>First</p><p>Second</p>")).toBe("<div>First</div><div>Second</div>");
  });

  it("preserves <p> attributes when converting to <div>", () => {
    expect(normalizeAdoHtml('<p class="intro">Text</p>')).toBe('<div class="intro">Text</div>');
  });

  it("converts empty <div></div> to <div><br></div>", () => {
    expect(normalizeAdoHtml("<div></div>")).toBe("<div><br></div>");
  });

  it("does not modify non-empty divs", () => {
    expect(normalizeAdoHtml("<div>Content</div>")).toBe("<div>Content</div>");
  });

  it("leaves HTML without <p> or empty <div> unchanged", () => {
    expect(normalizeAdoHtml("<div>Hello</div>")).toBe("<div>Hello</div>");
  });
});

// ---------------------------------------------------------------------------
// getFieldLabel
// ---------------------------------------------------------------------------
describe("getFieldLabel", () => {
  it("returns known label for mapped fields", () => {
    expect(getFieldLabel("System.Title")).toBe("Title");
    expect(getFieldLabel("System.State")).toBe("State");
    expect(getFieldLabel("Microsoft.VSTS.Common.Priority")).toBe("Priority");
  });

  it("derives label from camelCase field suffix", () => {
    expect(getFieldLabel("Custom.StoryPoints")).toBe("Story Points");
  });

  it("derives label from PascalCase acronyms", () => {
    expect(getFieldLabel("Custom.HTMLContent")).toBe("HTML Content");
  });

  it("handles underscores and hyphens", () => {
    expect(getFieldLabel("Custom.my_field-name")).toBe("My field name");
  });

  it("handles single-segment field name", () => {
    expect(getFieldLabel("Title")).toBe("Title");
  });
});

// ---------------------------------------------------------------------------
// getPriorityLabel
// ---------------------------------------------------------------------------
describe("getPriorityLabel", () => {
  it("returns labels for known priorities", () => {
    expect(getPriorityLabel(1)).toBe("Critical");
    expect(getPriorityLabel(2)).toBe("High");
    expect(getPriorityLabel(3)).toBe("Medium");
    expect(getPriorityLabel(4)).toBe("Low");
  });

  it("returns fallback for unknown priority", () => {
    expect(getPriorityLabel(5)).toBe("P5");
    expect(getPriorityLabel(0)).toBe("P0");
  });
});

// ---------------------------------------------------------------------------
// formatAssignedTo
// ---------------------------------------------------------------------------
describe("formatAssignedTo", () => {
  it("returns Unassigned for falsy values", () => {
    expect(formatAssignedTo(undefined)).toBe("Unassigned");
    expect(formatAssignedTo("")).toBe("Unassigned");
  });

  it("extracts display name from email format string", () => {
    expect(formatAssignedTo("Jane Doe <jane@test.com>")).toBe("Jane Doe");
  });

  it("returns plain string when no email format", () => {
    expect(formatAssignedTo("Jane Doe")).toBe("Jane Doe");
  });

  it("returns displayName from identity object", () => {
    expect(formatAssignedTo({ displayName: "Jane Doe", uniqueName: "jane@test.com" })).toBe("Jane Doe");
  });

  it("falls back to uniqueName when displayName is missing", () => {
    expect(formatAssignedTo({ uniqueName: "jane@test.com" })).toBe("jane@test.com");
  });

  it("returns Unassigned when identity object has no names", () => {
    expect(formatAssignedTo({})).toBe("Unassigned");
  });
});

// ---------------------------------------------------------------------------
// renderSafeHtml
// ---------------------------------------------------------------------------
describe("renderSafeHtml", () => {
  it("preserves safe HTML elements", () => {
    expect(renderSafeHtml("<p>Hello <strong>world</strong></p>")).toBe("<p>Hello <strong>world</strong></p>");
  });

  it("removes script tags", () => {
    expect(renderSafeHtml('<p>Hello</p><script>alert("xss")</script>')).toBe("<p>Hello</p>");
  });

  it("removes style tags", () => {
    expect(renderSafeHtml("<p>Hello</p><style>.x{color:red}</style>")).toBe("<p>Hello</p>");
  });

  it("removes link tags", () => {
    expect(renderSafeHtml('<p>Hello</p><link rel="stylesheet" href="evil.css">')).toBe("<p>Hello</p>");
  });

  it("removes iframe tags", () => {
    expect(renderSafeHtml('<p>Hello</p><iframe src="https://evil.com"></iframe>')).toBe("<p>Hello</p>");
  });

  it("removes object tags", () => {
    expect(renderSafeHtml('<p>Hello</p><object data="evil.swf"></object>')).toBe("<p>Hello</p>");
  });

  it("removes embed tags", () => {
    expect(renderSafeHtml('<p>Hello</p><embed src="evil.swf">')).toBe("<p>Hello</p>");
  });

  it("removes form tags", () => {
    expect(renderSafeHtml('<p>Hello</p><form action="https://evil.com"><input></form>')).toBe("<p>Hello</p>");
  });

  it("removes math tags", () => {
    expect(renderSafeHtml("<p>Hello</p><math><mi>x</mi></math>")).toBe("<p>Hello</p>");
  });

  it("removes svg tags", () => {
    expect(renderSafeHtml('<p>Hello</p><svg><circle cx="5" cy="5" r="5"/></svg>')).toBe("<p>Hello</p>");
  });

  it("removes base tags", () => {
    expect(renderSafeHtml('<base href="https://evil.com/"><p>Hello</p>')).toBe("<p>Hello</p>");
  });

  it("removes meta tags", () => {
    expect(renderSafeHtml('<meta http-equiv="refresh" content="0;url=evil"><p>Hello</p>')).toBe("<p>Hello</p>");
  });

  it("removes on* event handlers", () => {
    expect(renderSafeHtml('<img src="img.png" onerror="alert(1)">')).toBe('<img src="img.png">');
  });

  it("removes style attributes", () => {
    expect(renderSafeHtml('<p style="color:red">Hello</p>')).toBe("<p>Hello</p>");
  });

  it("removes javascript: protocol from href", () => {
    const result = renderSafeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });

  it("removes vbscript: protocol from href", () => {
    const result = renderSafeHtml('<a href="vbscript:MsgBox(1)">click</a>');
    expect(result).not.toContain("vbscript:");
  });

  it("removes data:text/html from src", () => {
    const result = renderSafeHtml('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain("data:text/html");
  });

  it("handles javascript: with whitespace obfuscation", () => {
    const result = renderSafeHtml('<a href="  java\tscript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });

  it("preserves safe href attributes", () => {
    expect(renderSafeHtml('<a href="https://dev.azure.com">link</a>')).toBe('<a href="https://dev.azure.com">link</a>');
  });
});

// ---------------------------------------------------------------------------
// isHtmlContent
// ---------------------------------------------------------------------------
describe("isHtmlContent", () => {
  it("returns true for HTML strings", () => {
    expect(isHtmlContent("<p>Hello</p>")).toBe(true);
    expect(isHtmlContent("<div>content</div>")).toBe(true);
    expect(isHtmlContent("<br>")).toBe(true);
    expect(isHtmlContent("<ul><li>item</li></ul>")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("Hello world")).toBe(false);
    expect(isHtmlContent("No HTML here")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isHtmlContent(42)).toBe(false);
    expect(isHtmlContent(null)).toBe(false);
    expect(isHtmlContent(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------
describe("stripHtml", () => {
  it("strips HTML tags and returns text", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("returns empty string for falsy input", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml(null as unknown as string)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sanitizeSvg
// ---------------------------------------------------------------------------
describe("sanitizeSvg", () => {
  it("preserves safe SVG elements", () => {
    const svg = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("circle");
  });

  it("removes script elements from SVG", () => {
    const svg = '<svg><script>alert(1)</script><circle cx="8" cy="8" r="7"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("script");
    expect(result).toContain("circle");
  });

  it("removes foreignObject elements", () => {
    const svg = '<svg><foreignObject><body>XSS</body></foreignObject><circle cx="8" cy="8" r="7"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("body");
  });

  it("removes on* event handlers from SVG elements", () => {
    const svg = '<svg onload="alert(1)"><circle cx="8" cy="8" r="7" onclick="alert(2)"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("onload");
    expect(result).not.toContain("onclick");
    expect(result).toContain("circle");
  });

  it("preserves safe attributes", () => {
    const svg = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("fill");
    expect(result).toContain("viewBox");
  });
});
