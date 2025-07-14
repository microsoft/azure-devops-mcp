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

function configureAllTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>,
  userAgentProvider: () => string,
  includeTools: string[] = [],
  excludeTools: string[] = []
) {
  // If includeTools is set, only register those groups/prefixes. Otherwise, register all except those in excludeTools.
  const groupMap = [
    { name: "core", fn: () => configureCoreTools(server, tokenProvider, connectionProvider) },
    { name: "work", fn: () => configureWorkTools(server, tokenProvider, connectionProvider) },
    { name: "build", fn: () => configureBuildTools(server, tokenProvider, connectionProvider) },
    { name: "repo", fn: () => configureRepoTools(server, tokenProvider, connectionProvider) },
    { name: "wit", fn: () => configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider) },
    { name: "release", fn: () => configureReleaseTools(server, tokenProvider, connectionProvider) },
    { name: "wiki", fn: () => configureWikiTools(server, tokenProvider, connectionProvider) },
    { name: "testplan", fn: () => configureTestPlanTools(server, tokenProvider, connectionProvider) },
    { name: "search", fn: () => configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider) },
  ];

  for (const group of groupMap) {
    if (includeTools.length > 0) {
      if (includeTools.includes(group.name)) {
        group.fn();
      }
    } else {
      if (!excludeTools.includes(group.name)) {
        group.fn();
      }
    }
  }
}

export { configureAllTools };
