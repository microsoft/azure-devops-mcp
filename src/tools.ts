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
 * Registers all tool groups, unless they have been explicitly disabled by the caller.
 *
 * @param disabledGroups  A set of lowercase group identifiers or tool prefixes to skip (e.g. "testplans", "testplan", "search").
 */
function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, disabledGroups: Set<string> = new Set()) {
  for (const { group, prefix, configure } of TOOL_GROUPS) {
    if (!disabledGroups.has(group) && !disabledGroups.has(prefix)) {
      configure(server, tokenProvider, connectionProvider);
    }
  }
}

export { configureAllTools };
