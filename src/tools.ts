// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "./domains.js";
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

function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, enabledDomains: Set<string>) {
  const configureIfDomainEnabled = (domain: string, configureFn: () => void) => {
    if (enabledDomains.has(domain)) {
      configureFn();
    }
  };

  configureIfDomainEnabled(Domain.CORE, () => configureCoreTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WORK, () => configureWorkTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.BUILDS, () => configureBuildTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.REPOS, () => configureRepoTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WORKITEMS, () => configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.RELEASES, () => configureReleaseTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WIKI, () => configureWikiTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.TESTPLANS, () => configureTestPlanTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.SEARCH, () => configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.ADVSEC, () => configureAdvSecTools(server, tokenProvider, connectionProvider));
}

export { configureAllTools };
