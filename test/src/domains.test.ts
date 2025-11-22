// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DomainsManager } from "../../src/shared/domains";
import { logger } from "../../src/logger";

jest.mock("../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("DomainsManager: backward compatibility and domain enabling", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("constructor", () => {
    it("enables all domains when no argument is provided (default behavior)", () => {
      const manager = new DomainsManager();
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(enabledDomains.has("advanced-security")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
      expect(enabledDomains.has("core")).toBe(true);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("search")).toBe(true);
      expect(enabledDomains.has("test-plans")).toBe(true);
      expect(enabledDomains.has("wiki")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
      expect(enabledDomains.has("work-items")).toBe(true);
    });

    it("enables all domains when undefined is passed as argument", () => {
      const manager = new DomainsManager(undefined);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(Array.from(enabledDomains).sort()).toEqual(["advanced-security", "core", "pipelines", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
    });

    it("enables all domains when null is passed as argument (legacy support)", () => {
      // @ts-expect-error - Testing null input for backward compatibility
      const manager = new DomainsManager(null);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });
  });

  describe("string input handling", () => {
    it("enables all domains when the string 'all' is passed", () => {
      const manager = new DomainsManager("all");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
    });

    it("enables only the specified domain when a valid domain name string is passed", () => {
      const manager = new DomainsManager("repositories");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(1);
      expect(enabledDomains.has("repositories")).toBe(true);
    });

    it("enables only the specified domain when a valid domain name string is passed (case insensitive)", () => {
      const manager = new DomainsManager("REPOSITORIES");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(1);
      expect(enabledDomains.has("repositories")).toBe(true);
    });

    it("Error and enables all domains when an invalid domain name string is passed", () => {
      const manager = new DomainsManager("invalid-domain");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(errorSpy).toHaveBeenCalledWith(
        "Error: Specified invalid domain 'invalid-domain'. Please specify exactly as available domains: advanced-security, pipelines, core, repositories, search, test-plans, wiki, work, work-items"
      );
    });
  });

  describe("array input handling", () => {
    it("enables all domains when the array ['all'] is passed", () => {
      const manager = new DomainsManager(["all"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
    });

    it("enables only the specified domains when an array of valid domain names is passed", () => {
      const manager = new DomainsManager(["repositories", "pipelines", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
      expect(enabledDomains.has("wiki")).toBe(false);
    });

    it("enables all domains when an empty array is passed", () => {
      const manager = new DomainsManager([]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("filters out invalid domains and enables only valid ones when mixed array is passed", () => {
      const manager = new DomainsManager(["repositories", "invalid-domain", "pipelines"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
    });

    it("enables specified domains when array contains valid domain names in any case", () => {
      const manager = new DomainsManager(["REPOSITORIES", "pipelines", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
    });
  });

  describe("isDomainEnabled method", () => {
    it("returns true for domains that are enabled", () => {
      const manager = new DomainsManager(["repositories", "pipelines"]);

      expect(manager.isDomainEnabled("repositories")).toBe(true);
      expect(manager.isDomainEnabled("pipelines")).toBe(true);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });

    it("returns false for domains that are not enabled", () => {
      const manager = new DomainsManager(["repositories"]);

      expect(manager.isDomainEnabled("pipelines")).toBe(false);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });
  });

  describe("getAvailableDomains method", () => {
    it("returns the full list of available domains", () => {
      const availableDomains = DomainsManager.getAvailableDomains();

      expect(availableDomains).toEqual(["advanced-security", "pipelines", "core", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
      expect(availableDomains.length).toBe(9);
    });
  });

  describe("getEnabledDomains method", () => {
    it("returns a new Set instance each time (not a reference to internal set)", () => {
      const manager = new DomainsManager(["repositories"]);
      const enabledDomains1 = manager.getEnabledDomains();
      const enabledDomains2 = manager.getEnabledDomains();

      expect(enabledDomains1).not.toBe(enabledDomains2);
      expect(enabledDomains1).toEqual(enabledDomains2);
    });

    it("prevents external modification of enabled domains", () => {
      const manager = new DomainsManager(["repositories"]);
      const enabledDomains = manager.getEnabledDomains();

      enabledDomains.add("pipelines");

      expect(manager.isDomainEnabled("pipelines")).toBe(false);
      expect(manager.getEnabledDomains().has("pipelines")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("trims whitespace from domain names in input array", () => {
      const manager = new DomainsManager([" repositories ", " pipelines "]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
    });

    it("handles duplicate domain names in input array by enabling each only once", () => {
      const manager = new DomainsManager(["repositories", "repositories", "pipelines"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("pipelines")).toBe(true);
    });

    it("enables all domains when the string 'ALL' (any case) is passed", () => {
      const manager = new DomainsManager("ALL");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });
  });

  describe("'all' domain enabling scenarios", () => {
    it("enables all domains when only 'all' is passed in array", () => {
      const manager = new DomainsManager(["all"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("enables all domains when 'all' is passed together with other valid domains", () => {
      const manager = new DomainsManager(["all", "pipelines"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("enables all domains when 'all' is passed along with invalid domains", () => {
      const manager = new DomainsManager(["a", "all", "wiki"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });
  });

  describe("parseDomainsInput static method", () => {
    it("returns 'all' when no input is provided", () => {
      const result = DomainsManager.parseDomainsInput();
      expect(result).toEqual(["all"]);
    });

    it("returns 'all' array when undefined is provided", () => {
      const result = DomainsManager.parseDomainsInput(undefined);
      expect(result).toEqual(["all"]);
    });

    it("parses comma-separated string input", () => {
      const result = DomainsManager.parseDomainsInput("repositories,pipelines,core");
      expect(result).toEqual(["repositories", "pipelines", "core"]);
    });

    it("trims and lowercases comma-separated string input", () => {
      const result = DomainsManager.parseDomainsInput(" REPOSITORIES , pipelines , CORE ");
      expect(result).toEqual(["repositories", "pipelines", "core"]);
    });

    it("processes array input by trimming and lowercasing", () => {
      const result = DomainsManager.parseDomainsInput([" REPOSITORIES ", " pipelines ", " CORE "]);
      expect(result).toEqual(["repositories", "pipelines", "core"]);
    });
  });

  describe("edge cases and additional coverage", () => {
    it("handles 'all' mixed with valid domains in validateAndAddDomains", () => {
      const manager = new DomainsManager(["repositories", "all", "pipelines"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("enables all domains when all specified domains are invalid", () => {
      const manager = new DomainsManager(["invalid1", "invalid2"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
      expect(errorSpy).toHaveBeenCalledTimes(2);
    });

    it("handles case insensitive 'ALL' string input", () => {
      const manager = new DomainsManager("ALL");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("processes 'all' through validateAndAddDomains when passed as uppercase string", () => {
      // This tests the case where "ALL" goes through validateAndAddDomains
      // and hits the domain === ALL_DOMAINS branch after being lowercased
      const manager = new DomainsManager("ALL");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("processes 'all' through validateAndAddDomains in comma-separated string", () => {
      // This will test the parseDomainsInput -> validateAndAddDomains path
      const manager = new DomainsManager("repositories,all");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("hits handleStringInput with exact 'all' string", () => {
      // This should hit the domainsInput === ALL_DOMAINS path in handleStringInput
      const manager = new DomainsManager("all");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("tests direct parseDomainsInput with empty string", () => {
      // Test parseDomains with falsy value
      const manager = new DomainsManager("");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(9);
    });

    it("tests comma-separated string input with 'all' keyword", () => {
      // This should trigger parseDomainsInput splitting, then validateAndAddDomains with 'all'
      const result = DomainsManager.parseDomainsInput("repositories,all,core");
      expect(result).toEqual(["repositories", "all", "core"]);

      // Test that this actually gets processed correctly
      const manager = new DomainsManager("repositories,all,core");
      const enabledDomains = manager.getEnabledDomains();
      expect(enabledDomains.size).toBe(9); // Should enable all because 'all' is present
    });
  });

  describe("edge empty string cases for enabling all domains", () => {
    it("when an empty array is passed", () => {
      const manager = new DomainsManager([]);
      const enabledDomains = manager.getEnabledDomains();
      expect(enabledDomains.size).toBe(9);
    });

    it("when a string with only a break line is passed", () => {
      const manager = new DomainsManager("\n");
      const enabledDomains = manager.getEnabledDomains();
      expect(enabledDomains.size).toBe(9);
    });

    it("when an empty string is passed", () => {
      const manager = new DomainsManager("");
      const enabledDomains = manager.getEnabledDomains();
      expect(enabledDomains.size).toBe(9);
    });
  });
});
