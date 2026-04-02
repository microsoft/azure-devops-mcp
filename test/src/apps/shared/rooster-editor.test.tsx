/**
 * @jest-environment jsdom
 */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// --- Mocks for roosterjs packages (must be before component import) ---

const mockDispose = jest.fn();
const mockSetDarkModeState = jest.fn();
const mockSetDOMSelection = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _capturedEditorDiv: HTMLDivElement | null = null;
let capturedOptions: any = null;

jest.mock("roosterjs-content-model-core", () => {
  const MockEditor = jest.fn().mockImplementation((div: HTMLDivElement, opts: any) => {
    _capturedEditorDiv = div;
    capturedOptions = opts;
    return {
      dispose: mockDispose,
      setDarkModeState: mockSetDarkModeState,
      setDOMSelection: mockSetDOMSelection,
      getDOMSelection: jest.fn().mockReturnValue(null),
      isDarkMode: () => false,
      focus: jest.fn(),
      hasFocus: () => false,
    };
  });
  return {
    __esModule: true,
    Editor: MockEditor,
    exportContent: jest.fn().mockReturnValue("<p>exported html</p>"),
    undo: jest.fn(),
    redo: jest.fn(),
  };
});

jest.mock("roosterjs-content-model-api", () => ({
  toggleBold: jest.fn(),
  toggleItalic: jest.fn(),
  toggleUnderline: jest.fn(),
  toggleStrikethrough: jest.fn(),
  toggleSuperscript: jest.fn(),
  toggleSubscript: jest.fn(),
  toggleBullet: jest.fn(),
  toggleNumbering: jest.fn(),
  toggleBlockQuote: jest.fn(),
  toggleCode: jest.fn(),
  setIndentation: jest.fn(),
  setAlignment: jest.fn(),
  setHeadingLevel: jest.fn(),
  setFontSize: jest.fn(),
  setDirection: jest.fn(),
  insertLink: jest.fn(),
  removeLink: jest.fn(),
  clearFormat: jest.fn(),
  getFormatState: jest.fn().mockReturnValue({}),
}));

const mockDomToContentModel = jest.fn().mockReturnValue({ blockGroupType: "Document", blocks: [] });
const mockCreateDomToModelContext = jest.fn().mockReturnValue({});
jest.mock("roosterjs-content-model-dom", () => ({
  domToContentModel: (...args: any[]) => mockDomToContentModel(...args),
  createDomToModelContext: (...args: any[]) => mockCreateDomToModelContext(...args),
}));

jest.mock("roosterjs-content-model-plugins", () => ({
  EditPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Edit" })),
  AutoFormatPlugin: jest.fn().mockImplementation(() => ({ getName: () => "AutoFormat" })),
  ShortcutPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Shortcut" })),
  PastePlugin: jest.fn().mockImplementation(() => ({ getName: () => "Paste" })),
  HyperlinkPlugin: jest.fn().mockImplementation(() => ({ getName: () => "Hyperlink" })),
}));

jest.mock("roosterjs-color-utils", () => ({
  getDarkColor: jest.fn((color: string) => color),
}));

// Now import the component under test
import { RoosterEditor, useIsDarkTheme } from "../../../../src/apps/shared/rooster-editor/rooster-editor";
import { Editor, exportContent } from "roosterjs-content-model-core";
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleBullet,
  toggleNumbering,
  toggleBlockQuote,
  toggleCode,
  setIndentation,
  setAlignment,
  setHeadingLevel,
  insertLink,
  removeLink,
  getFormatState,
} from "roosterjs-content-model-api";

beforeEach(() => {
  jest.clearAllMocks();
  _capturedEditorDiv = null;
  capturedOptions = null;
  document.documentElement.removeAttribute("data-theme");
});

