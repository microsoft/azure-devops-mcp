// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleSuperscript,
  toggleSubscript,
  toggleBullet,
  toggleNumbering,
  toggleBlockQuote,
  toggleCode,
  setIndentation,
  setAlignment,
  setHeadingLevel,
  setFontSize,
  removeLink,
  clearFormat,
  setDirection,
  getFormatState,
} from "roosterjs-content-model-api";
import { undo, redo } from "roosterjs-content-model-core";
import type { IEditor } from "roosterjs-content-model-types";
import type { ToolbarAction, DialogState, DropdownItem } from "./rooster-toolbar-types.ts";

/* ===== Dropdown data ===== */

const FONT_SIZES: DropdownItem[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((s) => ({
  label: String(s),
  value: `${s}pt`,
}));

const HEADING_LEVELS: DropdownItem[] = [
  { label: "Heading 1", value: "1" },
  { label: "Heading 2", value: "2" },
  { label: "Heading 3", value: "3" },
  { label: "Heading 4", value: "4" },
  { label: "Heading 5", value: "5" },
  { label: "Heading 6", value: "6" },
  { label: "No heading", value: "0" },
];

/**
 * All toolbar actions for the RoosterEditor ribbon.
 *
 * Layout:
 *   Undo/Redo | Text | Lists | Alignment | Links | Heading & Code | Clear | Overflow
 */
export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  // ── Undo / Redo (always visible, never overflow) ──
  { icon: "undo", title: "Undo (Ctrl+Z)", action: (e) => undo(e), formatKey: "canUndo" },
  { icon: "redo", title: "Redo (Ctrl+Y)", action: (e) => redo(e), formatKey: "canRedo", separator: true },

  // ── Text group ──
  { icon: "bold", title: "Bold (Ctrl+B)", action: (e) => toggleBold(e), formatKey: "isBold" },
  { icon: "italic", title: "Italic (Ctrl+I)", action: (e) => toggleItalic(e), formatKey: "isItalic" },
  { icon: "underline", title: "Underline (Ctrl+U)", action: (e) => toggleUnderline(e), formatKey: "isUnderline" },
  { icon: "strikethrough", title: "Strikethrough", action: (e) => toggleStrikethrough(e), formatKey: "isStrikeThrough" },
  { icon: "superscript", title: "Superscript", action: (e) => toggleSuperscript(e), formatKey: "isSuperscript" },
  { icon: "subscript", title: "Subscript", action: (e) => toggleSubscript(e), formatKey: "isSubscript", separator: true },

  // ── Font size dropdown ──
  {
    icon: "heading",
    title: "Font size",
    action: () => {
      /* no-op; dropdown handles it */
    },
    dropdown: FONT_SIZES,
    dropdownLabel: (s) => s.fontSize?.replace("pt", "") || "13",
  },

  // ── Paragraph group ──
  { icon: "bullet", title: "Bulleted list", action: (e) => toggleBullet(e), formatKey: "isBullet" },
  { icon: "numbering", title: "Numbered list", action: (e) => toggleNumbering(e), formatKey: "isNumbering" },
  { icon: "outdent", title: "Decrease indent", action: (e) => setIndentation(e, "outdent") },
  { icon: "indent", title: "Increase indent", action: (e) => setIndentation(e, "indent") },
  { icon: "blockquote", title: "Block quote", action: (e) => toggleBlockQuote(e), formatKey: "isBlockQuote", separator: true },

  // ── Alignment group ──
  { icon: "alignLeft", title: "Align left", action: (e) => setAlignment(e, "left") },
  { icon: "alignCenter", title: "Align center", action: (e) => setAlignment(e, "center") },
  { icon: "alignRight", title: "Align right", action: (e) => setAlignment(e, "right") },
  { icon: "alignJustify", title: "Align justify", action: (e) => setAlignment(e, "justify"), separator: true },

  // ── Insert group ──
  {
    icon: "link",
    title: "Insert link",
    customAction: (editor: IEditor, setDialog: (d: DialogState | null) => void) => {
      const sel = editor.getDOMSelection();
      let selectedText = "";
      if (sel?.type === "range" && !sel.range.collapsed) {
        selectedText = sel.range.toString();
      }
      setDialog({ type: "link", selectedText });
    },
    formatKey: "canUnlink",
  },
  { icon: "unlink", title: "Remove link", action: (e) => removeLink(e), separator: true },

  // ── Heading dropdown ──
  {
    icon: "heading",
    title: "Heading",
    action: (e) => {
      const state = getFormatState(e);
      // Block heading always applies to full paragraph — this is correct HTML behavior
      setHeadingLevel(e, state.headingLevel ? 0 : 2);
    },
    isActive: (state) => !!state.headingLevel && state.headingLevel > 0,
    dropdown: HEADING_LEVELS,
    dropdownLabel: (s) => (s.headingLevel ? `H${s.headingLevel}` : "H"),
  },

  // ── Code ──
  { icon: "code", title: "Code", action: (e) => toggleCode(e), formatKey: "isCodeInline", separator: true },

  // ── Clear format (inline, not overflow) ──
  { icon: "clearFormat", title: "Clear formatting", action: (e) => clearFormat(e), separator: true },

  // ── Direction (overflow) ──
  { icon: "ltr", title: "Left to right", action: (e) => setDirection(e, "ltr"), overflow: true },
  { icon: "rtl", title: "Right to left", action: (e) => setDirection(e, "rtl"), overflow: true },
];

/** Font size setter — used by the toolbar dropdown handler */
export function setFontSizeAction(editor: IEditor, size: string): void {
  setFontSize(editor, size);
}

/** Heading font sizes (approximating browser defaults for h1–h6) */
const HEADING_FONT_SIZES: Record<number, string> = {
  1: "24pt",
  2: "18pt",
  3: "14pt",
  4: "12pt",
  5: "10pt",
  6: "8pt",
};

/**
 * Heading level setter — used by the toolbar dropdown handler.
 *
 * If the selection is partial (only some words selected within a block),
 * applies inline font-size + bold to mimic heading appearance, since HTML
 * headings are block-level and always wrap the entire paragraph.
 *
 * If the selection is collapsed (cursor) or spans the full block, applies
 * the standard block-level heading via setHeadingLevel.
 */
export function setHeadingAction(editor: IEditor, level: string): void {
  const numLevel = parseInt(level, 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const sel = editor.getDOMSelection();

  // Check if there's a partial (non-collapsed, non-full-block) text selection
  if (sel?.type === "range" && !sel.range.collapsed && numLevel > 0) {
    const rangeText = sel.range.toString();
    const container = sel.range.commonAncestorContainer;
    const blockText = (container.nodeType === 3 ? container.parentElement : (container as Element))?.closest("[contenteditable] > *")?.textContent || "";

    // If selection is only part of the block, apply inline formatting
    if (rangeText.length > 0 && blockText.length > 0 && rangeText.length < blockText.length) {
      const fontSize = HEADING_FONT_SIZES[numLevel];
      if (fontSize) {
        setFontSize(editor, fontSize);
        const state = getFormatState(editor);
        if (!state.isBold) {
          toggleBold(editor);
        }
      }
      return;
    }
  }

  // Full block or collapsed selection — apply standard block heading
  setHeadingLevel(editor, numLevel);
}
