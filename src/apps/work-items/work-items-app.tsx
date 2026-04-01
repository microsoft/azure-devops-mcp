// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { WorkItem, DisplayConfig, ColumnConfig, SortConfig, SuggestedValue, QueryContext } from "./types.ts";
import { getPriorityBadgeClass, getStateClass, getPriorityLabel, getWorkItemId, formatCellValue } from "./utils.ts";
import { colorForType } from "../shared/utils.ts";
import { FilterBar } from "./components/filter-bar.tsx";
import { Pagination } from "./components/pagination.tsx";
import { QueryPanel } from "./components/query-panel.tsx";
import { ExpandedContent } from "./components/expanded-content.tsx";
import { StatusScreen } from "./components/status-screen.tsx";
import { useWorkItemsData } from "./hooks/use-work-items-data.ts";
import { useColumnResize } from "./hooks/use-column-resize.ts";

const CELL_CLASS_MAP: Record<string, string> = {
  "System.Id": "id-cell",
  "System.Title": "td-title",
  "System.AssignedTo": "td-assigned",
  "System.Tags": "td-tags",
};

function renderCell(field: string, wi: WorkItem, typeIconSvgMap: Record<string, string>, typeColorMap: Record<string, string>): React.ReactNode {
  const value = field === "System.Id" ? (wi.id ?? wi.fields?.["System.Id"]) : wi.fields?.[field];

  switch (field) {
    case "System.Id":
      return String(value ?? "");
    case "System.Title": {
      const title = wi.fields?.["System.Title"] ?? "Untitled";
      const type = wi.fields?.["System.WorkItemType"] ?? "";
      return (
        <div className="wi-title-cell">
          {typeIconSvgMap[type] ? <span className="wi-type-icon-api" dangerouslySetInnerHTML={{ __html: typeIconSvgMap[type] }} /> : null}
          <span className="wi-title-text" title={title}>
            {title}
          </span>
        </div>
      );
    }
    case "System.WorkItemType": {
      const type = String(value ?? "");
      const apiColor = typeColorMap[type];
      const { bg, fg } = colorForType(type, apiColor);
      return (
        <span className="type-badge" style={{ background: `${bg}20`, color: bg, borderColor: `${bg}40` }}>
          {type}
        </span>
      );
    }
    case "System.State": {
      const state = String(value ?? "Unknown");
      return (
        <div className="state-cell">
          <span className={`state-dot ${getStateClass(state)}`} />
          <span>{state}</span>
        </div>
      );
    }
    case "Microsoft.VSTS.Common.Priority": {
      if (value == null) return "";
      const p = Number(value);
      return <span className={`priority-badge ${getPriorityBadgeClass(p)}`}>{getPriorityLabel(p)}</span>;
    }
    case "System.Tags": {
      const raw = String(value ?? "");
      if (!raw) return "";
      const tags = raw
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean);
      return (
        <div className="tag-list-cell">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill-cell">
              {tag}
            </span>
          ))}
        </div>
      );
    }
    default:
      return formatCellValue(field, wi);
  }
}

function formatSuggestionValue(suggestion: SuggestedValue): string {
  if (suggestion.field === "Microsoft.VSTS.Common.Priority") return getPriorityLabel(Number(suggestion.value));
  return String(suggestion.value);
}

