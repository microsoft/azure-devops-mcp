// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SVG path data for all toolbar icons. Keyed by icon name.
 * Each path is designed for a 16×16 viewBox.
 */
export const TOOLBAR_ICONS: Record<string, string> = {
  // — Text formatting —
  bold: "M4 2h4.5a3.5 3.5 0 0 1 2.45 6A3.5 3.5 0 0 1 9.5 14H4V2zm2 5h2.5a1.5 1.5 0 0 0 0-3H6v3zm0 2v3h3.5a1.5 1.5 0 0 0 0-3H6z",
  italic: "M7 2h5v2h-1.8L7.8 12H10v2H5v-2h1.8L9.2 4H7V2z",
  underline: "M5 2v6a3 3 0 0 0 6 0V2h2v6a5 5 0 0 1-10 0V2h2zm-1 12h8v1H4v-1z",
  strikethrough: "M2 8h12v1H2V8zM5.5 3C6.3 2.4 7.1 2 8 2c2.2 0 4 1.3 4 3h-2c0-.6-.9-1-2-1-.7 0-1.3.2-1.6.5L5.5 3zM8 11c1.1 0 2-.4 2-1h2c0 1.7-1.8 3-4 3-1 0-1.8-.3-2.5-.8l.9-1.4c.4.1.9.2 1.6.2z",
  superscript: "M10 2h3v1h-1v2h-1V3h-1V2zM3 5h8v2H3V5zm0 4h6v2H3V9z",
  subscript: "M10 11h3v1h-1v2h-1v-2h-1v-1zM3 4h6v2H3V4zm0 4h8v2H3V8z",

  // — Lists & indentation —
  bullet: "M2.5 4.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM5 3h9v1.5H5V3zm0 4h9v1.5H5V7zm0 4h9v1.5H5V11z",
  numbering: "M2.5 2H4v4H2.5v-1H3V3h-.5V2zm0 5.5H5v1H3.5v.5H5v1H2.5v-1H4V8.5H2.5v-1zM6 3h8v1.5H6V3zm0 4h8v1.5H6V7zm0 4h8v1.5H6V11z",
  outdent: "M2 2h12v1.5H2V2zm5 3h7v1.5H7V5zm0 3h7v1.5H7V8zM2 11h12v1.5H2V11zM5 7L2 9V5l3 2z",
  indent: "M2 2h12v1.5H2V2zm5 3h7v1.5H7V5zm0 3h7v1.5H7V8zM2 11h12v1.5H2V11zM2 5l3 2-3 2V5z",

  // — Block formatting —
  blockquote: "M3 2.5h1.5v11H3v-11zM7 4h7v3H7V4zm0 5h7v3H7V9z",

  // — Alignment —
  alignLeft: "M2 2h12v1.5H2V2zm0 3h8v1.5H2V5zm0 3h10v1.5H2V8zm0 3h6v1.5H2V11z",
  alignCenter: "M2 2h12v1.5H2V2zm2 3h8v1.5H4V5zm1 3h6v1.5H5V8zm-1 3h8v1.5H4V11z",
  alignRight: "M2 2h12v1.5H2V2zm4 3h8v1.5H6V5zm2 3h6v1.5H8V8zm2 3h4v1.5h-4V11z",
  alignJustify: "M2 2h12v1.5H2V2zm0 3h12v1.5H2V5zm0 3h12v1.5H2V8zm0 3h12v1.5H2V11z",

  // — Heading & code —
  heading: "M3 2v12h2V9h4v5h2V2h-2v5H5V2H3z",
  code: "M5.854 3.146a.5.5 0 0 1 0 .708L2.707 7l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm4.292 0a.5.5 0 0 0 0 .708L13.293 7l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z",

  // — Links —
  link: "M7 4.5a.5.5 0 0 1 .5-.5h1A4.5 4.5 0 0 1 13 8.5v0A4.5 4.5 0 0 1 8.5 13h-1a.5.5 0 0 1 0-1h1A3.5 3.5 0 0 0 12 8.5v0A3.5 3.5 0 0 0 8.5 5h-1a.5.5 0 0 1-.5-.5zM3 8.5A4.5 4.5 0 0 1 7.5 4h1a.5.5 0 0 1 0 1h-1A3.5 3.5 0 0 0 4 8.5v0A3.5 3.5 0 0 0 7.5 12h1a.5.5 0 0 1 0 1h-1A4.5 4.5 0 0 1 3 8.5v0zM6 8h4v1H6V8z",
  unlink:
    "M7 4.5a.5.5 0 0 1 .5-.5h1A4.5 4.5 0 0 1 13 8.5c0 1-.3 1.9-.9 2.7l-.7-.7c.4-.6.6-1.3.6-2A3.5 3.5 0 0 0 8.5 5h-1a.5.5 0 0 1-.5-.5zM3 8.5A4.5 4.5 0 0 1 7.5 4h1a.5.5 0 0 1 0 1h-1A3.5 3.5 0 0 0 4 8.5c0 .7.2 1.4.6 2l-.7.7A4.5 4.5 0 0 1 3 8.5zM2 14l12-12 .7.7-12 12L2 14z",

  // — Misc —
  clearFormat: "M2 2l12 12-.7.7L8 9.4 5.5 14H3.7l3.1-6.2L1.3 2.7 2 2zm4.8 0H14v1.5H8.3L7 2z",
  more: "M3 7.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  ltr: "M6 2h7v2H6zm0 4h7v2H6zM3 10l3-2v4zM6 10h7v2H6z",
  rtl: "M3 2h7v2H3zm0 4h7v2H3zm7 2l3 2-3 2zM3 10h7v2H3z",

  // — Undo / Redo —
  undo: "M3.5 5.5C5 3.5 7.5 2.5 10 3.5c2 .8 3 2.8 3 5h-1.5c0-1.7-.7-3.1-2.2-3.7C7.5 4 5.5 4.7 4.3 6H7v1.5H2V2.5h1.5v3z",
  redo: "M12.5 5.5C11 3.5 8.5 2.5 6 3.5c-2 .8-3 2.8-3 5h1.5c0-1.7.7-3.1 2.2-3.7C8.5 4 10.5 4.7 11.7 6H9v1.5h5V2.5h-1.5v3z",

  // — Chevron for dropdowns —
  chevronDown: "M4 6l4 4 4-4z",
};
