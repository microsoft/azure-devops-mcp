// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

interface DiffOp {
  type: " " | "-" | "+";
  line: string;
}

/** Maximum LCS table size (cells). Larger inputs fall back to a non-minimal replace hunk. */
const MAX_LCS_CELLS = 4_000_000;

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(a: string[], b: string[]): { ops: DiffOp[]; minimal: boolean } {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;

  const aMid = a.slice(prefix, a.length - suffix);
  const bMid = b.slice(prefix, b.length - suffix);
  const ops: DiffOp[] = a.slice(0, prefix).map((line) => ({ type: " ", line }));
  let minimal = true;

  const n = aMid.length;
  const m = bMid.length;
  if ((n + 1) * (m + 1) <= MAX_LCS_CELLS) {
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = aMid[i] === bMid[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (aMid[i] === bMid[j]) {
        ops.push({ type: " ", line: aMid[i++] });
        j++;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        ops.push({ type: "-", line: aMid[i++] });
      } else {
        ops.push({ type: "+", line: bMid[j++] });
      }
    }
    while (i < n) ops.push({ type: "-", line: aMid[i++] });
    while (j < m) ops.push({ type: "+", line: bMid[j++] });
  } else {
    minimal = false;
    aMid.forEach((line) => ops.push({ type: "-", line }));
    bMid.forEach((line) => ops.push({ type: "+", line }));
  }

  a.slice(a.length - suffix).forEach((line) => ops.push({ type: " ", line }));
  return { ops, minimal };
}

export interface UnifiedDiffResult {
  diff: string;
  addedLines: number;
  removedLines: number;
  minimal: boolean;
}

/** Produces a unified diff (git style hunks) between two texts. Returns an empty diff for identical input. */
export function createUnifiedDiff(oldText: string, newText: string, oldLabel: string, newLabel: string, context = 3): UnifiedDiffResult {
  const { ops, minimal } = diffLines(splitLines(oldText), splitLines(newText));
  const changeIndexes = ops.flatMap((op, index) => (op.type === " " ? [] : [index]));
  const addedLines = ops.filter((op) => op.type === "+").length;
  const removedLines = ops.filter((op) => op.type === "-").length;
  if (changeIndexes.length === 0) {
    return { diff: "", addedLines, removedLines, minimal };
  }

  const ranges: [number, number][] = [];
  for (const index of changeIndexes) {
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  const output = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  let opIndex = 0;
  let oldLine = 1;
  let newLine = 1;
  for (const [start, end] of ranges) {
    for (; opIndex < start; opIndex++) {
      if (ops[opIndex].type !== "+") oldLine++;
      if (ops[opIndex].type !== "-") newLine++;
    }
    const hunk = ops.slice(start, end);
    const oldCount = hunk.filter((op) => op.type !== "+").length;
    const newCount = hunk.filter((op) => op.type !== "-").length;
    output.push(`@@ -${oldCount === 0 ? oldLine - 1 : oldLine},${oldCount} +${newCount === 0 ? newLine - 1 : newLine},${newCount} @@`);
    hunk.forEach((op) => output.push(op.type + op.line));
  }

  return { diff: output.join("\n"), addedLines, removedLines, minimal };
}