export function WorkItemsApp() {
  const [isQueryOpen, setIsQueryOpen] = useState(false);
  const handleToolResultRef = useRef<((result: { content?: any[]; isError?: boolean }) => void) | null>(null);

  const onAppCreated = useCallback((createdApp: import("@modelcontextprotocol/ext-apps").App) => {
    createdApp.onhostcontextchanged = (ctx) => {
      if (ctx.safeAreaInsets) {
        const { top, right, bottom, left } = ctx.safeAreaInsets;
        document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
    };

    createdApp.ontoolinput = (params) => {
      const args = params.arguments as Record<string, unknown> | undefined;
      if (!args) return;
      const cfg: DisplayConfig = {};
      if (Array.isArray(args.columns)) cfg.columns = args.columns as ColumnConfig[];
      if (args.sort && typeof args.sort === "object") cfg.sort = args.sort as SortConfig;
      if (Array.isArray(args.suggestedValues)) cfg.suggestedValues = args.suggestedValues as SuggestedValue[];
      if (typeof args.pageSize === "number") cfg.pageSize = args.pageSize;
      if (Object.keys(cfg).length > 0) {
        dataRef.current?.setDisplayConfig(cfg);
        if (cfg.sort) dataRef.current?.handleSort(cfg.sort.field);
        if (cfg.suggestedValues?.length) dataRef.current?.setSuggestions(cfg.suggestedValues);
      }
      const ctx: QueryContext = {};
      if (typeof args.project === "string") ctx.project = args.project;
      if (typeof args.type === "string") ctx.queryType = args.type;
      if (typeof args.iterationPath === "string") ctx.iterationPath = args.iterationPath;
      if (typeof args.areaPath === "string") ctx.areaPath = args.areaPath;
      if (typeof args.includeCompleted === "boolean") ctx.includeCompleted = args.includeCompleted;
      if (typeof args.team === "string") ctx.team = args.team;
      if (typeof args.iterationId === "string") ctx.iterationId = args.iterationId;
      if (Array.isArray(args.stateFilter)) ctx.stateFilter = args.stateFilter as string[];
      if (Array.isArray(args.workItemType)) ctx.workItemTypeFilter = args.workItemType as string[];
      if (Object.keys(ctx).length > 0) dataRef.current?.setQueryContext(ctx);
    };
    createdApp.ontoolinputpartial = () => dataRef.current?.setStatus("loading");
    createdApp.ontoolresult = (result) => handleToolResultRef.current?.(result);
    createdApp.ontoolcancelled = () => {
      dataRef.current?.setStatus("error");
      createdApp.updateModelContext({ content: [{ type: "text", text: "Error: Tool execution was cancelled." }] }).catch(() => {});
    };
    createdApp.onerror = (error) => {
      dataRef.current?.setStatus("error");
      createdApp.updateModelContext({ content: [{ type: "text", text: `Error: ${error?.message ?? "Connection error."}` }] }).catch(() => {});
    };
    createdApp.onteardown = async () => ({});
  }, []);

  const { app, error: connectionError } = useApp({ appInfo: { name: "Work Items App", version: "1.0.0" }, capabilities: {}, onAppCreated });
  useHostStyles(app);

  const data = useWorkItemsData(app);
  const { columnWidths, handleResizeStart } = useColumnResize();

  // Wire refs so onAppCreated callbacks can reach current data
  const dataRef = useRef(data);
  dataRef.current = data;
  handleToolResultRef.current = data.handleToolResult;

  // Apply initial safe area insets
  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.safeAreaInsets) {
      const { top, right, bottom, left } = ctx.safeAreaInsets;
      document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }
    app.sendLog({ level: "info", data: "Work Items App connected", logger: "WorkItemsApp" });
  }, [app]);

  useEffect(() => {
    if (connectionError) data.setStatus("error");
  }, [connectionError, data]);

  // Update model context when work items change
  useEffect(() => {
    if (!app || data.allWorkItems.length === 0 || data.status !== "table") return;
    const stateMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};
    for (const wi of data.allWorkItems) {
      const state = String(wi.fields?.["System.State"] ?? "Unknown");
      stateMap[state] = (stateMap[state] ?? 0) + 1;
      const type = String(wi.fields?.["System.WorkItemType"] ?? "Unknown");
      typeMap[type] = (typeMap[type] ?? 0) + 1;
    }
    const stateText = Object.entries(stateMap)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const typeText = Object.entries(typeMap)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const hasFilters = data.filters.search || data.filters.state || data.filters.type || data.filters.assignedTo || data.filters.priority || data.filters.tag;
    app.updateModelContext({
      content: [
        {
          type: "text" as const,
          text: `---\nitem-count: ${data.allWorkItems.length}\ncurrent-page: ${data.safePage}\npage-size: ${data.pageSize}\nhas-filters: ${hasFilters ? "true" : "false"}\n---\n\nUser is viewing ${data.allWorkItems.length} work items.\nStates: ${stateText}\nTypes: ${typeText}${hasFilters ? `\nFilters: search="${data.filters.search}", state="${data.filters.state}", type="${data.filters.type}", assignedTo="${data.filters.assignedTo}", priority="${data.filters.priority}", tag="${data.filters.tag}"` : ""}`,
        },
      ],
    });
  }, [app, data.allWorkItems, data.status, data.safePage, data.pageSize, data.filters]);

  if (data.status !== "table") return <StatusScreen status={data.status} />;

  const tableMinWidth = data.columns.reduce((sum, c) => sum + (c.width ?? 120), 32);

  return (
    <div className="content">
      <FilterBar
        filters={data.filters}
        onChange={data.handleFilterChange}
        onClear={data.handleClearFilters}
        filterOptions={data.filterOptions}
        totalCount={data.allWorkItems.length}
        filteredCount={data.filteredWorkItems.length}
      />
      {data.suggestions.length > 0 && (
        <div className="suggestions-banner">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM8 6.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 6.75z" />
          </svg>
          <span>
            {data.suggestions.length} suggested value{data.suggestions.length !== 1 ? "s" : ""} from your AI agent.
          </span>
        </div>
      )}
      <div className="table-container">
        <div className="table-scroll-wrapper">
          <table style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th className="col-expand" />
                {data.columns.map((col) => {
                  const w = columnWidths[col.field] ?? col.width;
                  return (
                    <th
                      key={col.field}
                      className={`sortable-header${data.sortConfig?.field === col.field ? " sorted" : ""}`}
                      style={w ? { width: w } : undefined}
                      onClick={() => data.handleSort(col.field)}>
                      <div className="header-content">
                        <span>{col.label}</span>
                        <span className="sort-indicator">{data.sortConfig?.field === col.field ? (data.sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </div>
                      <div className="resize-handle" onMouseDown={(e) => handleResizeStart(col.field, e)} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.pageItems.map((wi) => {
                const id = getWorkItemId(wi);
                const isExpanded = data.expandedRow === id;
                return (
                  <Fragment key={id}>
                    <tr
                      className={`wi-row${isExpanded ? " expanded-parent" : ""}${data.suggestions.some((s) => s.workItemId === id) ? " has-suggestion" : ""}`}
                      onClick={() => data.toggleExpandRow(id)}>
                      <td>
                        <button className={`expand-btn ${isExpanded ? "expanded" : ""}`}>›</button>
                      </td>
                      {data.columns.map((col) => {
                        const suggestion = data.getSuggestion(id, col.field);
                        return (
                          <td key={col.field} className={CELL_CLASS_MAP[col.field] ?? ""}>
                            {renderCell(col.field, wi, data.typeIconSvgMap, data.typeColorMap)}
                            {suggestion && (
                              <div className="suggestion-indicator" onClick={(e) => e.stopPropagation()}>
                                <div className="suggestion-content">
                                  <span className="suggestion-label">Suggested:</span>
                                  <span className="suggestion-value">{formatSuggestionValue(suggestion)}</span>
                                  {suggestion.reason && (
                                    <span className="suggestion-reason" title={suggestion.reason}>
                                      ({suggestion.reason})
                                    </span>
                                  )}
                                </div>
                                <div className="suggestion-actions">
                                  <button className="suggestion-accept" title="Accept suggestion" onClick={() => data.handleAcceptSuggestion(suggestion)}>
                                    ✓
                                  </button>
                                  <button className="suggestion-dismiss" title="Dismiss suggestion" onClick={() => data.handleDismissSuggestion(id, col.field)}>
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row" onClick={(e) => e.stopPropagation()}>
                        <td colSpan={data.columns.length + 1}>
                          <div className="expanded-content">
                            <ExpandedContent
                              wi={wi}
                              editState={data.editState}
                              onEdit={data.handleStartEdit}
                              onSave={data.handleSave}
                              onCancel={data.handleCancelEdit}
                              onFieldChange={data.handleFieldChange}
                              app={app ?? undefined}
                              allowedStates={data.editAllowedStates}
                              typeMetadataMap={data.typeMetadataMap}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            {data.filteredWorkItems.length > 0 ? data.start + 1 : 0}-{data.end} of {data.filteredWorkItems.length} work items
          </span>
          <Pagination currentPage={data.safePage} totalPages={data.totalPages} onPageChange={(p: number) => data.setCurrentPage(p)} />
          <button className={`view-query-btn ${isQueryOpen ? "active" : ""}`} onClick={() => setIsQueryOpen(!isQueryOpen)}>
            View query <span className="chevron">›</span>
          </button>
        </div>
        <QueryPanel isOpen={isQueryOpen} filters={data.filters} queryContext={data.queryContext} />
      </div>
    </div>
  );
}
