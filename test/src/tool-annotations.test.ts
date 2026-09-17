// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { configureToolsWithAnnotations, TOOL_ANNOTATIONS } from "../../src/shared/tool-annotations";
import { extractToolNames } from "../../src/shared/tool-validation";

const MUTATING_TOOL_NAMES = [
  "pipelines_artifact",
  "pipelines_write",
  "repo_create_branch",
  "repo_pull_request_thread_write",
  "repo_pull_request_write",
  "testplan_test_case_write",
  "testplan_test_plan_write",
  "testplan_test_suite_write",
  "wiki_upsert_page",
  "wit_backlog",
  "wit_work_item_attachment",
  "wit_work_item_comment_write",
  "wit_work_item_link_write",
  "wit_work_item_write",
  "work_capacity_write",
  "work_iteration_write",
];

describe("tool annotations", () => {
  it("defines annotations for every tool declared in source", () => {
    const toolsDirectory = join(process.cwd(), "src", "tools");
    const declaredNames = readdirSync(toolsDirectory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .flatMap((fileName) => extractToolNames(readFileSync(join(toolsDirectory, fileName), "utf8")))
      .sort();

    expect(declaredNames).toHaveLength(41);
    expect(declaredNames).toEqual(Object.keys(TOOL_ANNOTATIONS).sort());
  });

  it("registers accurate annotations for every local stdio tool", () => {
    const tool = jest.fn();
    const server = { tool } as unknown as McpServer;

    configureToolsWithAnnotations(server, () => {
      for (const name of Object.keys(TOOL_ANNOTATIONS)) {
        server.tool(name, "description", {}, async () => ({ content: [] }));
      }
    });

    const registrations = tool.mock.calls.map(([name, , , annotations]) => [name as string, annotations as ToolAnnotations] as const);
    const registeredNames = registrations.map(([name]) => name).sort();
    const annotatedNames = Object.keys(TOOL_ANNOTATIONS).sort();

    expect(registrations).toHaveLength(41);
    expect(new Set(registeredNames).size).toBe(41);
    expect(registeredNames).toEqual(annotatedNames);

    for (const [name, annotations] of registrations) {
      expect(annotations).toEqual(TOOL_ANNOTATIONS[name]);
      expect(annotations.openWorldHint).toBe(name !== "mcp_apps_ping");
      expect(annotations.readOnlyHint).toBe(!MUTATING_TOOL_NAMES.includes(name));
    }
  });

  it("marks additive tools as non-destructive", () => {
    expect(TOOL_ANNOTATIONS.repo_create_branch.destructiveHint).toBe(false);
    expect(TOOL_ANNOTATIONS.wit_work_item_attachment.destructiveHint).toBe(false);
    expect(TOOL_ANNOTATIONS.work_iteration_write.destructiveHint).toBe(false);
  });

  it("rejects tools without an annotation policy", () => {
    const server = { tool: jest.fn() } as unknown as McpServer;

    expect(() =>
      configureToolsWithAnnotations(server, () => {
        server.tool("unclassified_tool", async () => ({ content: [] }));
      })
    ).toThrow("Missing MCP annotations for tool: unclassified_tool");
  });
});
