/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useWorkItemsData } from "../../../../src/apps/work-items/hooks/use-work-items-data";
import { useColumnResize } from "../../../../src/apps/work-items/hooks/use-column-resize";

// ======== useWorkItemsData ========

describe("useWorkItemsData", () => {
  it("initializes with loading status", () => {
    const { result } = renderHook(() => useWorkItemsData(null));
    expect(result.current.status).toBe("loading");
    expect(result.current.allWorkItems).toEqual([]);
    expect(result.current.pageItems).toEqual([]);
  });

  it("processes tool result with work items", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "Bug A", "System.State": "Active", "System.WorkItemType": "Bug" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "Task B", "System.State": "New", "System.WorkItemType": "Task" } },
              ],
            }),
          },
        ],
      });
    });

    expect(result.current.status).toBe("table");
    expect(result.current.allWorkItems).toHaveLength(2);
    expect(result.current.filteredWorkItems).toHaveLength(2);
  });

  it("handles error tool result", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({ content: [{ type: "text", text: "error" }], isError: true });
    });

    expect(result.current.status).toBe("error");
  });

  it("handles empty tool result", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({ content: [{ type: "text", text: "[]" }] });
    });

    expect(result.current.status).toBe("empty");
  });

  it("handles tool result with no text content", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({ content: [] });
    });

    expect(result.current.status).toBe("empty");
  });

  it("handles malformed JSON in tool result", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({ content: [{ type: "text", text: "not json" }] });
    });

    expect(result.current.status).toBe("empty");
  });

  it("parses data.value format", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ value: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Item" } }] }) }],
      });
    });

    expect(result.current.status).toBe("table");
    expect(result.current.allWorkItems).toHaveLength(1);
  });

  it("parses flat array format", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify([{ id: 1, fields: { "System.Id": 1, "System.Title": "Item" } }]) }],
      });
    });

    expect(result.current.status).toBe("table");
    expect(result.current.allWorkItems).toHaveLength(1);
  });

  it("applies displayConfig from tool result", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Item" } }],
              displayConfig: { pageSize: 25, sort: { field: "System.Id", direction: "desc" } },
            }),
          },
        ],
      });
    });

    expect(result.current.pageSize).toBe(25);
    expect(result.current.sortConfig).toEqual({ field: "System.Id", direction: "desc" });
  });

  // ---- Filtering ----

  it("filters by search text", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "Login bug", "System.State": "Active" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "Dashboard", "System.State": "New" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => {
      result.current.handleFilterChange("search", "login");
    });

    expect(result.current.filteredWorkItems).toHaveLength(1);
    expect(result.current.filteredWorkItems[0].fields?.["System.Title"]).toBe("Login bug");
  });

  it("filters by state", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "A", "System.State": "Active" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "B", "System.State": "New" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => {
      result.current.handleFilterChange("state", "Active");
    });

    expect(result.current.filteredWorkItems).toHaveLength(1);
  });

  it("filters by type", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "A", "System.WorkItemType": "Bug" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "B", "System.WorkItemType": "Task" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => {
      result.current.handleFilterChange("type", "Bug");
    });

    expect(result.current.filteredWorkItems).toHaveLength(1);
  });

  it("filters by priority", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "A", "Microsoft.VSTS.Common.Priority": 1 } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "B", "Microsoft.VSTS.Common.Priority": 3 } },
              ],
            }),
          },
        ],
      });
    });

    act(() => {
      result.current.handleFilterChange("priority", "Critical");
    });

    expect(result.current.filteredWorkItems).toHaveLength(1);
  });

  it("filters by tag", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "A", "System.Tags": "frontend; api" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "B", "System.Tags": "backend" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => {
      result.current.handleFilterChange("tag", "frontend");
    });

    expect(result.current.filteredWorkItems).toHaveLength(1);
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.Title": "A", "System.State": "Active" } },
                { id: 2, fields: { "System.Id": 2, "System.Title": "B", "System.State": "New" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => result.current.handleFilterChange("state", "Active"));
    expect(result.current.filteredWorkItems).toHaveLength(1);

    act(() => result.current.handleClearFilters());
    expect(result.current.filteredWorkItems).toHaveLength(2);
  });

  // ---- Sorting ----

  it("sorts by field", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 2, fields: { "System.Id": 2, "System.Title": "B" } },
                { id: 1, fields: { "System.Id": 1, "System.Title": "A" } },
              ],
            }),
          },
        ],
      });
    });

    act(() => result.current.handleSort("System.Id"));

    expect(result.current.filteredWorkItems[0].id).toBe(1);
    expect(result.current.sortConfig).toEqual({ field: "System.Id", direction: "asc" });
  });

  it("toggles sort direction on same field", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ workItems: [{ id: 1, fields: { "System.Id": 1 } }] }) }],
      });
    });

    act(() => result.current.handleSort("System.Id"));
    expect(result.current.sortConfig?.direction).toBe("asc");

    act(() => result.current.handleSort("System.Id"));
    expect(result.current.sortConfig?.direction).toBe("desc");
  });

  // ---- Pagination ----

  it("computes pagination correctly", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, fields: { "System.Id": i + 1, "System.Title": `Item ${i + 1}` } }));
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ workItems: items }) }],
      });
    });

    expect(result.current.totalPages).toBe(3); // 25 items / 10 per page = 3 pages
    expect(result.current.pageItems).toHaveLength(10);
    expect(result.current.safePage).toBe(1);
  });

  // ---- Expand row ----

  it("toggles expanded row", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "A" } }] }) }],
      });
    });

    act(() => result.current.toggleExpandRow(1));
    expect(result.current.expandedRow).toBe(1);

    act(() => result.current.toggleExpandRow(1));
    expect(result.current.expandedRow).toBeNull();
  });

  // ---- Edit state ----

  it("starts editing a work item", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Test Bug", "System.State": "Active" } }],
            }),
          },
        ],
      });
    });

    act(() => result.current.handleStartEdit(1));

    expect(result.current.editState).not.toBeNull();
    expect(result.current.editState?.id).toBe(1);
    expect(result.current.editState?.fields["System.Title"]).toBe("Test Bug");
  });

  it("cancels editing", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Test" } }] }) }],
      });
    });

    act(() => result.current.handleStartEdit(1));
    expect(result.current.editState).not.toBeNull();

    act(() => result.current.handleCancelEdit());
    expect(result.current.editState).toBeNull();
  });

  it("updates a field in edit state", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [{ type: "text", text: JSON.stringify({ workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Old" } }] }) }],
      });
    });

    act(() => result.current.handleStartEdit(1));
    act(() => result.current.handleFieldChange("System.Title", "New Title"));

    expect(result.current.editState?.fields["System.Title"]).toBe("New Title");
  });

  // ---- Suggestions ----

  it("finds suggestions for a work item field", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Test" } }],
              displayConfig: { suggestedValues: [{ workItemId: 1, field: "Microsoft.VSTS.Common.Priority", value: 1 }] },
            }),
          },
        ],
      });
    });

    const suggestion = result.current.getSuggestion(1, "Microsoft.VSTS.Common.Priority");
    expect(suggestion).toBeDefined();
    expect(suggestion?.value).toBe(1);
  });

  it("dismisses a suggestion", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [{ id: 1, fields: { "System.Id": 1, "System.Title": "Test" } }],
              displayConfig: { suggestedValues: [{ workItemId: 1, field: "Microsoft.VSTS.Common.Priority", value: 1 }] },
            }),
          },
        ],
      });
    });

    expect(result.current.suggestions).toHaveLength(1);

    act(() => result.current.handleDismissSuggestion(1, "Microsoft.VSTS.Common.Priority"));

    expect(result.current.suggestions).toHaveLength(0);
  });

  // ---- Filter options ----

  it("builds filter options from work items", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [
                { id: 1, fields: { "System.Id": 1, "System.State": "Active", "System.WorkItemType": "Bug", "Microsoft.VSTS.Common.Priority": 1, "System.Tags": "frontend; api" } },
                { id: 2, fields: { "System.Id": 2, "System.State": "New", "System.WorkItemType": "Task", "Microsoft.VSTS.Common.Priority": 3, "System.Tags": "backend" } },
              ],
            }),
          },
        ],
      });
    });

    expect(result.current.filterOptions.states).toContain("Active");
    expect(result.current.filterOptions.states).toContain("New");
    expect(result.current.filterOptions.types).toContain("Bug");
    expect(result.current.filterOptions.types).toContain("Task");
    expect(result.current.filterOptions.tags).toContain("frontend");
    expect(result.current.filterOptions.tags).toContain("api");
    expect(result.current.filterOptions.tags).toContain("backend");
  });

  // ---- Columns ----

  it("uses default columns when no displayConfig columns", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    expect(result.current.columns.length).toBeGreaterThan(0);
    expect(result.current.columns[0].field).toBe("System.Id");
  });

  it("uses displayConfig columns when provided", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => {
      result.current.handleToolResult({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              workItems: [{ id: 1, fields: { "System.Id": 1 } }],
              displayConfig: { columns: [{ field: "System.Title", label: "Name" }] },
            }),
          },
        ],
      });
    });

    expect(result.current.columns).toHaveLength(1);
    expect(result.current.columns[0].label).toBe("Name");
  });

  // ---- setStatus ----

  it("allows setting status directly", () => {
    const { result } = renderHook(() => useWorkItemsData(null));

    act(() => result.current.setStatus("error"));
    expect(result.current.status).toBe("error");

    act(() => result.current.setStatus("loading"));
    expect(result.current.status).toBe("loading");
  });
});

// ======== useColumnResize ========

describe("useColumnResize", () => {
  it("initializes with empty column widths", () => {
    const { result } = renderHook(() => useColumnResize());
    expect(result.current.columnWidths).toEqual({});
  });

  it("returns handleResizeStart as a function", () => {
    const { result } = renderHook(() => useColumnResize());
    expect(typeof result.current.handleResizeStart).toBe("function");
  });

  it("does nothing when target has no th parent", () => {
    const { result } = renderHook(() => useColumnResize());

    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      target: { closest: jest.fn().mockReturnValue(null) },
      clientX: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart("System.Id", mockEvent);
    });

    expect(result.current.columnWidths).toEqual({});
  });
});
