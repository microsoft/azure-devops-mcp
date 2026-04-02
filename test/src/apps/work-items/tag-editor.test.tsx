/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TagEditor } from "../../../../src/apps/work-items/components/tag-editor";

describe("TagEditor", () => {
  it("renders existing tags as pills", () => {
    render(<TagEditor tags="frontend; backend; api" onChange={jest.fn()} />);

    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("renders input placeholder when no tags", () => {
    render(<TagEditor tags="" onChange={jest.fn()} />);

    expect(screen.getByPlaceholderText(/type a tag/i)).toBeInTheDocument();
  });

  it("adds a tag on Enter key", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="existing" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/type a tag/i);
    fireEvent.change(input, { target: { value: "newtag" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("existing; newtag");
  });

  it("adds a tag on comma key", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/type a tag/i);
    fireEvent.change(input, { target: { value: "first" } });
    fireEvent.keyDown(input, { key: "," });

    expect(onChange).toHaveBeenCalledWith("first");
  });

  it("adds a tag on Add button click", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/type a tag/i);
    fireEvent.change(input, { target: { value: "clicked" } });
    fireEvent.click(screen.getByText("Add"));

    expect(onChange).toHaveBeenCalledWith("clicked");
  });

  it("does not add duplicate tags (case insensitive)", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="Frontend" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/type a tag/i);
    fireEvent.change(input, { target: { value: "frontend" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not add empty tags", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/type a tag/i);
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when remove button is clicked", () => {
    const onChange = jest.fn();
    render(<TagEditor tags="a; b; c" onChange={onChange} />);

    const removeBtn = screen.getByTitle('Remove "b"');
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith("a; c");
  });

  it("disables Add button when input is empty", () => {
    render(<TagEditor tags="" onChange={jest.fn()} />);

    expect(screen.getByText("Add")).toBeDisabled();
  });
});
