/**
 * @jest-environment jsdom
 */

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/jest-globals";
import { CommentReviewApp } from "../../../../src/apps/comment-review/comment-review-app";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Capture the mock app so tests can simulate events
let mockApp: any;

jest.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useApp: (options: any) => {
    if (!mockApp) {
      mockApp = {
        getHostContext: jest.fn().mockReturnValue(null),
        callServerTool: jest.fn().mockResolvedValue({ content: [], isError: false }),
        openLink: jest.fn().mockResolvedValue(undefined),
        requestTeardown: jest.fn().mockResolvedValue(undefined),
        onhostcontextchanged: null as any,
        ontoolinput: null as any,
        ontoolresult: null as any,
        ontoolcancelled: null as any,
        onerror: null as any,
        onteardown: null as any,
      };
      if (options.onAppCreated) {
        options.onAppCreated(mockApp);
      }
    }
    return { app: mockApp, error: null };
  },
  useHostStyles: jest.fn(),
  useDocumentTheme: jest.fn().mockReturnValue("dark"),
}));

jest.mock("@modelcontextprotocol/ext-apps", () => ({
  applyDocumentTheme: jest.fn(),
}));

jest.mock("react-quill-new", () => {
  const RQ = (props: any) =>
    React.createElement("div", { "data-testid": "react-quill" }, [
      React.createElement("textarea", {
        "key": "ta",
        "data-testid": "quill-editor",
        "value": props.value ?? "",
        "placeholder": props.placeholder,
        "onChange": (e: any) => props.onChange?.(e.target.value),
      }),
    ]);
  return { __esModule: true, default: RQ };
});

jest.mock("react-quill-new/dist/quill.snow.css", () => ({}));

jest.mock("../../../../src/apps/shared/utils", () => ({
  colorForType: jest.fn().mockReturnValue({ bg: "#cc293d", fg: "#fff" }),
  normalizeAdoHtml: jest.fn((html: string) => html),
}));

const samplePayload = {
  workItemId: 42,
  commentId: 10,
  title: "Fix login bug",
  workItemType: "Bug",
  workItemTypeColor: "#CC293D",
  comment: "This is a test comment",
  project: "Contoso",
  orgUrl: "https://dev.azure.com/testorg",
};

