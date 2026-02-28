// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "./shared/domains.js";
import { configureAdvSecTools } from "./tools/advanced-security.js";
import { configurePipelineTools } from "./tools/pipelines.js";
import { configureCoreTools } from "./tools/core.js";
import { configureRepoTools } from "./tools/repositories.js";
import { configureSearchTools } from "./tools/search.js";
import { configureTestPlanTools } from "./tools/test-plans.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/work-items.js";

function configureAllTools(
  server: McpServer,
  tokenProvider: () => Promise<string>,
  connectionProvider: () => Promise<WebApi>,
  userAgentProvider: () => string,
  enabledDomains: Set<string>,
  orgName: string
) {
  const configureIfDomainEnabled = (domain: string, configureFn: () => void) => {
    if (enabledDomains.has(domain)) {
      configureFn();
    }
  };

  configureIfDomainEnabled(Domain.CORE, () => configureCoreTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK, () => configureWorkTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.PIPELINES, () => configurePipelineTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configureRepoTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK_ITEMS, () => configureWorkItemTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WIKI, () => configureWikiTools(server, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.TEST_PLANS, () => configureTestPlanTools(server, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.SEARCH, () => configureSearchTools(server, tokenProvider, connectionProvider, userAgentProvider, orgName));
  configureIfDomainEnabled(Domain.ADVANCED_SECURITY, () => configureAdvSecTools(server, tokenProvider, connectionProvider));
}

export { configureAllTools };
