// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";
import type { ContentItem, WorkItem, ActiveFilters, EditState, WorkItemTypeMetadata, DisplayConfig, ColumnConfig, SortConfig, SuggestedValue, QueryContext } from "../types.ts";
import {
  PAGE_SIZE,
  EMPTY_FILTERS,
  DEFAULT_COLUMNS,
  KNOWN_FIELD_WIDTHS,
  formatAssignedTo,
  getPriorityLabel,
  getFieldLabel,
  getWorkItemId,
  compareCellValues,
  prepareEditFields,
  READ_ONLY_FIELDS,
} from "../utils.ts";

type AppStatus = "loading" | "error" | "empty" | "table";

/** Extracts and computes filter options from the current work item set. */
function buildFilterOptions(workItems: WorkItem[]) {
  const states = new Set<string>();
  const types = new Set<string>();
  const assignees = new Set<string>();
  const priorities = new Set<string>();
  const tags = new Set<string>();

  for (const wi of workItems) {
    const f = wi.fields;
    if (!f) continue;
    if (f["System.State"]) states.add(f["System.State"]);
    if (f["System.WorkItemType"]) types.add(f["System.WorkItemType"]);
    const a = formatAssignedTo(f["System.AssignedTo"]);
    if (a && a !== "Unassigned") assignees.add(a);
    if (f["Microsoft.VSTS.Common.Priority"] != null) priorities.add(getPriorityLabel(f["Microsoft.VSTS.Common.Priority"]));
    if (f["System.Tags"])
      String(f["System.Tags"])
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tags.add(t));
  }

  return {
    states: [...states].sort(),
    types: [...types].sort(),
    assignees: [...assignees].sort(),
    priorities: [...priorities].sort(),
    tags: [...tags].sort(),
  };
}

/** Applies client-side filters and sorting to the work item array. */
function applyFiltersAndSort(workItems: WorkItem[], filters: ActiveFilters, sortConfig: SortConfig | null): WorkItem[] {
  const filtered = workItems.filter((wi) => {
    const f = wi.fields;
    if (!f) return false;
    if (filters.search) {
      const title = (f["System.Title"] ?? "").toLowerCase();
      const id = String(f["System.Id"] ?? wi.id ?? "");
      if (!title.includes(filters.search) && !id.includes(filters.search)) return false;
    }
    if (filters.state && f["System.State"] !== filters.state) return false;
    if (filters.type && f["System.WorkItemType"] !== filters.type) return false;
    if (filters.assignedTo && formatAssignedTo(f["System.AssignedTo"]) !== filters.assignedTo) return false;
    if (filters.priority) {
      const p = f["Microsoft.VSTS.Common.Priority"];
      if (p == null || getPriorityLabel(p) !== filters.priority) return false;
    }
    if (filters.tag) {
      const wiTags = f["System.Tags"]
        ? String(f["System.Tags"])
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      if (!wiTags.includes(filters.tag)) return false;
    }
    return true;
  });

  if (sortConfig) {
    filtered.sort((a, b) => compareCellValues(sortConfig.field, a, b, sortConfig.direction));
  }
  return filtered;
}

/**
 * Custom hook that manages all work items data, filtering, pagination,
 * editing, suggestions, type metadata, and MCP app lifecycle.
 */