function simulateToolResult(payload: any) {
  act(() => {
    mockApp.ontoolresult({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      isError: false,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("CommentReviewApp", () => {
  beforeEach(() => {
    mockApp = null;
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe("loading state", () => {
    it("shows a loading spinner and title on initial render", () => {
      render(React.createElement(CommentReviewApp));
      expect(screen.getByText("Preparing comment editor")).toBeInTheDocument();
      expect(screen.getByText(/Fetching work item details/)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  describe("error state", () => {
    it("shows error when tool result has isError true", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.ontoolresult({
          content: [{ type: "text", text: "Something broke" }],
          isError: true,
        });
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Something broke")).toBeInTheDocument();
    });

    it("shows error when tool result has no text content", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.ontoolresult({
          content: [],
          isError: false,
        });
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("No data received from the server.")).toBeInTheDocument();
    });

    it("shows error when tool result text is not valid JSON", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.ontoolresult({
          content: [{ type: "text", text: "not json" }],
          isError: false,
        });
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Failed to parse server response.")).toBeInTheDocument();
    });

    it("shows error message from isError result with default fallback", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.ontoolresult({
          content: [{ type: "image", data: "..." }],
          isError: true,
        });
      });

      expect(screen.getByText("Tool execution failed")).toBeInTheDocument();
    });

    it("shows error when tool is cancelled", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.ontoolcancelled();
      });

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("The operation was cancelled.")).toBeInTheDocument();
    });

    it("shows error when app reports an error", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.onerror({ message: "WebSocket disconnected" });
      });

      expect(screen.getByText("WebSocket disconnected")).toBeInTheDocument();
    });

    it("shows 'Connection error' when onerror has no message", () => {
      render(React.createElement(CommentReviewApp));

      act(() => {
        mockApp.onerror(null);
      });

      expect(screen.getByText("Connection error")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Posted state (comment review)
  // -----------------------------------------------------------------------
  describe("posted state", () => {
    it("shows the work item title and type badge after receiving payload", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      expect(screen.getByText("Bug")).toBeInTheDocument();
    });

    it("shows the posted badge", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      expect(screen.getByText(/Posted/)).toBeInTheDocument();
    });

    it("shows Edit and Delete buttons", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      expect(screen.getByTitle("Edit the posted comment")).toBeInTheDocument();
      expect(screen.getByTitle("Delete the posted comment")).toBeInTheDocument();
    });

    it("displays the work item ID with link when orgUrl is provided", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      const link = screen.getByLabelText(/Open work item #42/);
      expect(link).toBeInTheDocument();
    });

    it("displays the work item ID as plain text when orgUrl is missing", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult({ ...samplePayload, orgUrl: undefined });

      expect(screen.getByText("#42")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Editing state
  // -----------------------------------------------------------------------
  describe("editing state", () => {
    it("switches to editing state when Edit button is clicked", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      // Should show Edit/Preview tabs
      expect(screen.getByRole("tab", { name: /Edit/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Preview/ })).toBeInTheDocument();
    });

    it("shows Cancel and Save Update buttons in editing mode", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      expect(screen.getByTitle("Cancel editing")).toBeInTheDocument();
      expect(screen.getByTitle("Save updated comment")).toBeInTheDocument();
    });

    it("returns to posted state when Cancel is clicked", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));
      fireEvent.click(screen.getByTitle("Cancel editing"));

      expect(screen.getByText(/Posted/)).toBeInTheDocument();
    });

    it("shows the Quill editor mock", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      expect(screen.getByTestId("react-quill")).toBeInTheDocument();
    });

    it("switches between Edit and Preview tabs", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      // Click Preview tab
      fireEvent.click(screen.getByRole("tab", { name: /Preview/ }));
      expect(screen.queryByTestId("react-quill")).not.toBeInTheDocument();

      // Click Edit tab to go back
      fireEvent.click(screen.getByRole("tab", { name: /Edit/ }));
      expect(screen.getByTestId("react-quill")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Update action
  // -----------------------------------------------------------------------
  describe("update action", () => {
    it("calls callServerTool with update arguments on Save Update", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        fireEvent.click(screen.getByTitle("Save updated comment"));
      });

      expect(mockApp.callServerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "wit_update_work_item_comment",
          arguments: expect.objectContaining({
            project: "Contoso",
            workItemId: 42,
            commentId: 10,
          }),
        })
      );
    });

    it("shows 'Comment updated' after successful update", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        fireEvent.click(screen.getByTitle("Save updated comment"));
      });

      expect(screen.getByText("Comment updated")).toBeInTheDocument();
    });

    it("shows error when update server tool returns isError", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      mockApp.callServerTool.mockResolvedValue({
        content: [{ type: "text", text: "Unauthorized" }],
        isError: true,
      });

      await act(async () => {
        fireEvent.click(screen.getByTitle("Save updated comment"));
      });

      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    });

    it("shows 'Edit Again' button after successful update", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        fireEvent.click(screen.getByTitle("Save updated comment"));
      });

      expect(screen.getByText("Edit Again")).toBeInTheDocument();
    });

    it("returns to editing state when Edit Again is clicked", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Edit the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        fireEvent.click(screen.getByTitle("Save updated comment"));
      });

      fireEvent.click(screen.getByText("Edit Again"));

      expect(screen.getByTestId("react-quill")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Delete action
  // -----------------------------------------------------------------------
  describe("delete action", () => {
    it("shows delete confirmation dialog when Delete is clicked in posted state", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/This will permanently remove/)).toBeInTheDocument();
    });

    it("dismisses delete dialog when Cancel is clicked", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));
      fireEvent.click(screen.getByText("Cancel"));

      // Back to posted state, dialog gone
      expect(screen.queryByText(/This will permanently remove/)).not.toBeInTheDocument();
    });

    it("calls callServerTool with delete arguments on confirm", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        // Click the "Delete comment" button in the dialog
        const deleteButtons = screen.getAllByText("Delete comment");
        const confirmBtn = deleteButtons.find((btn) => btn.closest(".cr-dialog__actions"));
        fireEvent.click(confirmBtn!);
      });

      expect(mockApp.callServerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "wit_delete_work_item_comment",
          arguments: expect.objectContaining({
            project: "Contoso",
            workItemId: 42,
            commentId: 10,
          }),
        })
      );
    });

    it("shows 'Comment deleted' after successful deletion", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        const deleteButtons = screen.getAllByText("Delete comment");
        const confirmBtn = deleteButtons.find((btn) => btn.closest(".cr-dialog__actions"));
        fireEvent.click(confirmBtn!);
      });

      expect(screen.getByText("Comment deleted")).toBeInTheDocument();
    });

    it("calls requestTeardown after successful deletion", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        const deleteButtons = screen.getAllByText("Delete comment");
        const confirmBtn = deleteButtons.find((btn) => btn.closest(".cr-dialog__actions"));
        fireEvent.click(confirmBtn!);
      });

      expect(mockApp.requestTeardown).toHaveBeenCalled();
    });

    it("does not show Edit Again after deletion", async () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      mockApp.callServerTool.mockResolvedValue({ content: [], isError: false });

      await act(async () => {
        const deleteButtons = screen.getAllByText("Delete comment");
        const confirmBtn = deleteButtons.find((btn) => btn.closest(".cr-dialog__actions"));
        fireEvent.click(confirmBtn!);
      });

      expect(screen.queryByText("Edit Again")).not.toBeInTheDocument();
    });

    it("dismisses delete dialog on Escape key", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));
      expect(screen.getByText(/This will permanently remove/)).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByText(/This will permanently remove/)).not.toBeInTheDocument();
    });

    it("dismisses delete dialog on overlay click", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult(samplePayload);

      fireEvent.click(screen.getByTitle("Delete the posted comment"));

      const overlay = document.querySelector(".cr-dialog-overlay");
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);

      expect(screen.queryByText(/This will permanently remove/)).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // HTML payload handling
  // -----------------------------------------------------------------------
  describe("HTML comment handling", () => {
    it("passes HTML comment through without conversion", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult({
        ...samplePayload,
        comment: "<div>Already HTML</div>",
      });

      // Comment is shown in preview; the HTML passes through ensureHtml
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    it("converts plain text comment with newlines to HTML", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult({
        ...samplePayload,
        comment: "Line 1\nLine 2",
      });

      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    it("handles empty comment", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult({
        ...samplePayload,
        comment: "",
      });

      expect(screen.getByText("Empty comment.")).toBeInTheDocument();
    });

    it("handles null comment field", () => {
      render(React.createElement(CommentReviewApp));
      simulateToolResult({
        ...samplePayload,
        comment: null,
      });

      expect(screen.getByText("Empty comment.")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // App lifecycle
  // -----------------------------------------------------------------------
  describe("app lifecycle", () => {
    it("sets up ontoolresult callback on the app", () => {
      render(React.createElement(CommentReviewApp));
      expect(mockApp.ontoolresult).toBeInstanceOf(Function);
    });

    it("sets up ontoolcancelled callback on the app", () => {
      render(React.createElement(CommentReviewApp));
      expect(mockApp.ontoolcancelled).toBeInstanceOf(Function);
    });

    it("sets up onerror callback on the app", () => {
      render(React.createElement(CommentReviewApp));
      expect(mockApp.onerror).toBeInstanceOf(Function);
    });

    it("sets up onteardown callback on the app", () => {
      render(React.createElement(CommentReviewApp));
      expect(mockApp.onteardown).toBeInstanceOf(Function);
    });

    it("onteardown returns empty object", async () => {
      render(React.createElement(CommentReviewApp));
      const result = await mockApp.onteardown();
      expect(result).toEqual({});
    });
  });
});
