// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";

import { configureCoreTools } from "./tools/core.js";
import { configureWorkTools } from "./tools/work.js";
import { configureBuildTools } from "./tools/builds.js";
import { configureRepoTools } from "./tools/repos.js";
import { configureWorkItemTools } from "./tools/workitems.js";
import { configureReleaseTools } from "./tools/releases.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureTestPlanTools } from "./tools/testplans.js";
import { configureSearchTools } from "./tools/search.js";

export type ToolGroup = "core" | "work" | "builds" | "repos" | "workitems" | "releases" | "wiki" | "testplans" | "search";

export interface ToolFilter {
  include: string[];
  exclude: string[];
}

const TOOL_GROUPS: { group: ToolGroup; prefix: string; configure: Function }[] = [
  { group: "core", prefix: "core", configure: configureCoreTools },
  { group: "work", prefix: "work", configure: configureWorkTools },
  { group: "builds", prefix: "build", configure: configureBuildTools },
  { group: "repos", prefix: "repo", configure: configureRepoTools },
  { group: "workitems", prefix: "wit", configure: configureWorkItemTools },
  { group: "releases", prefix: "release", configure: configureReleaseTools },
  { group: "wiki", prefix: "wiki", configure: configureWikiTools },
  { group: "testplans", prefix: "testplan", configure: configureTestPlanTools },
  { group: "search", prefix: "search", configure: configureSearchTools },
];

/**
 * Registers all tool groups, applying inclusion and exclusion filters.
 *
 * @param filter An object with `include` and `exclude` arrays of tool group names or prefixes.
 */
function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, filter: ToolFilter = { include: [], exclude: [] }) {
  let toolsToConfigure = TOOL_GROUPS;

  if (filter.include.length > 0) {
    toolsToConfigure = TOOL_GROUPS.filter(({ group, prefix }) => filter.include.includes(group) || filter.include.includes(prefix));
  }

  if (filter.exclude.length > 0) {
    toolsToConfigure = toolsToConfigure.filter(({ group, prefix }) => !filter.exclude.includes(group) && !filter.exclude.includes(prefix));
  }

  for (const { configure } of toolsToConfigure) {
    configure(server, tokenProvider, connectionProvider);
  }
}

export { configureAllTools };
