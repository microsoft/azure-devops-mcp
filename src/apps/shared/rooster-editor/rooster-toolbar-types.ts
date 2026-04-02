// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ContentModelFormatState, IEditor } from "roosterjs-content-model-types";

/**
 * Describes a single toolbar button for the RoosterEditor ribbon.
 *
 * Actions are split into two categories:
 * - `action`: a simple callback that receives the editor and applies formatting.
 * - `customAction`: opens an inline dialog (e.g. link input) instead of acting immediately.
 */
export interface ToolbarAction {
  /** Icon key — must match a key in TOOLBAR_ICONS. */
  icon: string;
  /** Tooltip / accessible label. */
  title: string;
  /** Direct editor action. */
  action?: (editor: IEditor) => void;
  /** Custom action that may open UI (receives a dialog setter). */
  customAction?: (editor: IEditor, setDialog: (d: DialogState | null) => void) => void;
  /** When true, renders a separator *before* this button. */
  separator?: boolean;
  /** ContentModelFormatState key to track active/pressed state (for boolean fields). */
  formatKey?: keyof ContentModelFormatState;
  /** Custom active-state checker for non-boolean format state (e.g. headingLevel). */
  isActive?: (state: ContentModelFormatState) => boolean;
  /** When true, this button appears only inside the overflow "more" menu. */
  overflow?: boolean;
  /** Dropdown items — when present, button becomes a dropdown trigger. */
  dropdown?: DropdownItem[];
  /** Get the current display label for a dropdown (e.g. current font size). */
  dropdownLabel?: (state: ContentModelFormatState) => string;
}

export interface DropdownItem {
  label: string;
  value: string;
}

export interface DialogState {
  type: "link";
  /** Pre-populated display text (e.g. from current selection). */
  selectedText?: string;
}
