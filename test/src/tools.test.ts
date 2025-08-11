// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "../../src/domains";
import { configureAllTools } from "../../src/tools";

// Mock all the tool configuration functions
jest.mock("../../src/tools/advanced-security.ts", () => ({
  configureAdvSecTools: jest.fn(),
}));

jest.mock("../../src/tools/builds.ts", () => ({
  configureBuildTools: jest.fn(),
}));

jest.mock("../../src/tools/core.ts", () => ({
  configureCoreTools: jest.fn(),
}));

jest.mock("../../src/tools/releases.ts", () => ({
  configureReleaseTools: jest.fn(),
}));

jest.mock("../../src/tools/repositories.ts", () => ({
  configureRepoTools: jest.fn(),
}));

jest.mock("../../src/tools/search.ts", () => ({
  configureSearchTools: jest.fn(),
}));

jest.mock("../../src/tools/test-plans.ts", () => ({
  configureTestPlanTools: jest.fn(),
}));

jest.mock("../../src/tools/wiki.ts", () => ({
  configureWikiTools: jest.fn(),
}));

jest.mock("../../src/tools/work.ts", () => ({
  configureWorkTools: jest.fn(),
}));

jest.mock("../../src/tools/work-items.ts", () => ({
  configureWorkItemTools: jest.fn(),
}));

// Import the mocked functions
import { configureAdvSecTools } from "../../src/tools/advanced-security.js";
import { configureBuildTools } from "../../src/tools/builds.js";
import { configureCoreTools } from "../../src/tools/core.js";
import { configureReleaseTools } from "../../src/tools/releases.js";
import { configureRepoTools } from "../../src/tools/repositories.js";
import { configureSearchTools } from "../../src/tools/search.js";
import { configureTestPlanTools } from "../../src/tools/test-plans.js";
import { configureWikiTools } from "../../src/tools/wiki.js";
import { configureWorkTools } from "../../src/tools/work.js";
import { configureWorkItemTools } from "../../src/tools/work-items.js";

