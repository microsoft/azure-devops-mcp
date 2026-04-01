// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { logger } from "../../logger.js";
import { normalizeAdoHtml } from "./utils.js";

/**
 * Convert plain text to ADO-compatible HTML for work item comments.
 * ADO comments are HTML-based; its own editor wraps each line in <div> tags.
 * If text already contains HTML tags, it is normalized for ADO.
 */
export function toCommentHtml(text: string): string {
  if (!text) return text;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return normalizeAdoHtml(text);
  }
  return text
    .split(/\n/)
    .map((line) => `<div>${line || "<br>"}</div>`)
    .join("");
}

/**
 * Extract base64 data-URI images from HTML, upload each as an ADO work-item
 * attachment, and replace the inline data URIs with the returned attachment
 * URLs.  This is necessary because ADO comments don't reliably render
 * multiple base64 images — only the first one tends to survive.
 */
export async function uploadInlineImages(html: string, orgUrl: string, project: string, accessToken: string, userAgent: string): Promise<string> {
  const dataUriRegex = /src="(data:([^;]+);base64,([^"]+))"/gi;
  const uniqueDataUris = new Map<string, { mimeType: string; base64: string }>();

  let m: RegExpExecArray | null;
  while ((m = dataUriRegex.exec(html)) !== null) {
    const fullDataUri = m[1];
    if (!uniqueDataUris.has(fullDataUri)) {
      uniqueDataUris.set(fullDataUri, { mimeType: m[2], base64: m[3] });
    }
  }

  if (uniqueDataUris.size === 0) return html;

  logger.debug(`Uploading ${uniqueDataUris.size} inline image(s) as ADO attachments`);

  const entries = Array.from(uniqueDataUris.entries());
  const uploads = entries.map(async ([dataUri, { mimeType, base64 }], idx) => {
    const buffer = Buffer.from(base64, "base64");
    const ext = mimeType.split("/")[1]?.replace(/\+.*$/, "") || "png";
    const fileName = `inline-image-${Date.now()}-${idx}.${ext}`;

    const response = await fetch(`${orgUrl}/${encodeURIComponent(project)}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.1`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "User-Agent": userAgent,
      },
      body: buffer,
    });

    if (!response.ok) {
      logger.warn(`Failed to upload inline image ${idx}: ${response.statusText}`);
      return { dataUri, url: null as string | null };
    }

    const json = (await response.json()) as { url: string };
    logger.debug(`Uploaded image ${idx} → ${json.url}`);
    return { dataUri, url: json.url };
  });

  const results = await Promise.all(uploads);

  let result = html;
  for (const { dataUri, url } of results) {
    if (url) {
      result = result.split(dataUri).join(url);
    }
  }

  return result;
}
