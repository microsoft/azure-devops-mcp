// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

function configureAllTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  configureCoreTools(server, tokenProvider, connectionProvider);
  configureWorkTools(server, tokenProvider, connectionProvider);
  configureBuildTools(server, tokenProvider, connectionProvider);
  configureRepoTools(server, tokenProvider, connectionProvider);
  configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureReleaseTools(server, tokenProvider, connectionProvider);
  configureWikiTools(server, tokenProvider, connectionProvider);
  configureTestPlanTools(server, tokenProvider, connectionProvider);
  configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider);
}

export { configureAllTools };
