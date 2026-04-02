// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { TOOLBAR_ICONS } from "../../../../src/apps/shared/rooster-editor/rooster-toolbar-icons";

describe("TOOLBAR_ICONS", () => {
  it("exports a non-empty record of icon paths", () => {
    expect(Object.keys(TOOLBAR_ICONS).length).toBeGreaterThan(0);
  });

  const expectedIcons = [
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "superscript",
    "subscript",
    "bullet",
    "numbering",
    "outdent",
    "indent",
    "blockquote",
    "alignLeft",
    "alignCenter",
    "alignRight",
    "alignJustify",
    "heading",
    "code",
    "link",
    "unlink",
    "clearFormat",
    "more",
    "ltr",
    "rtl",
    "undo",
    "redo",
    "chevronDown",
  ];

  it.each(expectedIcons)("has icon '%s'", (iconName) => {
    expect(TOOLBAR_ICONS[iconName]).toBeDefined();
    expect(typeof TOOLBAR_ICONS[iconName]).toBe("string");
    expect(TOOLBAR_ICONS[iconName].length).toBeGreaterThan(0);
  });

  it("all icon paths are valid SVG path data (start with M or m)", () => {
    for (const path of Object.values(TOOLBAR_ICONS)) {
      expect(path).toMatch(/^[Mm]/);
    }
  });

  it("link and unlink have distinct paths", () => {
    expect(TOOLBAR_ICONS.link).not.toBe(TOOLBAR_ICONS.unlink);
  });
});
