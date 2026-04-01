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

// Mock react-quill-new for jsdom (no real Quill editor in tests)
jest.mock("react-quill-new", () => {
  const MockQuill = (props: any) =>
    React.createElement("div", { "data-testid": "react-quill" }, [
      React.createElement("textarea", {
        key: "editor",
        value: props.value ?? "",
        onChange: (e: any) => props.onChange?.(e.target.value),
        placeholder: props.placeholder,
      }),
    ]);
  MockQuill.displayName = "ReactQuill";
  return { __esModule: true, default: MockQuill };
});
jest.mock("react-quill-new/dist/quill.snow.css", () => ({}));

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

    it("renders priority dropdown with all options", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByRole("option", { name: "Critical" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "High" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Medium" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Low" })).toBeInTheDocument();
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

    it("renders rich text editor (ReactQuill) for description in edit mode", () => {
      render(<ExpandedContent wi={sampleWorkItem} editState={editState} {...noopHandlers} app={undefined} allowedStates={[]} typeMetadataMap={{}} />);

      expect(screen.getByTestId("react-quill")).toBeInTheDocument();
    });
  });
});