export function useWorkItemsData(app: App | null) {
  // Core data
  const [allWorkItems, setAllWorkItems] = useState<WorkItem[]>([]);
  const [status, setStatus] = useState<AppStatus>("loading");

  // Filters & pagination
  const [filters, setFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Edit state
  const [editState, setEditState] = useState<EditState | null>(null);

  // Display configuration
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({});
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedValue[]>([]);
  const [queryContext, setQueryContext] = useState<QueryContext>({});

  // Type metadata (icons, colors, states)
  const [typeIconSvgMap, setTypeIconSvgMap] = useState<Record<string, string>>({});
  const [typeMetadataMap, setTypeMetadataMap] = useState<Record<string, WorkItemTypeMetadata>>({});
  const [typeColorMap, setTypeColorMap] = useState<Record<string, string>>({});
  const fetchedTypesRef = useRef<Set<string>>(new Set());

  // Derived: columns
  const columns = useMemo<ColumnConfig[]>(() => {
    const cols = displayConfig.columns?.length ? displayConfig.columns : DEFAULT_COLUMNS;
    return cols.map((c: ColumnConfig) => ({
      ...c,
      label: c.label ?? getFieldLabel(c.field),
      width: c.width ?? KNOWN_FIELD_WIDTHS[c.field],
    }));
  }, [displayConfig.columns]);

  const pageSize = displayConfig.pageSize ?? PAGE_SIZE;

  // Derived: filter options
  const filterOptions = useMemo(() => buildFilterOptions(allWorkItems), [allWorkItems]);

  // Derived: filtered + sorted items
  const filteredWorkItems = useMemo(() => applyFiltersAndSort(allWorkItems, filters, sortConfig), [allWorkItems, filters, sortConfig]);

  // Derived: pagination
  const totalPages = Math.max(1, Math.ceil(filteredWorkItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, filteredWorkItems.length);
  const pageItems = filteredWorkItems.slice(start, end);

  // Derived: allowed states for editing
  const editAllowedStates = useMemo(() => {
    if (!editState) return [];
    const wi = allWorkItems.find((w) => getWorkItemId(w) === editState.id);
    if (!wi?.fields) return [];
    const type = wi.fields["System.WorkItemType"] ?? "";
    const currentState = wi.fields["System.State"] ?? "";
    const meta = typeMetadataMap[type];
    if (!meta) return [];

    const transitions = meta.transitions[currentState];
    if (transitions?.length) {
      const targets = transitions.map((t: { to: string }) => t.to);
      return meta.states.filter((s) => targets.includes(s.name)).map((s) => s.name);
    }
    return meta.states.map((s) => s.name);
  }, [editState, allWorkItems, typeMetadataMap]);

  // ---- Tool result handler ----
  const handleToolResult = useCallback((result: { content?: ContentItem[]; isError?: boolean }) => {
    if (result.isError) {
      setStatus("error");
      return;
    }
    const textItem = result.content?.find((c) => c.type === "text");
    if (!textItem?.text) {
      setStatus("empty");
      return;
    }
    try {
      const data = JSON.parse(textItem.text);
      let workItems: WorkItem[];
      if (Array.isArray(data)) workItems = data;
      else if (data.workItems) workItems = data.workItems;
      else if (data.value) workItems = data.value;
      else workItems = [data];
      const valid = workItems.filter((wi) => wi && (wi.id || wi.fields));
      if (valid.length === 0) {
        setStatus("empty");
        return;
      }
      setAllWorkItems(valid);
      setStatus("table");

      if (data.displayConfig) {
        const cfg = data.displayConfig as DisplayConfig;
        setDisplayConfig((prev: DisplayConfig) => {
          const merged = { ...prev };
          if (cfg.columns?.length) merged.columns = cfg.columns;
          if (cfg.sort) merged.sort = cfg.sort;
          if (cfg.suggestedValues?.length) merged.suggestedValues = cfg.suggestedValues;
          if (cfg.pageSize != null) merged.pageSize = cfg.pageSize;
          return merged;
        });
        if (cfg.sort) setSortConfig(cfg.sort);
        if (cfg.suggestedValues?.length) setSuggestions(cfg.suggestedValues);
      }
    } catch {
      setStatus("empty");
    }
  }, []);

  // ---- Handlers ----
  const handleSort = useCallback((field: string) => {
    setSortConfig((prev: SortConfig | null) => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "asc" };
    });
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key: keyof ActiveFilters, value: string) => {
    setFilters((prev: ActiveFilters) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
  }, []);

  const handleStartEdit = useCallback(
    (id: number) => {
      const wi = allWorkItems.find((w) => getWorkItemId(w) === id);
      if (!wi?.fields) return;
      setEditState({
        id,
        fields: prepareEditFields(wi.fields as Record<string, unknown>),
        saving: false,
        statusMsg: "",
        statusType: "",
      });
    },
    [allWorkItems]
  );

  const handleCancelEdit = useCallback(() => setEditState(null), []);

  const handleFieldChange = useCallback((field: string, value: string | number) => {
    setEditState((prev: EditState | null) => (prev ? { ...prev, fields: { ...prev.fields, [field]: value } } : prev));
  }, []);

  const handleSave = useCallback(
    async (id: number) => {
      if (!editState || editState.saving || !app) return;
      setEditState((prev: EditState | null) => (prev ? { ...prev, saving: true, statusMsg: "", statusType: "" } : prev));

      const wi = allWorkItems.find((w) => getWorkItemId(w) === id);
      if (!wi?.fields) return;

      const updates: Record<string, string | number> = {};
      const origEdit = prepareEditFields(wi.fields as Record<string, unknown>);

      for (const [field, editValue] of Object.entries(editState.fields)) {
        if (READ_ONLY_FIELDS.has(field)) continue;
        if (String(editValue ?? "") !== String(origEdit[field] ?? "")) {
          updates[field] = typeof wi.fields[field as keyof typeof wi.fields] === "number" ? Number(editValue) : (editValue as string | number);
        }
      }

      if (Object.keys(updates).length === 0) {
        setEditState((prev: EditState | null) => (prev ? { ...prev, saving: false, statusMsg: "No changes to save", statusType: "success" } : prev));
        setTimeout(() => setEditState(null), 1500);
        return;
      }

      const patchOps = Object.entries(updates).map(([field, value]) => ({ op: "replace", path: `/fields/${field}`, value: String(value) }));

      try {
        const result = await app.callServerTool({ name: "wit_update_work_item", arguments: { id, updates: patchOps } });
        const textItem = (result.content as ContentItem[] | undefined)?.find((c) => c.type === "text");
        if (result.isError) {
          setEditState((prev: EditState | null) => (prev ? { ...prev, saving: false, statusMsg: `Update failed: ${textItem?.text ?? "Unknown error"}`, statusType: "error" } : prev));
          return;
        }
        if (textItem?.text) {
          try {
            const updated = JSON.parse(textItem.text);
            if (updated.fields) wi.fields = { ...wi.fields, ...updated.fields };
          } catch {
            /* fallback */
          }
        }
        for (const [key, val] of Object.entries(updates)) (wi.fields as Record<string, unknown>)[key] = val;
        setEditState(null);
        setAllWorkItems([...allWorkItems]);
      } catch (err) {
        setEditState((prev: EditState | null) => (prev ? { ...prev, saving: false, statusMsg: `Update failed: ${err}`, statusType: "error" } : prev));
      }
    },
    [editState, app, allWorkItems]
  );

  const getSuggestion = useCallback(
    (workItemId: number, field: string): SuggestedValue | undefined => {
      return suggestions.find((s) => s.workItemId === workItemId && s.field === field);
    },
    [suggestions]
  );

  const handleAcceptSuggestion = useCallback(
    async (suggestion: SuggestedValue) => {
      if (!app) return;
      const wi = allWorkItems.find((w) => getWorkItemId(w) === suggestion.workItemId);
      if (!wi?.fields) return;

      const patchOps = [{ op: "replace" as const, path: `/fields/${suggestion.field}`, value: String(suggestion.value) }];

      try {
        const result = await app.callServerTool({ name: "wit_update_work_item", arguments: { id: suggestion.workItemId, updates: patchOps } });
        if (!result.isError) {
          (wi.fields as Record<string, unknown>)[suggestion.field] = suggestion.value;
          setAllWorkItems([...allWorkItems]);
          setSuggestions((prev) => prev.filter((s) => !(s.workItemId === suggestion.workItemId && s.field === suggestion.field)));
        }
      } catch {
        // Silently fail — user can retry
      }
    },
    [app, allWorkItems]
  );

  const handleDismissSuggestion = useCallback((workItemId: number, field: string) => {
    setSuggestions((prev) => prev.filter((s) => !(s.workItemId === workItemId && s.field === field)));
  }, []);

  const toggleExpandRow = useCallback(
    (id: number) => {
      setExpandedRow(expandedRow === id ? null : id);
      if (expandedRow === id) setEditState(null);
    },
    [expandedRow]
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setExpandedRow(null);
    setEditState(null);
  }, [filters]);

  // ---- Fetch type icons & metadata ----
  useEffect(() => {
    if (!app || allWorkItems.length === 0) return;
    const types = new Set<string>();
    let project = "";
    for (const wi of allWorkItems) {
      const t = wi.fields?.["System.WorkItemType"];
      if (t && !fetchedTypesRef.current.has(t)) types.add(t);
      if (!project && wi.fields?.["System.AreaPath"]) {
        project = String(wi.fields["System.AreaPath"]).split("\\")[0];
      }
    }
    if (!project || types.size === 0) return;
    for (const t of types) fetchedTypesRef.current.add(t);

    const fetchTypeData = async () => {
      const newIcons: Record<string, string> = {};
      const newMeta: Record<string, WorkItemTypeMetadata> = {};
      const newColors: Record<string, string> = {};

      await Promise.all(
        [...types].map(async (type) => {
          try {
            const [iconResult, typeResult] = await Promise.all([
              app.callServerTool({ name: "wit_get_work_item_type_icon", arguments: { project, workItemType: type } }),
              app.callServerTool({ name: "wit_get_work_item_type", arguments: { project, workItemType: type } }),
            ]);
            const iconText = (iconResult.content as ContentItem[] | undefined)?.find((c) => c.type === "text");
            if (iconText?.text) {
              const data = JSON.parse(iconText.text);
              if (data.svg) newIcons[type] = data.svg;
            }
            const typeText = (typeResult.content as ContentItem[] | undefined)?.find((c) => c.type === "text");
            if (typeText?.text) {
              const data = JSON.parse(typeText.text);
              if (data.states || data.transitions) newMeta[type] = { states: data.states ?? [], transitions: data.transitions ?? {} };
              if (data.color) newColors[type] = `#${data.color}`;
            }
          } catch {
            /* skip failed fetches */
          }
        })
      );

      if (Object.keys(newIcons).length) setTypeIconSvgMap((prev) => ({ ...prev, ...newIcons }));
      if (Object.keys(newMeta).length) setTypeMetadataMap((prev) => ({ ...prev, ...newMeta }));
      if (Object.keys(newColors).length) setTypeColorMap((prev) => ({ ...prev, ...newColors }));
    };
    fetchTypeData();
  }, [app, allWorkItems]);

  return {
    // State
    status,
    setStatus,
    allWorkItems,
    filters,
    currentPage,
    setCurrentPage,
    expandedRow,
    editState,
    displayConfig,
    setDisplayConfig,
    sortConfig,
    suggestions,
    setSuggestions,
    queryContext,
    setQueryContext,
    typeIconSvgMap,
    typeMetadataMap,
    typeColorMap,

    // Derived
    columns,
    pageSize,
    filterOptions,
    filteredWorkItems,
    totalPages,
    safePage,
    start,
    end,
    pageItems,
    editAllowedStates,

    // Handlers
    handleToolResult,
    handleSort,
    handleFilterChange,
    handleClearFilters,
    handleStartEdit,
    handleCancelEdit,
    handleFieldChange,
    handleSave,
    getSuggestion,
    handleAcceptSuggestion,
    handleDismissSuggestion,
    toggleExpandRow,
  };
}
