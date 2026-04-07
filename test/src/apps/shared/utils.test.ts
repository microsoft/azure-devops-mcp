/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import {
  colorForType,
  normalizeAdoHtml,
  getFieldLabel,
  formatAssignedTo,
  getPriorityLabel,
  renderSafeHtml,
  renderMarkdownToHtml,
  isHtmlContent,
  stripHtml,
  sanitizeSvg,
} from "../../../../src/apps/shared/utils";

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

  it("removes javascript: protocol from href", () => {
    const svg = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("javascript:");
  });

  it("removes javascript: protocol from xlink:href", () => {
    const svg = '<svg><use xlink:href="javascript:alert(1)"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("javascript:");
  });

  it("removes vbscript: protocol from href", () => {
    const svg = '<svg><a href="vbscript:MsgBox(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("vbscript:");
  });

  it("removes data:text/html from src", () => {
    const svg = '<svg><image src="data:text/html,<script>alert(1)</script>"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("data:text/html");
  });

  it("preserves safe href in SVG links", () => {
    const svg = '<svg><a href="https://dev.azure.com"><text>link</text></a></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("https://dev.azure.com");
  });
});

// ---------------------------------------------------------------------------
// renderMarkdownToHtml
// ---------------------------------------------------------------------------
describe("renderMarkdownToHtml", () => {
  describe("headings", () => {
    it("converts ATX headings h1-h6", () => {
      expect(renderMarkdownToHtml("# H1")).toContain("<h1>H1</h1>");
      expect(renderMarkdownToHtml("## H2")).toContain("<h2>H2</h2>");
      expect(renderMarkdownToHtml("### H3")).toContain("<h3>H3</h3>");
      expect(renderMarkdownToHtml("#### H4")).toContain("<h4>H4</h4>");
      expect(renderMarkdownToHtml("##### H5")).toContain("<h5>H5</h5>");
      expect(renderMarkdownToHtml("###### H6")).toContain("<h6>H6</h6>");
    });

    it("converts setext headings", () => {
      expect(renderMarkdownToHtml("Title\n=====")).toContain("<h1>Title</h1>");
      expect(renderMarkdownToHtml("Subtitle\n-----")).toContain("<h2>Subtitle</h2>");
    });

    it("applies inline formatting in headings", () => {
      const result = renderMarkdownToHtml("## **Bold** heading");
      expect(result).toContain("<h2>");
      expect(result).toContain("<strong>Bold</strong>");
    });
  });

  describe("inline formatting", () => {
    it("converts bold with asterisks", () => {
      expect(renderMarkdownToHtml("**bold**")).toContain("<strong>bold</strong>");
    });

    it("converts bold with underscores", () => {
      expect(renderMarkdownToHtml("__bold__")).toContain("<strong>bold</strong>");
    });

    it("converts italic with asterisks", () => {
      expect(renderMarkdownToHtml("*italic*")).toContain("<em>italic</em>");
    });

    it("converts italic with underscores", () => {
      expect(renderMarkdownToHtml("_italic_")).toContain("<em>italic</em>");
    });

    it("converts bold+italic", () => {
      const result = renderMarkdownToHtml("***both***");
      expect(result).toContain("<em>");
      expect(result).toContain("<strong>");
      expect(result).toContain("both");
    });

    it("converts strikethrough", () => {
      const result = renderMarkdownToHtml("~~deleted~~");
      expect(result).toMatch(/<(?:del|s)>deleted<\/(?:del|s)>/);
    });

    it("converts inline code", () => {
      const result = renderMarkdownToHtml("Use `console.log()`");
      expect(result).toContain("<code>console.log()</code>");
    });

    it("escapes HTML inside inline code", () => {
      const result = renderMarkdownToHtml("`<script>alert(1)</script>`");
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
    });
  });

  describe("links and images", () => {
    it("converts links", () => {
      const result = renderMarkdownToHtml("[Click here](https://example.com)");
      expect(result).toContain('<a href="https://example.com">Click here</a>');
    });

    it("converts images", () => {
      const result = renderMarkdownToHtml("![Alt text](https://example.com/img.png)");
      expect(result).toContain("<img");
      expect(result).toContain('src="https://example.com/img.png"');
      expect(result).toContain('alt="Alt text"');
    });

    it("converts autolinks", () => {
      const result = renderMarkdownToHtml("<https://example.com>");
      expect(result).toContain('<a href="https://example.com">');
    });
  });

  describe("code blocks", () => {
    it("converts fenced code blocks with backticks", () => {
      const md = "```js\nconst x = 1;\n```";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<pre>");
      expect(result).toContain("<code");
      expect(result).toContain("const x = 1;");
    });

    it("converts fenced code blocks with tildes", () => {
      const md = "~~~\ncode here\n~~~";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<pre><code>");
      expect(result).toContain("code here");
    });

    it("escapes HTML in code blocks", () => {
      const md = "```\n<div>test</div>\n```";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("&lt;div&gt;");
    });
  });

  describe("lists", () => {
    it("converts unordered lists", () => {
      const md = "- Item 1\n- Item 2\n- Item 3";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain("<li>Item 2</li>");
      expect(result).toContain("<li>Item 3</li>");
    });

    it("converts ordered lists", () => {
      const md = "1. First\n2. Second\n3. Third";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>First</li>");
      expect(result).toContain("<li>Second</li>");
    });

    it("converts nested unordered lists", () => {
      const md = "- Parent\n  - Child\n  - Child 2\n- Parent 2";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Parent");
      expect(result).toContain("<li>Child</li>");
      // Should have nested ul
      expect((result.match(/<ul>/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it("handles different bullet markers", () => {
      const md = "* Star\n+ Plus\n- Dash";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<li>Star</li>");
      expect(result).toContain("<li>Plus</li>");
      expect(result).toContain("<li>Dash</li>");
    });
  });

  describe("blockquotes", () => {
    it("converts single-line blockquotes", () => {
      const result = renderMarkdownToHtml("> This is a quote");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("This is a quote");
    });

    it("converts multi-line blockquotes", () => {
      const md = "> Line 1\n> Line 2";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<blockquote>");
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });
  });

  describe("tables", () => {
    it("converts simple tables", () => {
      const md = "| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<table>");
      expect(result).toContain("<th>Name</th>");
      expect(result).toContain("<th>Value</th>");
      expect(result).toContain("<td>A</td>");
      expect(result).toContain("<td>1</td>");
    });

    it("applies inline formatting in table cells", () => {
      const md = "| Col |\n| --- |\n| **bold** |";
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<strong>bold</strong>");
    });
  });

  describe("horizontal rules", () => {
    it("converts --- to hr", () => {
      expect(renderMarkdownToHtml("---")).toContain("<hr>");
    });

    it("converts *** to hr", () => {
      expect(renderMarkdownToHtml("***")).toContain("<hr>");
    });

    it("converts ___ to hr", () => {
      expect(renderMarkdownToHtml("___")).toContain("<hr>");
    });
  });

  describe("paragraphs", () => {
    it("wraps plain text in p tags", () => {
      expect(renderMarkdownToHtml("Hello world")).toContain("<p>Hello world</p>");
    });

    it("separates paragraphs on double newline", () => {
      const result = renderMarkdownToHtml("Para 1\n\nPara 2");
      expect(result).toContain("<p>Para 1</p>");
      expect(result).toContain("<p>Para 2</p>");
    });

    it("preserves single newlines within paragraph", () => {
      const result = renderMarkdownToHtml("Line 1\nLine 2");
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });
  });

  describe("security", () => {
    it("strips script tags", () => {
      const result = renderMarkdownToHtml("<script>alert(1)</script>");
      expect(result).not.toContain("<script>");
    });

    it("strips event handlers from HTML in markdown", () => {
      const result = renderMarkdownToHtml('<div onclick="alert(1)">click</div>');
      expect(result).not.toContain("onclick");
    });
  });

  describe("real-world ADO content", () => {
    it("converts a typical ADO Feature description", () => {
      const md = [
        "# Feature: Privacy Management",
        "",
        "## Owner",
        "Privacy Team",
        "",
        "## Acceptance Criteria",
        "- Microsoft Priva deployed",
        "- Data subject request automation implemented",
        "- Privacy impact assessment workflows established",
        "",
        "## Dependencies &amp; Constraints",
        "- Legal team for privacy policy definitions",
      ].join("\n");
      const result = renderMarkdownToHtml(md);
      expect(result).toContain("<h1>Feature: Privacy Management</h1>");
      expect(result).toContain("<h2>Owner</h2>");
      expect(result).toContain("<h2>Acceptance Criteria</h2>");
      expect(result).toContain("<li>Microsoft Priva deployed</li>");
      expect(result).toContain("<li>Data subject request automation implemented</li>");
      expect(result).toContain("<p>Privacy Team</p>");
    });
  });
});
