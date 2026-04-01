// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { colorForType, normalizeAdoHtml } from "../../../../src/apps/shared/utils";

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

    it("returns HSL when apiColor is undefined", () => {
      const result = colorForType("Feature", undefined);
      expect(result.bg).toMatch(/^hsl\(/);
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
