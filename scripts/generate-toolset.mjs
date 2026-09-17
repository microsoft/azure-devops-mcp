#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Regenerates docs/TOOLSET.md from the tool list the built server actually
// serves, so the document cannot drift from the code again.
//
// Parameter lists come straight from each tool's input schema. The one-line
// summaries and the longer purpose text are hand-written prose worth keeping,
// so they are carried over from the existing document; only tools that have
// none yet fall back to the first sentence of their registered description.
//
// Usage: npm run build && npm run toolset
//        npm run toolset -- --check   (exit 1 if the document is stale)

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(root, "docs", "TOOLSET.md");
const PREFIX = "mcp_ado_";

// Section title and order for each tool name prefix.
const AREAS = [
  ["core", "Core"],
  ["wit", "Work Items"],
  ["work", "Work"],
  ["repo", "Repositories"],
  ["pipelines", "Pipelines"],
  ["release", "Release"],
  ["search", "Search"],
  ["wiki", "Wiki"],
  ["testplan", "Test Plans"],
  ["testresults", "Test Results"],
  ["analytics", "Analytics"],
  ["dashboard", "Dashboards"],
  ["projectanalysis", "Project Analysis"],
  ["policy", "Policy"],
  ["taskagent", "Task Agent"],
  ["approvals", "Approvals"],
  ["serviceendpoint", "Service Endpoints"],
  ["servicehook", "Service Hooks"],
  ["artifacts", "Artifacts"],
  ["advsec", "Advanced Security"],
  ["witprocess", "Process"],
  ["memberentitlement", "Member Entitlement"],
  ["graph", "Graph"],
  ["permissions", "Permissions"],
  ["securityrole", "Security Roles"],
  ["audit", "Audit"],
  ["notification", "Notification"],
  ["extension", "Extensions"],
  ["gallery", "Gallery"],
  ["featuremanagement", "Feature Management"],
  ["operations", "Operations"],
  ["profile", "Profile"],
  ["mcp_apps", "MCP Apps"],
];

function areaOf(toolName) {
  // Longest prefix first, so "witprocess_" is not read as "wit_".
  const match = [...AREAS].sort((a, b) => b[0].length - a[0].length).find(([prefix]) => toolName.startsWith(`${prefix}_`));
  if (!match) throw new Error(`No area configured for tool ${toolName} — add its prefix to AREAS in ${path.basename(fileURLToPath(import.meta.url))}`);
  return match;
}

async function listTools() {
  const dist = path.join(root, "dist", "index.js");
  if (!fs.existsSync(dist)) throw new Error("dist/index.js not found — run `npm run build` first.");

  // A bare absolute path is not a valid import specifier on Windows (the CI runner), so go through a file URL.
  const domains = await import(pathToFileURL(path.join(root, "dist", "shared", "domains.js")).href);
  const allDomains = Object.values(domains.Domain);

  return new Promise((resolve, reject) => {
    // Tool registration needs no live connection, so a placeholder PAT is enough.
    const child = spawn(process.execPath, [dist, "toolset-doc", "--authentication", "pat", "--domains", ...allDomains], {
      cwd: root,
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, PERSONAL_ACCESS_TOKEN: Buffer.from(":placeholder").toString("base64") },
    });
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Timed out waiting for tools/list"));
    }, 30000);

    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === 1) {
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
        } else if (message.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(message.result.tools);
        }
      }
    });
    child.on("error", reject);
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "toolset-doc", version: "1" } } });
  });
}

/** Summaries and purpose paragraphs already written in the current document. */
function readExistingProse() {
  const summaries = new Map();
  const purposes = new Map();
  if (!fs.existsSync(docPath)) return { summaries, purposes };

  const text = fs.readFileSync(docPath, "utf8");
  for (const match of text.matchAll(/^\|[^|\n]*\|\s*\[(mcp_ado_[a-z0-9_]+)\]\([^)]*\)\s*\|\s*([^|\n]*?)\s*\|\s*$/gm)) {
    summaries.set(match[1], match[2]);
  }
  for (const match of text.matchAll(/^### (mcp_ado_[a-z0-9_]+)\n\n([\s\S]*?)(?=\n\n- \*\*Required\*\*)/gm)) {
    purposes.set(match[1], match[2].trim());
  }
  return { summaries, purposes };
}

