// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { configureAdvSecTools } from "./tools/advsec.js";
import { configureBuildTools } from "./tools/builds.js";
import { configureCoreTools } from "./tools/core.js";
import { configureReleaseTools } from "./tools/releases.js";
import { configureRepoTools } from "./tools/repos.js";
import { configureSearchTools } from "./tools/search.js";
import { configureTestPlanTools } from "./tools/testplans.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/workitems.js";

function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureWorkTools(server, tokenProvider, connectionProvider);
  configureBuildTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureReleaseTools(server, tokenProvider, connectionProvider);
  configureWikiTools(server, tokenProvider, connectionProvider);
  configureTestPlanTools(server, tokenProvider, connectionProvider);
  configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider);
  configureAdvSecTools(server, tokenProvider, connectionProvider);
}

export { configureAllTools };
