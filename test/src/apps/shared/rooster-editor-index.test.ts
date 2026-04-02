// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";

// Mock roosterjs packages so the barrel index can be imported
jest.mock("roosterjs-content-model-core", () => ({
  Editor: jest.fn(),
  exportContent: jest.fn(),
  undo: jest.fn(),
  redo: jest.fn(),
}));
jest.mock("roosterjs-content-model-api", () => ({
  toggleBold: jest.fn(),
  toggleItalic: jest.fn(),
  toggleUnderline: jest.fn(),
  toggleStrikethrough: jest.fn(),
  toggleSuperscript: jest.fn(),
  toggleSubscript: jest.fn(),
  toggleBullet: jest.fn(),
  toggleNumbering: jest.fn(),
  toggleBlockQuote: jest.fn(),
  toggleCode: jest.fn(),
  setIndentation: jest.fn(),
  setAlignment: jest.fn(),
  setHeadingLevel: jest.fn(),
  setFontSize: jest.fn(),
  setDirection: jest.fn(),
  insertLink: jest.fn(),
  removeLink: jest.fn(),
  clearFormat: jest.fn(),
  getFormatState: jest.fn().mockReturnValue({}),
}));
jest.mock("roosterjs-content-model-dom", () => ({
  domToContentModel: jest.fn(),
  createDomToModelContext: jest.fn(),
}));
jest.mock("roosterjs-content-model-plugins", () => ({
  EditPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Edit" })),
  AutoFormatPlugin: jest.fn().mockImplementation(() => ({ getName: () => "AutoFormat" })),
  ShortcutPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Shortcut" })),
  PastePlugin: jest.fn().mockImplementation(() => ({ getName: () => "Paste" })),
  HyperlinkPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Hyperlink" })),
}));
jest.mock("roosterjs-color-utils", () => ({
  getDarkColor: jest.fn(),
}));

import { RoosterEditor, useIsDarkTheme, RoosterToolbar, TOOLBAR_ACTIONS, TOOLBAR_ICONS } from "../../../../src/apps/shared/rooster-editor/index";

describe("rooster-editor barrel index", () => {
  it("exports RoosterEditor component", () => {
    expect(RoosterEditor).toBeDefined();
    expect(typeof RoosterEditor).toBe("function");
  });

  it("exports useIsDarkTheme hook", () => {
    expect(useIsDarkTheme).toBeDefined();
    expect(typeof useIsDarkTheme).toBe("function");
  });

  it("exports RoosterToolbar component", () => {
    expect(RoosterToolbar).toBeDefined();
    expect(typeof RoosterToolbar).toBe("function");
  });

  it("exports TOOLBAR_ACTIONS array", () => {
    expect(Array.isArray(TOOLBAR_ACTIONS)).toBe(true);
    expect(TOOLBAR_ACTIONS.length).toBeGreaterThan(0);
  });

  it("exports TOOLBAR_ICONS record", () => {
    expect(typeof TOOLBAR_ICONS).toBe("object");
    expect(Object.keys(TOOLBAR_ICONS).length).toBeGreaterThan(0);
  });
});
