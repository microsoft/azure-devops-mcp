// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useCallback, useRef } from "react";

/**
 * Custom hook for column resize via drag handles.
 * Returns the current column width overrides and a mousedown handler for resize handles.
 */
export function useColumnResize() {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ field: string; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((field: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest("th");
    if (!th) return;
    const startW = th.getBoundingClientRect().width;
    resizeRef.current = { field, startX: e.clientX, startW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = ev.clientX - resizeRef.current.startX;
      const newW = Math.max(40, resizeRef.current.startW + diff);
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current?.field ?? ""]: newW }));
    };

    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  return { columnWidths, handleResizeStart };
}
