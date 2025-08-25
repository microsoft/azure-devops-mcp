// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "./shared/domains.js";
import { configureAdvSecTools } from "./tools/advanced-security.js";
import { configureBuildTools } from "./tools/builds.js";
import { configureCoreTools } from "./tools/core.js";
import { configureReleaseTools } from "./tools/releases.js";
import { configureRepoTools } from "./tools/repositories.js";
import { configureSearchTools } from "./tools/search.js";
import { configureTestPlanTools } from "./tools/test-plans.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/work-items.js";

function configureAllTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, enabledDomains: Set<string>) {
  const configureIfDomainEnabled = (domain: string, configureFn: () => void) => {
    if (enabledDomains.has(domain)) {
      configureFn();
    }
  };

  configureIfDomainEnabled(Domain.CORE, () => configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK, () => configureWorkTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.BUILDS, () => configureBuildTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK_ITEMS, () => configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.RELEASES, () => configureReleaseTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.WIKI, () => configureWikiTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.TEST_PLANS, () => configureTestPlanTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.SEARCH, () => configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.ADVANCED_SECURITY, () => configureAdvSecTools(server, tokenProvider, connectionProvider));
}

export { configureAllTools };
