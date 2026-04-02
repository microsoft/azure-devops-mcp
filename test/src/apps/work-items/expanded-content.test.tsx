/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExpandedContent } from "../../../../src/apps/work-items/components/expanded-content";
import type { WorkItem, EditState } from "../../../../src/apps/work-items/types";

// Mock the shared RoosterEditor component for jsdom (no real RoosterJS editor in tests)
jest.mock("../../../../src/apps/shared/rooster-editor/index", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const MockRoosterEditor = (props: any) =>
    React.createElement(
      "div",
      { "data-testid": "rooster-editor" },
      React.createElement("div", { "data-testid": "rooster-toolbar" }),
      React.createElement("div", { "data-testid": "rooster-content", "contentEditable": true })
    );
  return {
    __esModule: true,
    RoosterEditor: MockRoosterEditor,
  };
});

const sampleWorkItem: WorkItem = {
  id: 42,
  url: "https://dev.azure.com/org/proj/_apis/wit/workItems/42",
  fields: {
    "System.Id": 42,
    "System.Title": "Fix critical bug",
    "System.State": "Active",
    "System.WorkItemType": "Bug",
    "System.AssignedTo": "Jane Doe <jane@test.com>",
    "System.Tags": "frontend; critical",
    "Microsoft.VSTS.Common.Priority": 1,
    "System.Description": "<div>This is a detailed description of the bug.</div>",
    "Microsoft.VSTS.Scheduling.StoryPoints": 5,
  },
};

const noopHandlers = {
  onEdit: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
  onFieldChange: jest.fn(),
};

