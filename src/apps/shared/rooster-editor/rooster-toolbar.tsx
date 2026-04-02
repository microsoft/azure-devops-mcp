// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { FC } from "react";
import type { ContentModelFormatState, IEditor } from "roosterjs-content-model-types";
import type { ToolbarAction, DialogState } from "./rooster-toolbar-types.ts";
import { TOOLBAR_ICONS } from "./rooster-toolbar-icons.ts";
import { TOOLBAR_ACTIONS, setFontSizeAction, setHeadingAction } from "./rooster-toolbar-actions.ts";

/* ===== Icon ===== */

function ToolbarIcon({ icon }: { icon: string }) {
  const d = TOOLBAR_ICONS[icon];
  if (!d) return <span>{icon}</span>;
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ===== Link dialog ===== */

function LinkDialog({ onInsert, onCancel, cx, initialText }: { onInsert: (url: string, text: string) => void; onCancel: () => void; cx: (n: string) => string; initialText?: string }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState(initialText || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (trimmedUrl) onInsert(trimmedUrl, text.trim() || trimmedUrl);
  };

  return (
    <div className={cx("link-dialog")} data-testid="rooster-link-dialog">
      <form onSubmit={handleSubmit} className={cx("link-form")}>
        <input ref={inputRef} className={cx("link-input")} type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <input className={cx("link-input")} type="text" placeholder="Display text (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className={cx("link-actions")}>
          <button type="submit" className={cx("link-btn-insert")}>
            Insert
          </button>
          <button type="button" className={cx("link-btn-cancel")} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ===== Active state helper ===== */

function isBtnActive(btn: ToolbarAction, formatState: ContentModelFormatState): boolean {
  if (btn.isActive) return btn.isActive(formatState);
  if (btn.formatKey) return !!formatState[btn.formatKey];
  return false;
}

/* ===== Dropdown button ===== */

function DropdownButton({ btn, formatState, onSelect, cx }: { btn: ToolbarAction; formatState: ContentModelFormatState; onSelect: (value: string) => void; cx: (n: string) => string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = btn.dropdownLabel ? btn.dropdownLabel(formatState) : btn.title;

  return (
    <div className={cx("dropdown-wrapper")} ref={ref}>
      <button
        type="button"
        className={`${cx("toolbar-btn")} ${cx("dropdown-trigger")}`}
        title={btn.title}
        aria-label={btn.title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}>
        <span className={cx("dropdown-label")}>{label}</span>
        <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true">
          <path d={TOOLBAR_ICONS.chevronDown} />
        </svg>
      </button>
      {open && (
        <div className={cx("dropdown-menu")} role="listbox">
          {btn.dropdown?.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              className={cx("dropdown-item")}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(item.value);
                setOpen(false);
              }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Overflow menu ===== */

function OverflowMenu({ items, formatState, onAction, cx }: { items: ToolbarAction[]; formatState: ContentModelFormatState; onAction: (a: (e: IEditor) => void) => void; cx: (n: string) => string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={cx("overflow-wrapper")} ref={menuRef}>
      <button
        type="button"
        className={cx("toolbar-btn")}
        title="More options"
        aria-label="More options"
        aria-expanded={open}
        aria-haspopup="true"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}>
        <ToolbarIcon icon="more" />
      </button>
      {open && (
        <div className={cx("overflow-menu")} role="menu">
          {items.map((btn) => (
            <button
              key={btn.title}
              type="button"
              role="menuitem"
              className={`${cx("overflow-item")}${isBtnActive(btn, formatState) ? " " + cx("overflow-item-active") : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (btn.action) onAction(btn.action);
                setOpen(false);
              }}>
              <ToolbarIcon icon={btn.icon} />
              <span className={cx("overflow-label")}>{btn.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Toolbar props ===== */

export interface RoosterToolbarProps {
  formatState: ContentModelFormatState;
  dialog: DialogState | null;
  onButtonClick: (btn: ToolbarAction) => void;
  onToolbarAction: (action: (editor: IEditor) => void) => void;
  onInsertLink: (url: string, text: string) => void;
  onCloseDialog: () => void;
  classPrefix?: string;
}

/* ===== Main toolbar component ===== */

export const RoosterToolbar: FC<RoosterToolbarProps> = ({ formatState, dialog, onButtonClick, onToolbarAction, onInsertLink, onCloseDialog, classPrefix = "rooster" }) => {
  const cx = useCallback((name: string) => `${classPrefix}-${name}`, [classPrefix]);

  const inlineActions = TOOLBAR_ACTIONS.filter((a) => !a.overflow);
  const overflowActions = TOOLBAR_ACTIONS.filter((a) => a.overflow);

  const handleDropdownSelect = useCallback(
    (btn: ToolbarAction, value: string) => {
      if (btn.title === "Font size") {
        onToolbarAction((editor) => setFontSizeAction(editor, value));
      } else if (btn.title === "Heading") {
        onToolbarAction((editor) => setHeadingAction(editor, value));
      }
    },
    [onToolbarAction]
  );

  return (
    <>
      <div className={cx("toolbar")} role="toolbar" aria-label="Formatting options" data-testid="rooster-toolbar">
        {inlineActions.map((btn, i) => {
          const active = isBtnActive(btn, formatState);

          // Dropdown button
          if (btn.dropdown) {
            return (
              <React.Fragment key={btn.title}>
                {btn.separator && i > 0 && <span className={cx("toolbar-separator")} aria-hidden="true" />}
                <DropdownButton btn={btn} formatState={formatState} onSelect={(v) => handleDropdownSelect(btn, v)} cx={cx} />
              </React.Fragment>
            );
          }

          // Regular button
          return (
            <React.Fragment key={btn.title}>
              {btn.separator && i > 0 && <span className={cx("toolbar-separator")} aria-hidden="true" />}
              <button
                type="button"
                className={`${cx("toolbar-btn")}${active ? " " + cx("toolbar-btn-active") : ""}`}
                title={btn.title}
                aria-label={btn.title}
                aria-pressed={btn.formatKey || btn.isActive ? active : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onButtonClick(btn);
                }}>
                <ToolbarIcon icon={btn.icon} />
              </button>
            </React.Fragment>
          );
        })}
        {overflowActions.length > 0 && (
          <>
            <span className={cx("toolbar-separator")} aria-hidden="true" />
            <OverflowMenu items={overflowActions} formatState={formatState} onAction={onToolbarAction} cx={cx} />
          </>
        )}
      </div>
      {dialog?.type === "link" && <LinkDialog onInsert={onInsertLink} onCancel={onCloseDialog} cx={cx} initialText={dialog.selectedText} />}
    </>
  );
};
