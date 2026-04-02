/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkItemsApp } from "../../../../src/apps/work-items/work-items-app";

// Mock CSS import
jest.mock("../../../../src/apps/work-items/work-items-app.css", () => ({}));

// Mock ext-apps/react to control the app lifecycle
jest.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useApp: (options: any) => {
    const appRef = React.useRef<any>(null);
    if (!appRef.current) {
      const mockApp: any = {
        getHostContext: () => null,
        callServerTool: jest.fn().mockResolvedValue({ content: [], isError: false }),
        openLink: jest.fn().mockResolvedValue(undefined),
        sendLog: jest.fn(),
        updateModelContext: jest.fn().mockResolvedValue(undefined),
        onhostcontextchanged: null,
        ontoolinput: null,
        ontoolinputpartial: null,
        ontoolresult: null,
        ontoolcancelled: null,
        onerror: null,
        onteardown: null,
      };
      appRef.current = mockApp;
      if (options.onAppCreated) options.onAppCreated(mockApp);
    }
    return { app: appRef.current, error: null };
  },
  useHostStyles: () => {
    /* no-op in tests */
  },
}));

const sampleWorkItems = [
  {
    id: 1,
    url: "https://dev.azure.com/org/proj/_apis/wit/workItems/1",
    fields: {
      "System.Id": 1,
      "System.Title": "Fix login bug",
      "System.State": "Active",
      "System.WorkItemType": "Bug",
      "System.AssignedTo": "Alice <alice@test.com>",
      "Microsoft.VSTS.Common.Priority": 2,
      "System.Tags": "frontend; security",
    },
  },
  {
    id: 2,
    url: "https://dev.azure.com/org/proj/_apis/wit/workItems/2",
    fields: {
      "System.Id": 2,
      "System.Title": "Add dashboard feature",
      "System.State": "New",
      "System.WorkItemType": "User Story",
      "System.AssignedTo": "Bob <bob@test.com>",
      "Microsoft.VSTS.Common.Priority": 3,
      "System.Tags": "backend",
    },
  },
  {
    id: 3,
    url: "https://dev.azure.com/org/proj/_apis/wit/workItems/3",
    fields: {
      "System.Id": 3,
      "System.Title": "Write unit tests",
      "System.State": "Active",
      "System.WorkItemType": "Task",
      "System.AssignedTo": "Alice <alice@test.com>",
      "Microsoft.VSTS.Common.Priority": 1,
      "System.Tags": "backend; testing",
    },
  },
];

function renderAndLoadData() {
  let capturedApp: any;

  // Override useApp to capture the app reference
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const useAppModule = require("@modelcontextprotocol/ext-apps/react");
  const originalUseApp = useAppModule.useApp;
  useAppModule.useApp = (options: any) => {
    const result = originalUseApp(options);
    capturedApp = result.app;
    return result;
  };

  const { container } = render(<WorkItemsApp />);

  // Simulate tool result delivery
  act(() => {
    if (capturedApp?.ontoolresult) {
      capturedApp.ontoolresult({
        content: [
          {
            type: "text",
            text: JSON.stringify({ workItems: sampleWorkItems }),
          },
        ],
        isError: false,
      });
    }
  });

  // Restore
  useAppModule.useApp = originalUseApp;

  return { container, app: capturedApp };
}