function firstSentence(description = "") {
  const clean = description.replace(/\s+/g, " ").trim();
  const end = clean.search(/\.(\s|$)/);
  return end === -1 ? clean : clean.slice(0, end + 1);
}

function describeParam(name, schema) {
  const values = schema?.enum ?? schema?.items?.enum;
  return values && values.length <= 6 ? `\`${name}\` (${values.map((v) => `\`${v}\``).join(" \\| ")})` : `\`${name}\``;
}

function render(tools, prose) {
  const grouped = new Map(AREAS.map(([, title]) => [title, []]));
  for (const tool of tools) {
    grouped.get(areaOf(tool.name)[1]).push(tool);
  }

  // The overview is a table, so a new tool's summary keeps only the lead clause.
  const summaryOf = (tool) =>
    prose.summaries.get(PREFIX + tool.name) ??
    firstSentence(tool.description)
      .split(/ — | \(|: /)[0]
      .replace(/[.,]$/, "");
  const purposeOf = (tool) => prose.purposes.get(PREFIX + tool.name) ?? firstSentence(tool.description);

  const lines = [
    "# Toolset",
    "",
    "<!-- Generated by `npm run toolset` from the tools the server registers. Parameter lists are rewritten on every run; edit the summaries and purpose text freely, they are preserved. -->",
    "",
    "## Overview",
    "",
    "| Functional Area | Tool | Description |",
    "| --- | --- | --- |",
  ];
  for (const [title, areaTools] of grouped) {
    for (const tool of areaTools) {
      lines.push(`| ${title} | [${PREFIX}${tool.name}](#${PREFIX}${tool.name}) | ${summaryOf(tool).replace(/\|/g, "\\|")} |`);
    }
  }

  for (const [title, areaTools] of grouped) {
    if (areaTools.length === 0) continue;
    lines.push("", `## ${title}`);
    for (const tool of areaTools) {
      const properties = tool.inputSchema?.properties ?? {};
      const required = new Set(tool.inputSchema?.required ?? []);
      const requiredParams = Object.keys(properties).filter((name) => required.has(name));
      const optionalParams = Object.keys(properties)
        .filter((name) => !required.has(name))
        .sort();
      const list = (names) => (names.length ? names.map((name) => describeParam(name, properties[name])).join(", ") : "None");

      lines.push("", `### ${PREFIX}${tool.name}`, "", purposeOf(tool), "", `- **Required**: ${list(requiredParams)}`, `- **Optional**: ${list(optionalParams)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

const tools = await listTools();
const prose = readExistingProse();
const documented = new Set([...prose.summaries.keys(), ...prose.purposes.keys()]);
const served = new Set(tools.map((tool) => PREFIX + tool.name));

const removed = [...documented].filter((name) => !served.has(name));
const added = [...served].filter((name) => !documented.has(name));

let output = render(tools, prose);

// Run prettier over the result so the check below compares like with like.
const { format, resolveConfig } = await import("prettier");
output = await format(output, { ...(await resolveConfig(docPath)), filepath: docPath });

const current = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";

if (process.argv.includes("--check")) {
  if (current !== output) {
    console.error(`docs/TOOLSET.md is stale (${added.length} undocumented, ${removed.length} no longer served). Run: npm run build && npm run toolset`);
    process.exit(1);
  }
  console.log("docs/TOOLSET.md is up to date.");
} else {
  fs.writeFileSync(docPath, output);
  console.log(`docs/TOOLSET.md: ${tools.length} tools in ${new Set(tools.map((t) => areaOf(t.name)[1])).size} areas (${added.length} newly documented).`);
  if (removed.length) console.warn(`No longer served, dropped from the document: ${removed.join(", ")}`);
}
