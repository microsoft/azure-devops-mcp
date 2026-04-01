// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Derive a readable foreground color (black or white) for a given hex background. */
function contrastFg(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // W3C relative luminance threshold
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1a1a1a" : "#fff";
}

/** Get bg/fg colors for a work item type.
 *  Uses the dynamic color from the ADO API if provided, otherwise falls back to a deterministic HSL hash. */
export function colorForType(type: string, apiColor?: string): { bg: string; fg: string } {
  if (apiColor) {
    const bg = apiColor.startsWith("#") ? apiColor : `#${apiColor}`;
    return { bg, fg: contrastFg(bg) };
  }
  const key = type.toLowerCase().replace(/\s+/g, "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return { bg: `hsl(${hue}, 55%, 45%)`, fg: "#fff" };
}

/** Normalize Quill/HTML for ADO comments: convert <p> to <div>, fill empty <div>s with <br>. */
export function normalizeAdoHtml(html: string): string {
  if (!html) return html;
  let result = html;
  if (/<\/p>/i.test(result)) {
    result = result.replace(/<p([^>]*)>/gi, "<div$1>").replace(/<\/p>/gi, "</div>");
  }
  return result.replace(/<div><\/div>/gi, "<div><br></div>");
}
