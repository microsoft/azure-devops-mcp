/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FilterBar } from "../../../../src/apps/work-items/components/filter-bar";
import type { ActiveFilters, FilterOptions } from "../../../../src/apps/work-items/types";

const EMPTY: ActiveFilters = { search: "", state: "", type: "", assignedTo: "", priority: "", tag: "" };

const OPTIONS: FilterOptions = {
  states: ["Active", "New", "Closed"],
  types: ["Bug", "Task", "User Story"],
  assignees: ["Alice", "Bob"],
  priorities: ["Critical", "High", "Medium"],
  tags: ["frontend", "backend"],
};

describe("FilterBar", () => {
  it("renders search input and all dropdowns", () => {
    render(<FilterBar filters={EMPTY} onChange={jest.fn()} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    expect(screen.getByPlaceholderText(/search by title or id/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("All States")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Types")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Assignees")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Priorities")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Tags")).toBeInTheDocument();
  });

  it("renders filter options in dropdowns", () => {
    render(<FilterBar filters={EMPTY} onChange={jest.fn()} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bug" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Critical" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "frontend" })).toBeInTheDocument();
  });

  it("calls onChange when a dropdown value changes", () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    fireEvent.change(screen.getByDisplayValue("All States"), { target: { value: "Active" } });
    expect(onChange).toHaveBeenCalledWith("state", "Active");
  });

  it("does not show Clear Filters button when no filters active", () => {
    render(<FilterBar filters={EMPTY} onChange={jest.fn()} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    expect(screen.queryByText("Clear Filters")).not.toBeInTheDocument();
  });

  it("shows Clear Filters button when a filter is active", () => {
    const activeFilters = { ...EMPTY, state: "Active" };
    render(<FilterBar filters={activeFilters} onChange={jest.fn()} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={5} />);

    expect(screen.getByText("Clear Filters")).toBeInTheDocument();
  });

  it("calls onClear when Clear Filters is clicked", () => {
    const onClear = jest.fn();
    const activeFilters = { ...EMPTY, state: "Active" };
    render(<FilterBar filters={activeFilters} onChange={jest.fn()} onClear={onClear} filterOptions={OPTIONS} totalCount={10} filteredCount={5} />);

    fireEvent.click(screen.getByText("Clear Filters"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows filtered count when filters are active", () => {
    const activeFilters = { ...EMPTY, type: "Bug" };
    render(<FilterBar filters={activeFilters} onChange={jest.fn()} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/of 10/)).toBeInTheDocument();
  });

  it("calls onChange for type filter", () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    const typeSelect = screen.getAllByRole("combobox")[1]; // Second select is type
    fireEvent.change(typeSelect, { target: { value: "Bug" } });
    expect(onChange).toHaveBeenCalledWith("type", "Bug");
  });

  it("calls onChange for assignee filter", () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    const assigneeSelect = screen.getAllByRole("combobox")[2];
    fireEvent.change(assigneeSelect, { target: { value: "Alice" } });
    expect(onChange).toHaveBeenCalledWith("assignedTo", "Alice");
  });

  it("calls onChange for priority filter", () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    const prioritySelect = screen.getAllByRole("combobox")[3];
    fireEvent.change(prioritySelect, { target: { value: "Critical" } });
    expect(onChange).toHaveBeenCalledWith("priority", "Critical");
  });

  it("calls onChange for tag filter", () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    const tagSelect = screen.getAllByRole("combobox")[4];
    fireEvent.change(tagSelect, { target: { value: "frontend" } });
    expect(onChange).toHaveBeenCalledWith("tag", "frontend");
  });

  it("debounces search input", async () => {
    const onChange = jest.fn();
    render(<FilterBar filters={EMPTY} onChange={onChange} onClear={jest.fn()} filterOptions={OPTIONS} totalCount={10} filteredCount={10} />);

    const searchInput = screen.getByPlaceholderText(/search by title/i);
    fireEvent.change(searchInput, { target: { value: "test query" } });

    // Should not be called immediately
    expect(onChange).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith("search", "test query");
      },
      { timeout: 500 }
    );
  });
});
