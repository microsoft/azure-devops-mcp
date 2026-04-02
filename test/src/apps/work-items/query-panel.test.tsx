/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryPanel } from "../../../../src/apps/work-items/components/query-panel";

describe("QueryPanel", () => {
  const defaultFilters = {
    search: "",
    state: "",
    type: "",
    assignedTo: "",
    priority: "",
    tag: "",
  };

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<QueryPanel isOpen={false} filters={defaultFilters} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders query code when isOpen is true", () => {
    render(<QueryPanel isOpen={true} filters={defaultFilters} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("shows WIQL query with filters applied", () => {
    const filters = { ...defaultFilters, state: "Active" };
    render(<QueryPanel isOpen={true} filters={filters} />);
    // The query content should be rendered in a code block
    const codeBlock = document.querySelector("pre.query-code");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock?.textContent).toContain("Active");
  });

  it("copies query to clipboard and shows Copied state", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<QueryPanel isOpen={true} filters={defaultFilters} />);

    fireEvent.click(screen.getByText("Copy"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("includes query context in generated WIQL", () => {
    const queryContext = { project: "TestProject", queryType: "assignedtome" };
    render(<QueryPanel isOpen={true} filters={defaultFilters} queryContext={queryContext} />);
    const codeBlock = document.querySelector("pre.query-code");
    expect(codeBlock?.textContent).toContain("@Me");
  });
});
