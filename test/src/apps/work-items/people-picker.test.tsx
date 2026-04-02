/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PeoplePicker } from "../../../../src/apps/work-items/components/people-picker";

// The work-items people-picker re-exports the shared PeoplePicker with CSS defaults.
// The shared PeoplePicker calls app.callServerTool to search identities.

describe("PeoplePicker", () => {
  beforeAll(() => {
    // JSDOM doesn't support scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

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

  it("searches identities when typing with app available", async () => {
    const mockIdentities = [
      { id: "1", displayName: "Jane Doe", mail: "jane@test.com" },
      { id: "2", displayName: "Jane Smith", mail: "janes@test.com" },
    ];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Jane" } });

    await waitFor(() => {
      expect(mockApp.callServerTool).toHaveBeenCalledWith({
        name: "mcp_app_search_identities",
        arguments: { query: "Jane" },
      });
    });
  });

  it("selects identity from dropdown and calls onChange", async () => {
    const mockIdentities = [{ id: "1", displayName: "Jane Doe", mail: "jane@test.com" }];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };
    const onChange = jest.fn();

    render(<PeoplePicker value="" onChange={onChange} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Jane" } });

    // Wait for dropdown option to appear
    const option = await screen.findByRole("option", {}, { timeout: 2000 });
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith("Jane Doe");
  });

  it("falls back to legacy search when primary fails", async () => {
    const mockApp = {
      callServerTool: jest
        .fn()
        .mockRejectedValueOnce(new Error("Tool not found"))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: JSON.stringify([{ id: "1", displayName: "Bob" }]) }],
        }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Bob" } });

    await waitFor(() => {
      expect(mockApp.callServerTool).toHaveBeenCalledTimes(2);
    });
  });

  it("does not search with less than 2 characters", async () => {
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify([]) }],
      }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "J" } });

    // Wait a bit and ensure callServerTool was not called
    await new Promise((r) => setTimeout(r, 350));
    expect(mockApp.callServerTool).not.toHaveBeenCalled();
  });

  it("navigates dropdown with keyboard ArrowDown and ArrowUp", async () => {
    const mockIdentities = [
      { id: "1", displayName: "Alice", mail: "a@test.com" },
      { id: "2", displayName: "Bob", mail: "b@test.com" },
    ];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "test" } });

    // Wait for results
    await screen.findAllByRole("option", {}, { timeout: 2000 });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    // Should navigate without error
  });

  it("selects identity with Enter key", async () => {
    const mockIdentities = [{ id: "1", displayName: "Alice", mail: "a@test.com" }];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };
    const onChange = jest.fn();

    render(<PeoplePicker value="" onChange={onChange} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Alice" } });

    await screen.findByRole("option", {}, { timeout: 2000 });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Alice");
  });

  it("closes dropdown with Escape key", async () => {
    const mockIdentities = [{ id: "1", displayName: "Alice", mail: "a@test.com" }];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };

    render(<PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />);

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Alice" } });

    await screen.findByRole("option", {}, { timeout: 2000 });

    fireEvent.keyDown(input, { key: "Escape" });
    // Dropdown should close - no options visible
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("closes dropdown on click outside", async () => {
    const mockIdentities = [{ id: "1", displayName: "Alice", mail: "a@test.com" }];
    const mockApp = {
      callServerTool: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockIdentities) }],
      }),
    };

    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <PeoplePicker value="" onChange={jest.fn()} app={mockApp as any} />
      </div>
    );

    const input = screen.getByPlaceholderText(/type a name to search/i);
    fireEvent.change(input, { target: { value: "Alice" } });

    await screen.findByRole("option", {}, { timeout: 2000 });

    // Click outside the picker
    fireEvent.mouseDown(screen.getByTestId("outside"));
    await waitFor(() => {
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    });
  });
});