describe("WorkItemsApp", () => {
  describe("loading state", () => {
    it("shows loading spinner initially", () => {
      render(<WorkItemsApp />);
      expect(screen.getByText(/loading work items/i)).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error state when tool result has error", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolresult?.({
          content: [{ type: "text", text: "Something went wrong" }],
          isError: true,
        });
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });
  });

  describe("empty state", () => {
    it("shows empty state when no work items returned", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolresult?.({
          content: [{ type: "text", text: JSON.stringify([]) }],
          isError: false,
        });
      });

      expect(screen.getByText("No work items found")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });
  });

  describe("table state", () => {
    it("renders work items table with data", () => {
      renderAndLoadData();

      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      expect(screen.getByText("Add dashboard feature")).toBeInTheDocument();
      expect(screen.getByText("Write unit tests")).toBeInTheDocument();
    });

    it("renders column headers", () => {
      renderAndLoadData();

      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("State")).toBeInTheDocument();
      expect(screen.getByText("Assigned To")).toBeInTheDocument();
    });

    it("renders filter bar", () => {
      renderAndLoadData();

      expect(screen.getByPlaceholderText(/search by title or id/i)).toBeInTheDocument();
    });

    it("shows work item count in footer", () => {
      renderAndLoadData();

      expect(screen.getByText(/of 3 work items/)).toBeInTheDocument();
    });

    it("renders expand buttons for each visible work item row", () => {
      renderAndLoadData();

      const expandBtns = screen.getAllByRole("button").filter((btn) => btn.classList.contains("expand-btn"));
      expect(expandBtns.length).toBe(3);
    });

    it("expands a row when clicked", () => {
      renderAndLoadData();

      // Click on the first work item row
      const rows = screen.getAllByRole("row");
      // Skip header row (index 0), click on data row
      fireEvent.click(rows[1]);

      // The expanded content should now be visible — look for Edit button
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    it("sorts by column when header is clicked", () => {
      renderAndLoadData();

      // Click on the ID column header to sort
      fireEvent.click(screen.getByText("ID"));

      // The sort indicator should appear
      const header = screen.getByText("ID").closest("th");
      expect(header?.className).toContain("sorted");
    });

    it("renders View query button", () => {
      renderAndLoadData();

      expect(screen.getByText(/view query/i)).toBeInTheDocument();
    });
  });

  describe("displayConfig handling", () => {
    it("applies displayConfig from tool result", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolresult?.({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                workItems: sampleWorkItems,
                displayConfig: {
                  columns: [
                    { field: "System.Id", label: "ID" },
                    { field: "System.Title", label: "Title" },
                    { field: "Microsoft.VSTS.Common.Priority", label: "Priority" },
                  ],
                },
              }),
            },
          ],
          isError: false,
        });
      });

      // Custom columns should be rendered
      expect(screen.getByText("Priority")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });
  });

  describe("renderCell branches", () => {
    it("renders tag pills for System.Tags column", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolresult?.({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                workItems: sampleWorkItems,
                displayConfig: {
                  columns: [
                    { field: "System.Id", label: "ID" },
                    { field: "System.Title", label: "Title" },
                    { field: "System.Tags", label: "Tags" },
                  ],
                },
              }),
            },
          ],
          isError: false,
        });
      });

      // Tag pills should be rendered
      expect(screen.getAllByText("frontend").length).toBeGreaterThan(0);
      expect(screen.getAllByText("security").length).toBeGreaterThan(0);
      useAppModule.useApp = originalUseApp;
    });

    it("renders default cell value via formatCellValue for unknown fields", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolresult?.({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                workItems: [
                  {
                    id: 1,
                    fields: {
                      "System.Id": 1,
                      "System.Title": "Test",
                      "System.State": "Active",
                      "System.WorkItemType": "Bug",
                      "System.AssignedTo": "Alice",
                      "Custom.MyField": "custom-value",
                    },
                  },
                ],
                displayConfig: {
                  columns: [
                    { field: "System.Id", label: "ID" },
                    { field: "Custom.MyField", label: "My Field" },
                  ],
                },
              }),
            },
          ],
          isError: false,
        });
      });

      expect(screen.getByText("custom-value")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });
  });

  describe("event handlers", () => {
    it("handles ontoolinput with tool arguments", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      // ontoolinput should not throw when arguments are provided
      act(() => {
        capturedApp?.ontoolinput?.({
          arguments: {
            project: "TestProject",
            type: "assignedtome",
            columns: [{ field: "System.Id", label: "ID" }],
            sort: { field: "System.Id", direction: "asc" },
            pageSize: 25,
          },
        });
      });

      // Should still be in loading state after ontoolinput
      expect(screen.getByText(/loading work items/i)).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });

    it("handles ontoolcancelled event", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolcancelled?.();
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });

    it("handles onerror event", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.onerror?.(new Error("test error"));
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });

    it("handles ontoolinputpartial event (sets loading)", () => {
      let capturedApp: any;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const useAppModule = require("@modelcontextprotocol/ext-apps/react");
      const originalUseApp = useAppModule.useApp;
      useAppModule.useApp = (options: any) => {
        const result = originalUseApp(options);
        capturedApp = result.app;
        return result;
      };

      render(<WorkItemsApp />);

      act(() => {
        capturedApp?.ontoolinputpartial?.({});
      });

      // Should show loading state
      expect(screen.getByText(/loading work items/i)).toBeInTheDocument();
      useAppModule.useApp = originalUseApp;
    });

    it("toggles query panel when View query is clicked", () => {
      renderAndLoadData();

      const viewQueryBtn = screen.getByText(/view query/i);
      fireEvent.click(viewQueryBtn);

      // Query panel should show WIQL
      expect(screen.getByText(/SELECT/)).toBeInTheDocument();
    });
  });
});
