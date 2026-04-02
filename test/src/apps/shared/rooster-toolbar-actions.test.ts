// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";

// Mock roosterjs-content-model-api so the action file can be imported
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
  removeLink: jest.fn(),
  clearFormat: jest.fn(),
  getFormatState: jest.fn().mockReturnValue({}),
}));

jest.mock("roosterjs-content-model-core", () => ({
  undo: jest.fn(),
  redo: jest.fn(),
}));

import { TOOLBAR_ACTIONS } from "../../../../src/apps/shared/rooster-editor/rooster-toolbar-actions";
import { TOOLBAR_ICONS } from "../../../../src/apps/shared/rooster-editor/rooster-toolbar-icons";
import { toggleBold, setAlignment, setHeadingLevel, removeLink, clearFormat, setDirection, getFormatState } from "roosterjs-content-model-api";
import { undo, redo } from "roosterjs-content-model-core";

describe("TOOLBAR_ACTIONS", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(TOOLBAR_ACTIONS)).toBe(true);
    expect(TOOLBAR_ACTIONS.length).toBeGreaterThan(0);
  });

  it("every action has a title and icon", () => {
    for (const action of TOOLBAR_ACTIONS) {
      expect(action.title).toBeTruthy();
      expect(action.icon).toBeTruthy();
    }
  });

  it("every icon key references a valid TOOLBAR_ICONS entry", () => {
    for (const action of TOOLBAR_ACTIONS) {
      expect(TOOLBAR_ICONS[action.icon]).toBeDefined();
    }
  });

  it("every action has either action or customAction", () => {
    for (const action of TOOLBAR_ACTIONS) {
      expect(action.action || action.customAction).toBeTruthy();
    }
  });

  it("has exactly the expected inline buttons (non-overflow)", () => {
    const inlineActions = TOOLBAR_ACTIONS.filter((a) => !a.overflow);
    expect(inlineActions.length).toBe(23);
  });

  it("has overflow buttons for LTR and RTL", () => {
    const overflowActions = TOOLBAR_ACTIONS.filter((a) => a.overflow);
    const titles = overflowActions.map((a) => a.title);
    expect(titles).toContain("Left to right");
    expect(titles).toContain("Right to left");
  });

  it("Undo action calls undo", () => {
    const undoBtn = TOOLBAR_ACTIONS.find((a) => a.title.includes("Undo"));
    expect(undoBtn).toBeDefined();
    expect(undoBtn?.action).toBeDefined();
    const mockEditor = {} as any;
    undoBtn?.action?.(mockEditor);
    expect(undo).toHaveBeenCalledWith(mockEditor);
  });

  it("Redo action calls redo", () => {
    const redoBtn = TOOLBAR_ACTIONS.find((a) => a.title.includes("Redo"));
    expect(redoBtn).toBeDefined();
    expect(redoBtn?.action).toBeDefined();
    const mockEditor = {} as any;
    redoBtn?.action?.(mockEditor);
    expect(redo).toHaveBeenCalledWith(mockEditor);
  });

  it("Bold action calls toggleBold", () => {
    const bold = TOOLBAR_ACTIONS.find((a) => a.title.includes("Bold"));
    expect(bold).toBeDefined();
    const mockEditor = {} as any;
    bold?.action?.(mockEditor);
    expect(toggleBold).toHaveBeenCalledWith(mockEditor);
  });

  it("Align center action calls setAlignment with 'center'", () => {
    const alignCenter = TOOLBAR_ACTIONS.find((a) => a.title === "Align center");
    expect(alignCenter).toBeDefined();
    const mockEditor = {} as any;
    alignCenter?.action?.(mockEditor);
    expect(setAlignment).toHaveBeenCalledWith(mockEditor, "center");
  });

  it("Heading action toggles heading (sets to 2 when no heading, 0 when heading exists)", () => {
    const heading = TOOLBAR_ACTIONS.find((a) => a.title === "Heading");
    expect(heading).toBeDefined();
    expect(heading?.action).toBeDefined();
    const mockEditor = { getDOMSelection: jest.fn() } as any;
    (getFormatState as jest.Mock).mockReturnValue({ headingLevel: 0 });
    heading?.action?.(mockEditor);
    expect(setHeadingLevel).toHaveBeenCalledWith(mockEditor, 2);
    (getFormatState as jest.Mock).mockReturnValue({ headingLevel: 2 });
    heading?.action?.(mockEditor);
    expect(setHeadingLevel).toHaveBeenCalledWith(mockEditor, 0);
  });

  it("Heading has isActive that returns true when headingLevel > 0", () => {
    const heading = TOOLBAR_ACTIONS.find((a) => a.title === "Heading");
    expect(heading).toBeDefined();
    expect(heading?.isActive).toBeDefined();
    expect(heading?.isActive?.({ headingLevel: 2 })).toBe(true);
    expect(heading?.isActive?.({ headingLevel: 0 })).toBe(false);
    expect(heading?.isActive?.({})).toBe(false);
  });

  it("Remove link action calls removeLink", () => {
    const unlink = TOOLBAR_ACTIONS.find((a) => a.title === "Remove link");
    expect(unlink).toBeDefined();
    const mockEditor = {} as any;
    unlink?.action?.(mockEditor);
    expect(removeLink).toHaveBeenCalledWith(mockEditor);
  });

  it("Clear formatting action calls clearFormat", () => {
    const clear = TOOLBAR_ACTIONS.find((a) => a.title === "Clear formatting");
    expect(clear).toBeDefined();
    const mockEditor = {} as any;
    clear?.action?.(mockEditor);
    expect(clearFormat).toHaveBeenCalledWith(mockEditor);
  });

  it("LTR action calls setDirection with 'ltr'", () => {
    const ltr = TOOLBAR_ACTIONS.find((a) => a.title === "Left to right");
    expect(ltr).toBeDefined();
    const mockEditor = {} as any;
    ltr?.action?.(mockEditor);
    expect(setDirection).toHaveBeenCalledWith(mockEditor, "ltr");
  });

  it("Insert link has customAction that opens dialog with selected text", () => {
    const insertLinkBtn = TOOLBAR_ACTIONS.find((a) => a.title === "Insert link");
    expect(insertLinkBtn).toBeDefined();
    expect(insertLinkBtn?.customAction).toBeDefined();
    const setDialog = jest.fn();
    const mockEditor = { getDOMSelection: jest.fn().mockReturnValue(null) } as any;
    insertLinkBtn?.customAction?.(mockEditor, setDialog);
    expect(setDialog).toHaveBeenCalledWith({ type: "link", selectedText: "" });
  });

  it("format buttons have formatKey defined", () => {
    const formatButtons = TOOLBAR_ACTIONS.filter((a) => a.formatKey);
    expect(formatButtons.length).toBeGreaterThanOrEqual(8);
    for (const btn of formatButtons) {
      expect(typeof btn.formatKey).toBe("string");
    }
  });

  it("separators exist between groups", () => {
    const withSeparators = TOOLBAR_ACTIONS.filter((a) => a.separator);
    expect(withSeparators.length).toBeGreaterThanOrEqual(5);
  });
});