describe("configureAllTools", () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockTokenProvider: jest.MockedFunction<() => Promise<AccessToken>>;
  let mockConnectionProvider: jest.MockedFunction<() => Promise<WebApi>>;
  let mockUserAgentProvider: jest.MockedFunction<() => string>;

  beforeEach(() => {
    // Create mock implementations
    mockServer = {
      // Add minimal required properties for McpServer mock
    } as jest.Mocked<McpServer>;

    mockTokenProvider = jest.fn().mockResolvedValue({
      token: "mock-token",
      expiresOnTimestamp: Date.now() + 3600000,
    } as AccessToken);

    mockConnectionProvider = jest.fn().mockResolvedValue({} as WebApi);
    mockUserAgentProvider = jest.fn().mockReturnValue("mock-user-agent");

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("domain-specific tool configuration", () => {
    it("should configure only core tools when only core domain is enabled", () => {
      const enabledDomains = new Set([Domain.CORE]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureCoreTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureAdvSecTools).not.toHaveBeenCalled();
      expect(configureBuildTools).not.toHaveBeenCalled();
      expect(configureReleaseTools).not.toHaveBeenCalled();
      expect(configureRepoTools).not.toHaveBeenCalled();
      expect(configureSearchTools).not.toHaveBeenCalled();
      expect(configureTestPlanTools).not.toHaveBeenCalled();
      expect(configureWikiTools).not.toHaveBeenCalled();
      expect(configureWorkTools).not.toHaveBeenCalled();
      expect(configureWorkItemTools).not.toHaveBeenCalled();
    });

    it("should configure only repositories and builds tools when those domains are enabled", () => {
      const enabledDomains = new Set([Domain.REPOSITORIES, Domain.BUILDS]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureRepoTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureBuildTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      
      // Verify other tools are not configured
      expect(configureCoreTools).not.toHaveBeenCalled();
      expect(configureAdvSecTools).not.toHaveBeenCalled();
      expect(configureReleaseTools).not.toHaveBeenCalled();
      expect(configureSearchTools).not.toHaveBeenCalled();
      expect(configureTestPlanTools).not.toHaveBeenCalled();
      expect(configureWikiTools).not.toHaveBeenCalled();
      expect(configureWorkTools).not.toHaveBeenCalled();
      expect(configureWorkItemTools).not.toHaveBeenCalled();
    });

    it("should configure all tools when all domains are enabled", () => {
      const enabledDomains = new Set(Object.values(Domain));

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureCoreTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureWorkTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureBuildTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureRepoTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureReleaseTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureWikiTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureTestPlanTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureAdvSecTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      
      // These tools require userAgentProvider
      expect(configureWorkItemTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
      expect(configureSearchTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
    });

    it("should not configure any tools when no domains are enabled", () => {
      const enabledDomains = new Set<string>();

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureCoreTools).not.toHaveBeenCalled();
      expect(configureAdvSecTools).not.toHaveBeenCalled();
      expect(configureBuildTools).not.toHaveBeenCalled();
      expect(configureReleaseTools).not.toHaveBeenCalled();
      expect(configureRepoTools).not.toHaveBeenCalled();
      expect(configureSearchTools).not.toHaveBeenCalled();
      expect(configureTestPlanTools).not.toHaveBeenCalled();
      expect(configureWikiTools).not.toHaveBeenCalled();
      expect(configureWorkTools).not.toHaveBeenCalled();
      expect(configureWorkItemTools).not.toHaveBeenCalled();
    });
  });

  describe("specific domain configurations", () => {
    it("should configure work items tools with userAgentProvider when work-items domain is enabled", () => {
      const enabledDomains = new Set([Domain.WORK_ITEMS]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureWorkItemTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
    });

    it("should configure search tools with userAgentProvider when search domain is enabled", () => {
      const enabledDomains = new Set([Domain.SEARCH]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureSearchTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
    });

    it("should configure wiki tools when wiki domain is enabled", () => {
      const enabledDomains = new Set([Domain.WIKI]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureWikiTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
    });

    it("should configure test plan tools when test-plans domain is enabled", () => {
      const enabledDomains = new Set([Domain.TEST_PLANS]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureTestPlanTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
    });

    it("should configure advanced security tools when advanced-security domain is enabled", () => {
      const enabledDomains = new Set([Domain.ADVANCED_SECURITY]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureAdvSecTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
    });

    it("should configure releases tools when releases domain is enabled", () => {
      const enabledDomains = new Set([Domain.RELEASES]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureReleaseTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
    });

    it("should configure work tools when work domain is enabled", () => {
      const enabledDomains = new Set([Domain.WORK]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureWorkTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
    });
  });

  describe("mixed domain configurations", () => {
    it("should configure multiple tools when multiple domains are enabled", () => {
      const enabledDomains = new Set([Domain.CORE, Domain.REPOSITORIES, Domain.WORK_ITEMS]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureCoreTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureRepoTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      expect(configureWorkItemTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
      
      // Verify other tools are not configured
      expect(configureAdvSecTools).not.toHaveBeenCalled();
      expect(configureBuildTools).not.toHaveBeenCalled();
      expect(configureReleaseTools).not.toHaveBeenCalled();
      expect(configureSearchTools).not.toHaveBeenCalled();
      expect(configureTestPlanTools).not.toHaveBeenCalled();
      expect(configureWikiTools).not.toHaveBeenCalled();
      expect(configureWorkTools).not.toHaveBeenCalled();
    });

    it("should handle case-sensitive domain names correctly", () => {
      // Test with lowercase domain values (which is what the enum should contain)
      const enabledDomains = new Set(["core", "repositories"]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureCoreTools).toHaveBeenCalled();
      expect(configureRepoTools).toHaveBeenCalled();
    });
  });

  describe("function call parameters", () => {
    it("should pass correct parameters to all configuration functions", () => {
      const enabledDomains = new Set([Domain.CORE, Domain.WORK_ITEMS, Domain.SEARCH]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      // Verify functions without userAgentProvider get correct parameters
      expect(configureCoreTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider);
      
      // Verify functions with userAgentProvider get correct parameters
      expect(configureWorkItemTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
      expect(configureSearchTools).toHaveBeenCalledWith(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider);
    });

    it("should call each configuration function exactly once when domain is enabled", () => {
      const enabledDomains = new Set([Domain.BUILDS]);

      configureAllTools(mockServer, mockTokenProvider, mockConnectionProvider, mockUserAgentProvider, enabledDomains);

      expect(configureBuildTools).toHaveBeenCalledTimes(1);
    });
  });
});
