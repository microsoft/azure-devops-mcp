// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { READ_ONLY_TOOLS } from "../../src/shared/read-only";
import { configureAllTools } from "../../src/tools";
import { Domain } from "../../src/shared/domains";
import { ADVSEC_TOOLS } from "../../src/tools/advanced-security";
import { CORE_TOOLS } from "../../src/tools/core";
import { PIPELINE_TOOLS } from "../../src/tools/pipelines";
import { REPO_TOOLS } from "../../src/tools/repositories";
import { SEARCH_TOOLS } from "../../src/tools/search";
import { Test_Plan_Tools } from "../../src/tools/test-plans";
import { WIKI_TOOLS } from "../../src/tools/wiki";
import { WORK_TOOLS } from "../../src/tools/work";
import { WORKITEM_TOOLS } from "../../src/tools/work-items";

const ALL_DOMAINS = new Set(Object.values(Domain));

function createMockServer() {
  return { tool: jest.fn() } as unknown as McpServer;
}

const tokenProvider = jest.fn().mockResolvedValue("fake-token");
const connectionProvider = jest.fn().mockResolvedValue({} as WebApi);
const userAgentProvider = () => "test";

function getRegisteredToolNames(server: McpServer): string[] {
  return (server.tool as jest.Mock).mock.calls.map(([name]: [string]) => name);
}

describe("configureAllTools with readOnly=true", () => {
  it("only registers tools in READ_ONLY_TOOLS", () => {
    const server = createMockServer();
    configureAllTools(server, tokenProvider, connectionProvider, userAgentProvider, ALL_DOMAINS, "test-org", true);

    const registered = getRegisteredToolNames(server);
    expect(registered.length).toBeGreaterThan(0);
    for (const name of registered) {
      expect(READ_ONLY_TOOLS.has(name)).toBe(true);
    }
  });

  it("registers fewer tools than normal mode", () => {
    const normalServer = createMockServer();
    const readOnlyServer = createMockServer();

    configureAllTools(normalServer, tokenProvider, connectionProvider, userAgentProvider, ALL_DOMAINS, "test-org", false);
    configureAllTools(readOnlyServer, tokenProvider, connectionProvider, userAgentProvider, ALL_DOMAINS, "test-org", true);

    const normalCount = getRegisteredToolNames(normalServer).length;
    const readOnlyCount = getRegisteredToolNames(readOnlyServer).length;

    expect(readOnlyCount).toBeLessThan(normalCount);
    expect(readOnlyCount).toBe(READ_ONLY_TOOLS.size);
  });
});

describe("configureAllTools with readOnly=false", () => {
  it("registers all tools", () => {
    const server = createMockServer();
    configureAllTools(server, tokenProvider, connectionProvider, userAgentProvider, ALL_DOMAINS, "test-org", false);

    const registered = getRegisteredToolNames(server);
    const allToolNames = [
      ...Object.values(ADVSEC_TOOLS),
      ...Object.values(CORE_TOOLS),
      ...Object.values(PIPELINE_TOOLS),
      ...Object.values(REPO_TOOLS),
      ...Object.values(SEARCH_TOOLS),
      ...Object.values(Test_Plan_Tools),
      ...Object.values(WIKI_TOOLS),
      ...Object.values(WORK_TOOLS),
      ...Object.values(WORKITEM_TOOLS),
    ];

    expect(registered.sort()).toEqual(allToolNames.sort());
  });
});

describe("READ_ONLY_TOOLS set validation", () => {
  it("every tool in READ_ONLY_TOOLS exists in source tool definitions", () => {
    const allToolNames = new Set([
      ...Object.values(ADVSEC_TOOLS),
      ...Object.values(CORE_TOOLS),
      ...Object.values(PIPELINE_TOOLS),
      ...Object.values(REPO_TOOLS),
      ...Object.values(SEARCH_TOOLS),
      ...Object.values(Test_Plan_Tools),
      ...Object.values(WIKI_TOOLS),
      ...Object.values(WORK_TOOLS),
      ...Object.values(WORKITEM_TOOLS),
    ]);

    for (const readOnlyTool of READ_ONLY_TOOLS) {
      expect(allToolNames).toContain(readOnlyTool);
    }
  });
});
