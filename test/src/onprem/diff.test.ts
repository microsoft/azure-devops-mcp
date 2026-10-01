// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { createUnifiedDiff, diffLines, splitLines } from "../../../src/onprem/diff";

describe("diff", () => {
  it("splits lines handling CRLF and trailing newline", () => {
    expect(splitLines("")).toEqual([]);
    expect(splitLines("a\r\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
  });

  it("returns an empty diff for identical content", () => {
    expect(createUnifiedDiff("a\nb\n", "a\r\nb\r\n", "a/x", "b/x")).toEqual({ diff: "", addedLines: 0, removedLines: 0, minimal: true });
  });

  it("produces git-style hunks with context", () => {
    const oldText = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].join("\n");
    const newText = ["1", "2", "3", "four", "5", "6", "7", "8", "9", "10", "11"].join("\n");
    const result = createUnifiedDiff(oldText, newText, "a/f.ts", "b/f.ts", 1);
    expect(result.addedLines).toBe(2);
    expect(result.removedLines).toBe(1);
    expect(result.diff).toBe(["--- a/f.ts", "+++ b/f.ts", "@@ -3,3 +3,3 @@", " 3", "-4", "+four", " 5", "@@ -10,1 +10,2 @@", " 10", "+11"].join("\n"));
  });

  it("handles added and deleted files", () => {
    expect(createUnifiedDiff("", "x\ny\n", "/dev/null", "b/new", 3).diff).toBe(["--- /dev/null", "+++ b/new", "@@ -0,0 +1,2 @@", "+x", "+y"].join("\n"));
    expect(createUnifiedDiff("x\n", "", "a/old", "/dev/null", 3).diff).toBe(["--- a/old", "+++ /dev/null", "@@ -1,1 +0,0 @@", "-x"].join("\n"));
  });

  it("computes a minimal edit script for interleaved changes", () => {
    const { ops, minimal } = diffLines(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
    expect(minimal).toBe(true);
    expect(ops.map((op) => op.type + op.line)).toEqual([" a", "-b", "+x", " c", " d", "+e"]);
  });

  it("falls back to a replacement hunk for very large changed regions", () => {
    const a = Array.from({ length: 2100 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 2100 }, (_, i) => `b${i}`);
    const { ops, minimal } = diffLines(a, b);
    expect(minimal).toBe(false);
    expect(ops.filter((op) => op.type === "-")).toHaveLength(2100);
    expect(ops.filter((op) => op.type === "+")).toHaveLength(2100);
  });
});
