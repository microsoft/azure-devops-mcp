/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Pagination } from "../../../../src/apps/work-items/components/pagination";

describe("Pagination", () => {
  it("returns null when totalPages <= 1", () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all page buttons for small page counts", () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("marks the current page as active", () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={jest.fn()} />);

    const activeBtn = screen.getByText("3");
    expect(activeBtn.className).toContain("active");
  });

  it("disables previous button on first page", () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);

    const buttons = screen.getAllByRole("button");
    const prevBtn = buttons[0];
    expect(prevBtn).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={jest.fn()} />);

    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons[buttons.length - 1];
    expect(nextBtn).toBeDisabled();
  });

  it("calls onPageChange when a page button is clicked", () => {
    const onPageChange = jest.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with next page on next button click", () => {
    const onPageChange = jest.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons[buttons.length - 1];
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with previous page on prev button click", () => {
    const onPageChange = jest.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole("button");
    const prevBtn = buttons[0];
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders ellipsis for large page counts", () => {
    render(<Pagination currentPage={5} totalPages={20} onPageChange={jest.fn()} />);

    // Should show page 1, ellipsis, nearby pages, ellipsis, last page
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });
});
