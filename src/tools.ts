// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "./shared/domains.js";
import { READ_ONLY_TOOLS } from "./shared/read-only.js";
import { configureAdvSecTools } from "./tools/advanced-security.js";
import { configurePipelineTools } from "./tools/pipelines.js";
import { configureCoreTools } from "./tools/core.js";
import { configureRepoTools } from "./tools/repositories.js";
import { configureSearchTools } from "./tools/search.js";
import { configureTestPlanTools } from "./tools/test-plans.js";
import { configureWikiTools } from "./tools/wiki.js";
import { configureWorkTools } from "./tools/work.js";
import { configureWorkItemTools } from "./tools/work-items.js";

function withReadOnlyFilter(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "tool") {
        const original = target.tool.bind(target);
        return (name: string, ...rest: unknown[]) => {
          if (!READ_ONLY_TOOLS.has(name)) {
            return;
          }
          return (original as (...args: unknown[]) => unknown)(name, ...rest);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function configureAllTools(
  server: McpServer,
  tokenProvider: () => Promise<string>,
  connectionProvider: () => Promise<WebApi>,
  userAgentProvider: () => string,
  enabledDomains: Set<string>,
  orgName: string,
  readOnly = false
) {
  const effectiveServer = readOnly ? withReadOnlyFilter(server) : server;

  const configureIfDomainEnabled = (domain: string, configureFn: () => void) => {
    if (enabledDomains.has(domain)) {
      configureFn();
    }
  };

  configureIfDomainEnabled(Domain.CORE, () => configureCoreTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK, () => configureWorkTools(effectiveServer, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.PIPELINES, () => configurePipelineTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.REPOSITORIES, () => configureRepoTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WORK_ITEMS, () => configureWorkItemTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.WIKI, () => configureWikiTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider));
  configureIfDomainEnabled(Domain.TEST_PLANS, () => configureTestPlanTools(effectiveServer, tokenProvider, connectionProvider));
  configureIfDomainEnabled(Domain.SEARCH, () => configureSearchTools(effectiveServer, tokenProvider, connectionProvider, userAgentProvider, orgName));
  configureIfDomainEnabled(Domain.ADVANCED_SECURITY, () => configureAdvSecTools(effectiveServer, tokenProvider, connectionProvider));
}

export { configureAllTools };