describe("ExpandedContent", () => {
  describe("view mode", () => {
    it("renders work item details", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Open in Azure DevOps")).toBeInTheDocument();
    });

    it("renders tags list", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("frontend")).toBeInTheDocument();
      expect(screen.getByText("critical")).toBeInTheDocument();
    });

    it("renders meta fields like Priority", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it('renders "No details available" when fields are missing', () => {
      render(<ExpandedContent wi={{ id: 1 }} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("No details available")).toBeInTheDocument();
    });

    it("calls onEdit when Edit button is clicked", () => {
      const onEdit = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={null}
          onEdit={onEdit}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          onFieldChange={jest.fn()}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      fireEvent.click(screen.getByText("Edit"));
      expect(onEdit).toHaveBeenCalledWith(42);
    });

    it("renders description section for HTML content", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("does not show Open in Azure DevOps when url is missing", () => {
      const wi = { ...sampleWorkItem, url: undefined };
      render(<ExpandedContent wi={wi} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.queryByText("Open in Azure DevOps")).not.toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    const editState: EditState = {
      id: 42,
      fields: {
        "System.Title": "Fix critical bug",
        "System.State": "Active",
        "Microsoft.VSTS.Common.Priority": 1,
        "System.AssignedTo": "Jane Doe",
        "System.Tags": "frontend; critical",
        "System.Description": "<div>Description</div>",
        "Microsoft.VSTS.Scheduling.StoryPoints": 5,
      },
      saving: false,
      statusMsg: "",
      statusType: "",
    };

    it("renders Save and Cancel buttons in edit mode", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={["Active", "Resolved", "Closed"]} typeMetadataMap={{}} />);

      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("renders title input field", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      const titleInput = screen.getByDisplayValue("Fix critical bug");
      expect(titleInput).toBeInTheDocument();
    });

    it("calls onFieldChange when title is changed", () => {
      const onFieldChange = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          onFieldChange={onFieldChange}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      const titleInput = screen.getByDisplayValue("Fix critical bug");
      fireEvent.change(titleInput, { target: { value: "Updated title" } });
      expect(onFieldChange).toHaveBeenCalledWith("System.Title", "Updated title");
    });

    it("calls onSave when Save is clicked", () => {
      const onSave = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={onSave}
          onCancel={jest.fn()}
          onFieldChange={jest.fn()}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      fireEvent.click(screen.getByText("Save"));
      expect(onSave).toHaveBeenCalledWith(42);
    });

    it("calls onCancel when Cancel is clicked", () => {
      const onCancel = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          onCancel={onCancel}
          onFieldChange={jest.fn()}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows Saving… when saving is in progress", () => {
      const savingState = { ...editState, saving: true };
      render(<ExpandedContent wi={sampleWorkItem} editState={savingState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Saving…")).toBeInTheDocument();
    });

    it("disables buttons when saving", () => {
      const savingState = { ...editState, saving: true };
      render(<ExpandedContent wi={sampleWorkItem} editState={savingState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Saving…")).toBeDisabled();
      expect(screen.getByText("Cancel")).toBeDisabled();
    });

    it("shows status message when present", () => {
      const stateWithMsg = { ...editState, statusMsg: "Update failed: 403", statusType: "error" as const };
      render(<ExpandedContent wi={sampleWorkItem} editState={stateWithMsg} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Update failed: 403")).toBeInTheDocument();
    });

    it("renders state dropdown with allowed states", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={["Active", "Resolved", "Closed"]} typeMetadataMap={{}} />);

      expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument();
    });

    it("renders priority dropdown with allowed values from server metadata", () => {
      const metadataMap = {
        Bug: {
          states: [],
          transitions: {},
          fields: [{ referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: ["1", "2", "3", "4"] }],
        },
      };
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={metadataMap} />);

      expect(screen.getByRole("option", { name: "1 - Critical" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "2 - High" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "3 - Medium" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "4 - Low" })).toBeInTheDocument();
    });

    it("renders tag editor in edit mode", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Tags")).toBeInTheDocument();
      expect(screen.getByText("frontend")).toBeInTheDocument();
      expect(screen.getByText("critical")).toBeInTheDocument();
    });

    it("renders people picker for Assigned To in edit mode", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Assigned To")).toBeInTheDocument();
    });

    it("renders rich text editor (RoosterEditor) for description in edit mode", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByTestId("rooster-editor")).toBeInTheDocument();
    });

    it("renders enum field dropdown with allowedValues from server metadata", () => {
      const wi: WorkItem = {
        ...sampleWorkItem,
        fields: { ...sampleWorkItem.fields, "Microsoft.VSTS.Common.Severity": "2 - High" },
      };
      const editSt: EditState = {
        ...editState,
        fields: { ...editState.fields, "Microsoft.VSTS.Common.Severity": "2 - High" },
      };
      const metadataMap = {
        Bug: {
          states: [],
          transitions: {},
          fields: [
            { referenceName: "Microsoft.VSTS.Common.Severity", name: "Severity", allowedValues: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"] },
            { referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: ["1", "2", "3", "4"] },
          ],
        },
      };
      render(<ExpandedContent wi={wi} editState={editSt} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={metadataMap} />);

      // Check that Severity label and its dropdown options exist
      expect(screen.getByText("Severity")).toBeInTheDocument();
      const severitySelect = screen.getByDisplayValue("2 - High");
      expect(severitySelect).toBeInTheDocument();
      // Count options within the severity select (4 severity values + 1 "None")
      const options = severitySelect.querySelectorAll("option");
      expect(options.length).toBe(5); // "— None —" + 4 values
    });

    it("renders numeric input for StoryPoints with type=number", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      const spInput = screen.getByDisplayValue("5");
      expect(spInput).toHaveAttribute("type", "number");
    });

    it("shows whitelisted fields from type schema even when not set on work item", () => {
      const taskWi: WorkItem = {
        id: 99,
        fields: {
          "System.Id": 99,
          "System.Title": "Task with no estimate",
          "System.State": "Active",
          "System.WorkItemType": "Task",
          "System.AssignedTo": "Jane Doe",
          "Microsoft.VSTS.Common.Priority": 2,
        },
      };
      const taskEditState: EditState = {
        id: 99,
        fields: { "System.Title": "Task with no estimate", "System.State": "Active", "System.AssignedTo": "Jane Doe", "Microsoft.VSTS.Common.Priority": 2 },
        saving: false,
        statusMsg: "",
        statusType: "",
      };
      const metadataMap = {
        Task: {
          states: [{ name: "Active", color: "", category: "" }],
          transitions: {},
          fields: [
            { referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: ["1", "2", "3", "4"] },
            { referenceName: "Microsoft.VSTS.Scheduling.RemainingWork", name: "Remaining Work", allowedValues: [] },
            { referenceName: "Microsoft.VSTS.Scheduling.OriginalEstimate", name: "Original Estimate", allowedValues: [] },
          ],
        },
      };
      render(<ExpandedContent wi={taskWi} editState={taskEditState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={metadataMap} />);

      // These fields should appear in edit mode even though they have no value on the work item
      expect(screen.getByText("Remaining Work")).toBeInTheDocument();
      expect(screen.getByText("Original Estimate")).toBeInTheDocument();
    });

    it("renders view mode with object-type meta values", () => {
      const wi: WorkItem = {
        ...sampleWorkItem,
        fields: {
          ...sampleWorkItem.fields,
          "System.AssignedTo": { displayName: "Object User", uniqueName: "obj@test.com" },
        },
      };
      render(<ExpandedContent wi={wi} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("Object User")).toBeInTheDocument();
    });

    it("renders view mode with numeric zero value displayed", () => {
      const wi: WorkItem = {
        ...sampleWorkItem,
        fields: {
          ...sampleWorkItem.fields,
          "Microsoft.VSTS.Scheduling.RemainingWork": 0,
        },
      };
      render(<ExpandedContent wi={wi} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("uses typeMetadataMap states when allowedStates is empty", () => {
      const metadataMap = {
        Bug: {
          states: [
            { name: "New", color: "", category: "" },
            { name: "Active", color: "", category: "" },
            { name: "Resolved", color: "", category: "" },
          ],
          transitions: {},
          fields: [{ referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: ["1", "2", "3", "4"] }],
        },
      };
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={metadataMap} />);

      expect(screen.getByRole("option", { name: "New" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Resolved" })).toBeInTheDocument();
    });

    it("falls back to current state value when no allowedStates or metadata", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      // Should still have at least the current value as an option
      expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    });

    it("fires onFieldChange with Number for Priority dropdown", () => {
      const onFieldChange = jest.fn();
      const metadataMap = {
        Bug: {
          states: [],
          transitions: {},
          fields: [{ referenceName: "Microsoft.VSTS.Common.Priority", name: "Priority", allowedValues: ["1", "2", "3", "4"] }],
        },
      };
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          onFieldChange={onFieldChange}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={metadataMap}
        />
      );

      const prioritySelect = screen.getByDisplayValue("1 - Critical");
      fireEvent.change(prioritySelect, { target: { value: "3" } });
      expect(onFieldChange).toHaveBeenCalledWith("Microsoft.VSTS.Common.Priority", 3);
    });

    it("fires onFieldChange with Number for numeric StoryPoints input", () => {
      const onFieldChange = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          onFieldChange={onFieldChange}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      const spInput = screen.getByDisplayValue("5");
      fireEvent.change(spInput, { target: { value: "8" } });
      expect(onFieldChange).toHaveBeenCalledWith("Microsoft.VSTS.Scheduling.StoryPoints", 8);
    });

    it("fires onFieldChange with empty string when numeric field is cleared", () => {
      const onFieldChange = jest.fn();
      render(
        <ExpandedContent
          wi={sampleWorkItem}
          editState={editState}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          onCancel={jest.fn()}
          onFieldChange={onFieldChange}
          app={undefined}
          allowedStates={[]}
          typeMetadataMap={{}}
        />
      );

      const spInput = screen.getByDisplayValue("5");
      fireEvent.change(spInput, { target: { value: "" } });
      expect(onFieldChange).toHaveBeenCalledWith("Microsoft.VSTS.Scheduling.StoryPoints", "");
    });

    it("opens link via app.openLink when app is provided", () => {
      const mockApp = { openLink: jest.fn().mockResolvedValue(undefined) };
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={mockApp as any} allowedStates={[]} typeMetadataMap={{}} />);

      fireEvent.click(screen.getByText("Open in Azure DevOps"));
      expect(mockApp.openLink).toHaveBeenCalled();
    });

    it("falls back to window.open when app.openLink rejects", async () => {
      const mockApp = { openLink: jest.fn().mockRejectedValue(new Error("fail")) };
      const windowSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={mockApp as any} allowedStates={[]} typeMetadataMap={{}} />);

      fireEvent.click(screen.getByText("Open in Azure DevOps"));
      await new Promise((r) => setTimeout(r, 10));
      expect(windowSpy).toHaveBeenCalled();
      windowSpy.mockRestore();
    });

    it("uses window.open directly when app is undefined", () => {
      const windowSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      render(<ExpandedContent wi={sampleWorkItem} editState={null} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      fireEvent.click(screen.getByText("Open in Azure DevOps"));
      expect(windowSpy).toHaveBeenCalledWith(expect.stringContaining("dev.azure.com"), "_blank", "noopener,noreferrer");
      windowSpy.mockRestore();
    });
  });
});
