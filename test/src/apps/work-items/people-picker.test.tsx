/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PeoplePicker } from "../../../../src/apps/work-items/components/people-picker";

// The work-items people-picker re-exports the shared PeoplePicker with CSS defaults.
// The shared PeoplePicker calls app.callServerTool to search identities.

describe("PeoplePicker", () => {
  it("renders with initial value", () => {
    render(<PeoplePicker value="Jane Doe" onChange={jest.fn()} app={undefined} />);

    // Should show the selected name
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders search input when no value selected", () => {
    render(<PeoplePicker value="" onChange={jest.fn()} app={undefined} />);

    expect(screen.getByPlaceholderText(/type a name to search/i)).toBeInTheDocument();
  });

  it("shows clear button when a value is selected", () => {
    render(<PeoplePicker value="Jane Doe" onChange={jest.fn()} app={undefined} />);

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument();
  });

  it("calls onChange with empty string when cleared", () => {
    const onChange = jest.fn();
    render(<PeoplePicker value="Jane Doe" onChange={onChange} app={undefined} />);

    fireEvent.click(screen.getByLabelText("Clear selection"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows search input after clicking the selected chip", () => {
    render(<PeoplePicker value="Jane Doe" onChange={jest.fn()} app={undefined} />);

    // Click the selected chip to switch to search mode
    fireEvent.click(screen.getByText("Jane Doe"));

    expect(screen.getByPlaceholderText(/type a name to search/i)).toBeInTheDocument();
  });

  it("calls onChange when user types and blurs with a value", async () => {
    const onChange = jest.fn();
    render(<PeoplePicker value="" onChange={onChange} app={undefined} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "John" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("John");
    });
  });

  it("renders with the app for identity search", () => {
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify([]) }],
      }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    expect(screen.getByPlaceholderText(/type a name to search/i)).toBeInTheDocument();
  });
});
