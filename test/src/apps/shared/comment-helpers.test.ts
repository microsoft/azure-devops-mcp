// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { toCommentHtml, uploadInlineImages } from "../../../../src/apps/shared/comment-helpers";

jest.mock("../../../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("toCommentHtml", () => {
  describe("falsy input", () => {
    it("returns empty string for empty string", () => {
      expect(toCommentHtml("")).toBe("");
    });

    it("returns null-ish values as-is", () => {
      expect(toCommentHtml(null as unknown as string)).toBe(null);
      expect(toCommentHtml(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe("plain text conversion", () => {
    it("wraps a single line in a <div>", () => {
      expect(toCommentHtml("Hello")).toBe("<div>Hello</div>");
    });

    it("wraps multiple lines each in a <div>", () => {
      expect(toCommentHtml("Line1\nLine2\nLine3")).toBe("<div>Line1</div><div>Line2</div><div>Line3</div>");
    });

    it("uses <br> for empty lines", () => {
      expect(toCommentHtml("Line1\n\nLine3")).toBe("<div>Line1</div><div><br></div><div>Line3</div>");
    });

    it("handles a single newline", () => {
      expect(toCommentHtml("\n")).toBe("<div><br></div><div><br></div>");
    });

    it("preserves whitespace within lines", () => {
      expect(toCommentHtml("  indented  ")).toBe("<div>  indented  </div>");
    });
  });

  describe("HTML pass-through", () => {
    it("returns HTML input as-is when it contains tags", () => {
      const html = "<div>Already HTML</div>";
      expect(toCommentHtml(html)).toBe(html);
    });

    it("handles HTML with attributes", () => {
      const html = '<a href="https://example.com">link</a>';
      expect(toCommentHtml(html)).toBe(html);
    });

    it("handles complex nested HTML", () => {
      const html = "<div><strong>bold</strong> and <em>italic</em></div>";
      expect(toCommentHtml(html)).toBe(html);
    });
  });

  describe("<p> to <div> conversion", () => {
    it("converts <p> tags to <div> tags", () => {
      expect(toCommentHtml("<p>Paragraph</p>")).toBe("<div>Paragraph</div>");
    });

    it("converts multiple <p> tags", () => {
      expect(toCommentHtml("<p>First</p><p>Second</p>")).toBe("<div>First</div><div>Second</div>");
    });

    it("preserves <p> attributes when converting to <div>", () => {
      expect(toCommentHtml('<p class="intro">Text</p>')).toBe('<div class="intro">Text</div>');
    });

    it("handles case-insensitive <P> tags", () => {
      expect(toCommentHtml("<P>Upper</P>")).toBe("<div>Upper</div>");
    });
  });

  describe("empty <div> normalization", () => {
    it("converts empty <div></div> to <div><br></div>", () => {
      expect(toCommentHtml("<div></div>")).toBe("<div><br></div>");
    });

    it("converts multiple empty divs", () => {
      expect(toCommentHtml("<div>Text</div><div></div><div></div>")).toBe("<div>Text</div><div><br></div><div><br></div>");
    });

    it("does not modify non-empty divs", () => {
      expect(toCommentHtml("<div>Content</div>")).toBe("<div>Content</div>");
    });

    it("handles mixed empty and non-empty divs from <p> conversion", () => {
      expect(toCommentHtml("<p>Text</p><div></div><p>More</p>")).toBe("<div>Text</div><div><br></div><div>More</div>");
    });
  });
});

describe("uploadInlineImages", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns HTML unchanged when no data URIs are present", async () => {
    const html = "<div>No images here</div>";
    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");
    expect(result).toBe(html);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns HTML unchanged when images use regular URLs", async () => {
    const html = '<img src="https://example.com/image.png" />';
    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");
    expect(result).toBe(html);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uploads a single inline base64 image and replaces the data URI", async () => {
    const base64 = "iVBORw0KGgo=";
    const html = `<img src="data:image/png;base64,${base64}" />`;
    const attachmentUrl = "https://dev.azure.com/org/proj/_apis/wit/attachments/abc123";

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: attachmentUrl }),
    });

    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toContain(attachmentUrl);
    expect(result).not.toContain("data:image/png;base64");
  });

  it("uploads multiple unique inline images", async () => {
    const base64a = "AAAA";
    const base64b = "BBBB";
    const html = `<img src="data:image/png;base64,${base64a}" /><img src="data:image/jpeg;base64,${base64b}" />`;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/img" }),
    });

    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).not.toContain("data:");
  });

  it("deduplicates identical data URIs", async () => {
    const base64 = "CCCC";
    const dataUri = `data:image/png;base64,${base64}`;
    const html = `<img src="${dataUri}" /><img src="${dataUri}" />`;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/deduped" }),
    });

    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    // Should only upload once for identical data URIs
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Both occurrences should be replaced
    expect(result).toBe('<img src="https://upload/deduped" /><img src="https://upload/deduped" />');
  });

  it("sends correct headers and URL-encoded project in upload request", async () => {
    const html = '<img src="data:image/png;base64,AAAA" />';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/ok" }),
    });

    await uploadInlineImages(html, "https://dev.azure.com/org", "My Project", "my-token", "TestAgent");

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("My%20Project");
    expect(url).toContain("_apis/wit/attachments");
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe("Bearer my-token");
    expect(options.headers["Content-Type"]).toBe("application/octet-stream");
    expect(options.headers["User-Agent"]).toBe("TestAgent");
  });

  it("preserves data URI when upload fails", async () => {
    const base64 = "DDDD";
    const dataUri = `data:image/png;base64,${base64}`;
    const html = `<img src="${dataUri}" />`;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    // Data URI should remain since upload failed
    expect(result).toContain(dataUri);
  });

  it("handles mixed success and failure for multiple images", async () => {
    const html = '<img src="data:image/png;base64,AAAA" /><img src="data:image/png;base64,BBBB" />';

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ url: "https://uploaded/first" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Fail",
      });

    const result = await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    expect(result).toContain("https://uploaded/first");
    expect(result).toContain("data:image/png;base64,BBBB");
  });

  it("derives file extension from MIME type", async () => {
    const html = '<img src="data:image/jpeg;base64,AAAA" />';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/ok" }),
    });

    await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("fileName=");
    expect(url).toContain(".jpeg");
  });

  it("defaults to .png extension for unknown MIME types", async () => {
    const html = '<img src="data:image/;base64,AAAA" />';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/ok" }),
    });

    await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain(".png");
  });

  it("strips MIME suffix for svg+xml type", async () => {
    const html = '<img src="data:image/svg+xml;base64,AAAA" />';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://upload/ok" }),
    });

    await uploadInlineImages(html, "https://dev.azure.com/org", "proj", "token", "agent");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain(".svg");
  });
});
