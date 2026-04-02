// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type { FC } from "react";
import { Editor, exportContent } from "roosterjs-content-model-core";
import { insertLink, getFormatState } from "roosterjs-content-model-api";
import { domToContentModel, createDomToModelContext } from "roosterjs-content-model-dom";
import { EditPlugin, AutoFormatPlugin, ShortcutPlugin, PastePlugin, HyperlinkPlugin } from "roosterjs-content-model-plugins";
import { getDarkColor } from "roosterjs-color-utils";
import type { IEditor, EditorOptions, ContentModelFormatState, EditorPlugin, PluginEvent } from "roosterjs-content-model-types";
import type { ToolbarAction, DialogState } from "./rooster-toolbar-types.ts";
import { RoosterToolbar } from "./rooster-toolbar.tsx";

/* ===== Public types ===== */

export interface RoosterEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
  className?: string;
  classPrefix?: string;
}

/* ===== Hook: dark theme detection ===== */

export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(() => detectDark());

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(detectDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function detectDark(): boolean {
  const dataTheme = document.documentElement.getAttribute("data-theme");
  if (dataTheme === "dark") return true;
  if (dataTheme === "light") return false;
  const bg = getComputedStyle(document.body).backgroundColor;
  return isColorDark(bg);
}

function isColorDark(color: string): boolean {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return true;
  const [, r, g, b] = match.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/* ===== Main component ===== */

export const RoosterEditor: FC<RoosterEditorProps> = ({ initialContent, onChange, minHeight = 150, placeholder, className = "rooster-editor-container", classPrefix = "rooster" }) => {
  const cx = useCallback((name: string) => `${classPrefix}-${name}`, [classPrefix]);

  const contentDivRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IEditor | null>(null);
  const isDark = useIsDarkTheme();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [formatState, setFormatState] = useState<ContentModelFormatState>({});
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const updateFormatState = useCallback(() => {
    const editor = editorRef.current;
    if (editor) setFormatState(getFormatState(editor));
  }, []);

  const plugins = useMemo(() => [new EditPlugin(), new AutoFormatPlugin(), new PastePlugin(), new ShortcutPlugin(), new HyperlinkPlugin()], []);

  // Plugin that fires onChange on every content change
  const changePluginRef = useRef<EditorPlugin>({
    getName: () => "ChangeNotifier",
    initialize: () => {
      /* required by EditorPlugin */
    },
    dispose: () => {
      /* required by EditorPlugin */
    },
    onPluginEvent: (event: PluginEvent) => {
      if (event.eventType === "input" || event.eventType === "contentChanged") {
        const editor = editorRef.current;
        if (editor && onChangeRef.current) {
          const html = exportContent(editor);
          onChangeRef.current(html);
        }
      }
    },
  });

  // Editor lifecycle
  useEffect(() => {
    const div = contentDivRef.current;
    if (!div) return;

    let initialModel;
    if (initialContent) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = initialContent;
      const context = createDomToModelContext();
      initialModel = domToContentModel(tempDiv, context);
    }

    const options: EditorOptions = {
      plugins: [...plugins, changePluginRef.current],
      getDarkColor,
      inDarkMode: isDarkRef.current,
      initialModel,
      defaultSegmentFormat: {
        fontSize: "13px",
        fontFamily: "var(--font-sans, inherit)",
      },
    };

    const editor = new Editor(div, options);
    editorRef.current = editor;

    return () => {
      editorRef.current = null;
      editor.dispose();
    };
    // Only run on mount/unmount — initialContent & plugins are stable refs
  }, []);

  // Dark mode sync
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) editor.setDarkModeState(isDark);
  }, [isDark]);

  // Fire onChange + update format state
  const fireChange = useCallback(() => {
    const editor = editorRef.current;
    if (editor && onChangeRef.current) {
      const html = exportContent(editor);
      onChangeRef.current(html);
    }
  }, []);

  const handleToolbarAction = useCallback(
    (action: (editor: IEditor) => void) => {
      const editor = editorRef.current;
      if (editor) {
        action(editor);
        contentDivRef.current?.focus();
        fireChange();
        updateFormatState();
      }
    },
    [fireChange, updateFormatState]
  );

  const handleButtonClick = useCallback(
    (btn: ToolbarAction) => {
      if (btn.customAction) {
        const editor = editorRef.current;
        if (editor) btn.customAction(editor, setDialog);
      } else if (btn.action) {
        handleToolbarAction(btn.action);
      }
    },
    [handleToolbarAction]
  );

  const handleInsertLink = useCallback(
    (url: string, text: string) => {
      const editor = editorRef.current;
      if (editor) {
        contentDivRef.current?.focus();
        insertLink(editor, url, url, text, url);
        fireChange();
        updateFormatState();
      }
      setDialog(null);
    },
    [fireChange, updateFormatState]
  );

  return (
    <div className={className} data-testid="rooster-editor">
      <RoosterToolbar
        formatState={formatState}
        dialog={dialog}
        onButtonClick={handleButtonClick}
        onToolbarAction={handleToolbarAction}
        onInsertLink={handleInsertLink}
        onCloseDialog={() => setDialog(null)}
        classPrefix={classPrefix}
      />
      <div
        ref={contentDivRef}
        className={cx("content")}
        data-testid="rooster-content"
        data-placeholder={placeholder}
        style={{ minHeight }}
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Rich text editor"}
      />
    </div>
  );
};