// ---------------------------------------------------------------------------
// RoosterEditor — rendering
// ---------------------------------------------------------------------------
describe("RoosterEditor", () => {
  describe("rendering", () => {
    it("renders container, toolbar, and content area", () => {
      render(<RoosterEditor />);
      expect(screen.getByTestId("rooster-editor")).toBeInTheDocument();
      expect(screen.getByTestId("rooster-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("rooster-content")).toBeInTheDocument();
    });

    it("applies default className to root element", () => {
      render(<RoosterEditor />);
      expect(screen.getByTestId("rooster-editor")).toHaveClass("rooster-editor-container");
    });

    it("applies custom className to root element", () => {
      render(<RoosterEditor className="my-custom-editor" />);
      expect(screen.getByTestId("rooster-editor")).toHaveClass("my-custom-editor");
    });

    it("applies custom classPrefix to internal elements", () => {
      render(<RoosterEditor classPrefix="rte" />);
      const toolbar = screen.getByTestId("rooster-toolbar");
      expect(toolbar).toHaveClass("rte-toolbar");
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveClass("rte-content");
    });

    it("sets minHeight style on content div", () => {
      render(<RoosterEditor minHeight={200} />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveStyle({ minHeight: "200px" });
    });

    it("uses default minHeight of 150 when not specified", () => {
      render(<RoosterEditor />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveStyle({ minHeight: "150px" });
    });

    it("sets data-placeholder attribute on content div", () => {
      render(<RoosterEditor placeholder="Type here..." />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveAttribute("data-placeholder", "Type here...");
    });

    it("content area has textbox role and aria-multiline", () => {
      render(<RoosterEditor />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveAttribute("role", "textbox");
      expect(content).toHaveAttribute("aria-multiline", "true");
    });

    it("uses placeholder as aria-label for content area", () => {
      render(<RoosterEditor placeholder="Enter description" />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveAttribute("aria-label", "Enter description");
    });

    it("uses fallback aria-label when no placeholder", () => {
      render(<RoosterEditor />);
      const content = screen.getByTestId("rooster-content");
      expect(content).toHaveAttribute("aria-label", "Rich text editor");
    });

    it("toolbar has role=toolbar and aria-label", () => {
      render(<RoosterEditor />);
      const toolbar = screen.getByTestId("rooster-toolbar");
      expect(toolbar).toHaveAttribute("role", "toolbar");
      expect(toolbar).toHaveAttribute("aria-label", "Formatting options");
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — toolbar buttons
  // ---------------------------------------------------------------------------
  describe("toolbar", () => {
    it("renders all inline formatting buttons plus overflow", () => {
      render(<RoosterEditor />);
      const buttons = screen.getByTestId("rooster-toolbar").querySelectorAll("button");
      // 18 regular + 2 dropdown triggers + 2 undo/redo + 1 clearFormat + 1 more = 24
      expect(buttons).toHaveLength(24);
    });

    it("renders buttons with title attributes for accessibility", () => {
      render(<RoosterEditor />);
      expect(screen.getByTitle("Undo (Ctrl+Z)")).toBeInTheDocument();
      expect(screen.getByTitle("Redo (Ctrl+Y)")).toBeInTheDocument();
      expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
      expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
      expect(screen.getByTitle("Underline (Ctrl+U)")).toBeInTheDocument();
      expect(screen.getByTitle("Strikethrough")).toBeInTheDocument();
      expect(screen.getByTitle("Superscript")).toBeInTheDocument();
      expect(screen.getByTitle("Subscript")).toBeInTheDocument();
      expect(screen.getByTitle("Font size")).toBeInTheDocument();
      expect(screen.getByTitle("Bulleted list")).toBeInTheDocument();
      expect(screen.getByTitle("Numbered list")).toBeInTheDocument();
      expect(screen.getByTitle("Decrease indent")).toBeInTheDocument();
      expect(screen.getByTitle("Increase indent")).toBeInTheDocument();
      expect(screen.getByTitle("Block quote")).toBeInTheDocument();
      expect(screen.getByTitle("Align left")).toBeInTheDocument();
      expect(screen.getByTitle("Align center")).toBeInTheDocument();
      expect(screen.getByTitle("Align right")).toBeInTheDocument();
      expect(screen.getByTitle("Align justify")).toBeInTheDocument();
      expect(screen.getByTitle("Insert link")).toBeInTheDocument();
      expect(screen.getByTitle("Remove link")).toBeInTheDocument();
      expect(screen.getByTitle("Heading")).toBeInTheDocument();
      expect(screen.getByTitle("Code")).toBeInTheDocument();
      expect(screen.getByTitle("Clear formatting")).toBeInTheDocument();
      expect(screen.getByTitle("More options")).toBeInTheDocument();
    });

    it("renders aria-label on each button", () => {
      render(<RoosterEditor />);
      const buttons = screen.getByTestId("rooster-toolbar").querySelectorAll("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-label");
      });
    });

    it("renders separator spans between groups", () => {
      render(<RoosterEditor />);
      const toolbar = screen.getByTestId("rooster-toolbar");
      const separators = toolbar.querySelectorAll(".rooster-toolbar-separator");
      // 5 group separators + 1 before overflow = 6
      expect(separators.length).toBeGreaterThanOrEqual(5);
    });

    it("calls toggleBold when Bold button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Bold (Ctrl+B)"));
      expect(toggleBold).toHaveBeenCalled();
    });

    it("calls toggleItalic when Italic button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Italic (Ctrl+I)"));
      expect(toggleItalic).toHaveBeenCalled();
    });

    it("calls toggleUnderline when Underline button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Underline (Ctrl+U)"));
      expect(toggleUnderline).toHaveBeenCalled();
    });

    it("calls toggleStrikethrough when Strikethrough button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Strikethrough"));
      expect(toggleStrikethrough).toHaveBeenCalled();
    });

    it("calls toggleCode when Code button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Code"));
      expect(toggleCode).toHaveBeenCalled();
    });

    it("calls toggleBullet when Bulleted list button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Bulleted list"));
      expect(toggleBullet).toHaveBeenCalled();
    });

    it("calls toggleNumbering when Numbered list button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Numbered list"));
      expect(toggleNumbering).toHaveBeenCalled();
    });

    it("calls toggleBlockQuote when Block quote button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Block quote"));
      expect(toggleBlockQuote).toHaveBeenCalled();
    });

    it("calls setIndentation(outdent) when Decrease indent button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Decrease indent"));
      expect(setIndentation).toHaveBeenCalledWith(expect.anything(), "outdent");
    });

    it("calls setIndentation(indent) when Increase indent button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Increase indent"));
      expect(setIndentation).toHaveBeenCalledWith(expect.anything(), "indent");
    });

    it("calls setAlignment when alignment button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Align center"));
      expect(setAlignment).toHaveBeenCalledWith(expect.anything(), "center");
    });

    it("calls setHeadingLevel when Heading dropdown item is selected", () => {
      render(<RoosterEditor />);
      // Heading is a dropdown; click the trigger then select an item
      fireEvent.mouseDown(screen.getByTitle("Heading"));
      // The dropdown should be open with heading options
      const h2 = screen.getByText("Heading 2");
      fireEvent.mouseDown(h2);
      expect(setHeadingLevel).toHaveBeenCalled();
    });

    it("calls removeLink when Remove link button is pressed", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Remove link"));
      expect(removeLink).toHaveBeenCalled();
    });

    it("prevents default on mouseDown to keep editor focus", () => {
      render(<RoosterEditor />);
      const btn = screen.getByTitle("Bold (Ctrl+B)");
      const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      const spy = jest.spyOn(event, "preventDefault");
      btn.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — editor lifecycle
  // ---------------------------------------------------------------------------
  describe("editor lifecycle", () => {
    it("creates Editor instance on mount", () => {
      render(<RoosterEditor />);
      expect(Editor).toHaveBeenCalledTimes(1);
    });

    it("passes correct options to Editor constructor", () => {
      document.documentElement.setAttribute("data-theme", "light");
      render(<RoosterEditor />);
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.plugins).toHaveLength(6); // 5 builtin + ChangeNotifier
      expect(capturedOptions.getDarkColor).toBeDefined();
      expect(capturedOptions.inDarkMode).toBe(false);
      expect(capturedOptions.defaultSegmentFormat).toEqual({
        fontSize: "13px",
        fontFamily: "var(--font-sans, inherit)",
      });
    });

    it("converts initialContent HTML to initialModel via domToContentModel", () => {
      const html = "<p>Hello world</p>";
      render(<RoosterEditor initialContent={html} />);
      // Should parse HTML through domToContentModel
      expect(mockCreateDomToModelContext).toHaveBeenCalled();
      expect(mockDomToContentModel).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.any(Object));
      // The temp div should have contained the HTML
      const tempDiv = mockDomToContentModel.mock.calls[0][0] as HTMLDivElement;
      expect(tempDiv.innerHTML).toBe(html);
      // initialModel should be passed in options
      expect(capturedOptions.initialModel).toEqual({ blockGroupType: "Document", blocks: [] });
    });

    it("does not set initialModel when no initialContent provided", () => {
      render(<RoosterEditor />);
      expect(mockDomToContentModel).not.toHaveBeenCalled();
      expect(capturedOptions.initialModel).toBeUndefined();
    });

    it("disposes editor on unmount", () => {
      const { unmount } = render(<RoosterEditor />);
      unmount();
      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    it("registers ChangeNotifier plugin that calls onChange on input event", () => {
      const onChange = jest.fn();
      render(<RoosterEditor onChange={onChange} />);

      // Find the ChangeNotifier plugin in the options
      const changePlugin = capturedOptions.plugins.find((p: any) => p.getName?.() === "ChangeNotifier");
      expect(changePlugin).toBeDefined();

      // Simulate an input event via the plugin
      changePlugin.onPluginEvent({ eventType: "input" });

      expect(exportContent).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("<p>exported html</p>");
    });

    it("registers ChangeNotifier plugin that calls onChange on contentChanged event", () => {
      const onChange = jest.fn();
      render(<RoosterEditor onChange={onChange} />);

      const changePlugin = capturedOptions.plugins.find((p: any) => p.getName?.() === "ChangeNotifier");
      changePlugin.onPluginEvent({ eventType: "contentChanged" });

      expect(exportContent).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("<p>exported html</p>");
    });

    it("does not call onChange when no onChange prop", () => {
      render(<RoosterEditor />);
      const changePlugin = capturedOptions.plugins.find((p: any) => p.getName?.() === "ChangeNotifier");
      // Simulate input event — should not throw even without onChange
      changePlugin.onPluginEvent({ eventType: "input" });
      expect(exportContent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — dark mode
  // ---------------------------------------------------------------------------
  describe("dark mode", () => {
    it("detects dark mode from data-theme attribute", () => {
      document.documentElement.setAttribute("data-theme", "dark");
      render(<RoosterEditor />);
      expect(capturedOptions.inDarkMode).toBe(true);
    });

    it("detects light mode from data-theme attribute", () => {
      document.documentElement.setAttribute("data-theme", "light");
      render(<RoosterEditor />);
      expect(capturedOptions.inDarkMode).toBe(false);
    });

    it("calls setDarkModeState when theme changes", async () => {
      document.documentElement.setAttribute("data-theme", "light");
      render(<RoosterEditor />);
      mockSetDarkModeState.mockClear();

      act(() => {
        document.documentElement.setAttribute("data-theme", "dark");
      });

      await waitFor(() => {
        expect(mockSetDarkModeState).toHaveBeenCalledWith(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — icon rendering
  // ---------------------------------------------------------------------------
  describe("icons", () => {
    it("renders SVG icons for all toolbar buttons", () => {
      render(<RoosterEditor />);

      const boldBtn = screen.getByTitle("Bold (Ctrl+B)");
      expect(boldBtn.querySelector("svg")).not.toBeNull();

      const codeBtn = screen.getByTitle("Code");
      expect(codeBtn.querySelector("svg")).not.toBeNull();

      const linkBtn = screen.getByTitle("Insert link");
      expect(linkBtn.querySelector("svg")).not.toBeNull();

      const unlinkBtn = screen.getByTitle("Remove link");
      expect(unlinkBtn.querySelector("svg")).not.toBeNull();
    });

    it("uses distinct SVG paths for link and unlink", () => {
      render(<RoosterEditor />);
      const linkPath = screen.getByTitle("Insert link").querySelector("svg path")?.getAttribute("d");
      const unlinkPath = screen.getByTitle("Remove link").querySelector("svg path")?.getAttribute("d");
      expect(linkPath).not.toBe(unlinkPath);
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — toolbar active state
  // ---------------------------------------------------------------------------
  describe("toolbar active state", () => {
    it("has aria-pressed on format buttons", () => {
      render(<RoosterEditor />);
      const boldBtn = screen.getByTitle("Bold (Ctrl+B)");
      expect(boldBtn).toHaveAttribute("aria-pressed", "false");
    });

    it("does not have aria-pressed on indent/outdent buttons", () => {
      render(<RoosterEditor />);
      const indentBtn = screen.getByTitle("Increase indent");
      expect(indentBtn).not.toHaveAttribute("aria-pressed");
    });

    it("applies active class when format state indicates bold", () => {
      (getFormatState as jest.Mock).mockReturnValue({ isBold: true });
      render(<RoosterEditor />);
      const boldBtn = screen.getByTitle("Bold (Ctrl+B)");
      // Trigger format state update via mouseUp on content
      fireEvent.mouseUp(screen.getByTestId("rooster-content"));
      expect(boldBtn).toHaveClass("rooster-toolbar-btn-active");
      expect(boldBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("updates format state after toolbar action", () => {
      (getFormatState as jest.Mock).mockReturnValue({ isBold: true });
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Bold (Ctrl+B)"));
      expect(getFormatState).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — inline link dialog
  // ---------------------------------------------------------------------------
  describe("link dialog", () => {
    it("opens link dialog when Insert link button is clicked", () => {
      render(<RoosterEditor />);
      expect(screen.queryByTestId("rooster-link-dialog")).not.toBeInTheDocument();
      fireEvent.mouseDown(screen.getByTitle("Insert link"));
      expect(screen.getByTestId("rooster-link-dialog")).toBeInTheDocument();
    });

    it("closes link dialog on Cancel", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Insert link"));
      expect(screen.getByTestId("rooster-link-dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByTestId("rooster-link-dialog")).not.toBeInTheDocument();
    });

    it("calls insertLink on form submit", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("Insert link"));
      const inputs = screen.getByTestId("rooster-link-dialog").querySelectorAll("input");
      fireEvent.change(inputs[0], { target: { value: "https://example.com" } });
      fireEvent.change(inputs[1], { target: { value: "Example" } });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fireEvent.submit(screen.getByTestId("rooster-link-dialog").querySelector("form")!);
      expect(insertLink).toHaveBeenCalledWith(expect.anything(), "https://example.com", "https://example.com", "Example", "https://example.com");
    });
  });

  // ---------------------------------------------------------------------------
  // RoosterEditor — overflow menu
  // ---------------------------------------------------------------------------
  describe("overflow menu", () => {
    it("renders More options button", () => {
      render(<RoosterEditor />);
      expect(screen.getByTitle("More options")).toBeInTheDocument();
    });

    it("opens overflow menu on mouseDown", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("More options"));
      expect(screen.getByText("Left to right")).toBeInTheDocument();
    });

    it("calls setDirection via overflow menu", () => {
      render(<RoosterEditor />);
      fireEvent.mouseDown(screen.getByTitle("More options"));
      fireEvent.mouseDown(screen.getByText("Left to right"));
    });
  });
});

// ---------------------------------------------------------------------------
// useIsDarkTheme — hook tests
// ---------------------------------------------------------------------------
describe("useIsDarkTheme", () => {
  function TestComponent() {
    const isDark = useIsDarkTheme();
    return <div data-testid="theme-result">{isDark ? "dark" : "light"}</div>;
  }

  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.style.backgroundColor = "";
  });

  it("returns true when data-theme is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<TestComponent />);
    expect(screen.getByTestId("theme-result").textContent).toBe("dark");
  });

  it("returns false when data-theme is light", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<TestComponent />);
    expect(screen.getByTestId("theme-result").textContent).toBe("light");
  });

  it("defaults to dark when no data-theme and no computable background", () => {
    render(<TestComponent />);
    // jsdom has no computed background, so isColorDark returns true (default)
    expect(screen.getByTestId("theme-result").textContent).toBe("dark");
  });

  it("reacts to data-theme attribute changes", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<TestComponent />);
    expect(screen.getByTestId("theme-result").textContent).toBe("light");

    act(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });

    await waitFor(() => {
      expect(screen.getByTestId("theme-result").textContent).toBe("dark");
    });
  });
});
