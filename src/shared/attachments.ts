// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { constants, open, realpath } from "fs/promises";
import * as path from "path";
import { gunzipSync } from "zlib";

export function getMimeType(fileName: string | undefined): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    html: "text/html",
    htm: "text/html",
    xml: "text/xml",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    zip: "application/zip",
  };
  return (ext && mimeTypes[ext]) ?? "application/octet-stream";
}

/**
 * Rejects a save directory or file name that could escape the server's working directory.
 * The file name must be a single path component.
 */
export function validateAttachmentTarget(fileName: string, savePath?: string): void {
  const isAbsolutePath = (value: string) => path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
  if (savePath !== undefined && (savePath.includes("..") || isAbsolutePath(savePath) || /^[a-zA-Z]:/.test(savePath))) {
    throw new Error("Invalid savePath: absolute paths and path traversals are not allowed.");
  }
  if (!fileName || fileName.includes("\0") || fileName.includes("..") || path.posix.basename(fileName) !== fileName || path.win32.basename(fileName) !== fileName) {
    throw new Error("Invalid fileName: path components are not allowed.");
  }
}

/**
 * Reads an attachment download stream. Non-2xx responses are drained and rejected so error pages are never returned
 * as content. Some Azure DevOps Server responses are gzip-encoded without a Content-Encoding header; they are decoded.
 */
export async function readAttachmentStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const response = stream as NodeJS.ReadableStream & { statusCode?: number; statusMessage?: string };
  if (response.statusCode !== undefined && (response.statusCode < 200 || response.statusCode >= 300)) {
    response.resume();
    const statusMessage = response.statusMessage ? ` ${response.statusMessage}` : "";
    throw new Error(`Attachment download failed: HTTP ${response.statusCode}${statusMessage}`);
  }
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const buffer = Buffer.concat(chunks);
  return buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer;
}

/** Writes the attachment into `savePath`, which must resolve (including symlinks) inside the server's working directory. */
export async function saveAttachment(buffer: Buffer, savePath: string, fileName: string): Promise<string> {
  const workspaceRoot = await realpath(process.cwd());
  const resolvedDirectory = await realpath(path.resolve(workspaceRoot, savePath));
  const relativeDirectory = path.relative(workspaceRoot, resolvedDirectory);
  if (relativeDirectory === ".." || relativeDirectory.startsWith(`..${path.sep}`) || path.isAbsolute(relativeDirectory)) {
    throw new Error("Invalid savePath: destination must remain inside the workspace.");
  }
  const localFilePath = path.resolve(resolvedDirectory, fileName);
  // O_EXCL fails if the file (or a symlink) already exists, so there is no check-then-write race.
  const file = await open(localFilePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    await file.writeFile(buffer);
  } finally {
    await file.close();
  }
  return localFilePath;
}
