// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DomainsManager } from "../../src/shared/domains";

describe("DomainsManager: backward compatibility and domain enabling", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("constructor", () => {
    it("enables all domains when no argument is provided (default behavior)", () => {
      const manager = new DomainsManager();
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(enabledDomains.has("advanced-security")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(enabledDomains.has("core")).toBe(true);
      expect(enabledDomains.has("releases")).toBe(true);
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

      expect(enabledDomains.size).toBe(10);
      expect(Array.from(enabledDomains).sort()).toEqual(["advanced-security", "builds", "core", "releases", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
    });

    it("enables all domains when null is passed as argument (legacy support)", () => {
      // @ts-ignore - Testing null input for backward compatibility
      const manager = new DomainsManager(null);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });
  });

  describe("string input handling", () => {
    it("enables all domains when the string 'all' is passed", () => {
      const manager = new DomainsManager("all");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
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

      expect(enabledDomains.size).toBe(10);
      expect(errorSpy).toHaveBeenCalledWith(
        "Error: Specified invalid domain 'invalid-domain'. Please specify exactly as available domains: advanced-security, builds, core, releases, repositories, search, test-plans, wiki, work, work-items"
      );
    });
  });

  describe("array input handling", () => {
    it("enables all domains when the array ['all'] is passed", () => {
      const manager = new DomainsManager(["all"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("enables only the specified domains when an array of valid domain names is passed", () => {
      const manager = new DomainsManager(["repositories", "builds", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
      expect(enabledDomains.has("wiki")).toBe(false);
    });

    it("enables all domains when an empty array is passed", () => {
      const manager = new DomainsManager([]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });

    it("filters out invalid domains and enables only valid ones when mixed array is passed", () => {
      const manager = new DomainsManager(["repositories", "invalid-domain", "builds"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("enables specified domains when array contains valid domain names in any case", () => {
      const manager = new DomainsManager(["REPOSITORIES", "Builds", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
    });
  });

  describe("isDomainEnabled method", () => {
    it("returns true for domains that are enabled", () => {
      const manager = new DomainsManager(["repositories", "builds"]);

      expect(manager.isDomainEnabled("repositories")).toBe(true);
      expect(manager.isDomainEnabled("builds")).toBe(true);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });

    it("returns false for domains that are not enabled", () => {
      const manager = new DomainsManager(["repositories"]);

      expect(manager.isDomainEnabled("builds")).toBe(false);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });
  });

  describe("getAvailableDomains method", () => {
    it("returns the full list of available domains", () => {
      const availableDomains = DomainsManager.getAvailableDomains();

      expect(availableDomains).toEqual(["advanced-security", "builds", "core", "releases", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
      expect(availableDomains.length).toBe(10);
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

      enabledDomains.add("builds");

      expect(manager.isDomainEnabled("builds")).toBe(false);
      expect(manager.getEnabledDomains().has("builds")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("trims whitespace from domain names in input array", () => {
      const manager = new DomainsManager([" repositories ", " builds "]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("handles duplicate domain names in input array by enabling each only once", () => {
      const manager = new DomainsManager(["repositories", "repositories", "builds"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("enables all domains when the string 'ALL' (any case) is passed", () => {
      const manager = new DomainsManager("ALL");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });
  });

  describe("'all' domain enabling scenarios", () => {
    it("enables all domains when only 'all' is passed in array", () => {
      const manager = new DomainsManager(["all"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });

    it("enables all domains when 'all' is passed together with other valid domains", () => {
      const manager = new DomainsManager(["all", "builds"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });

    it("enables all domains when 'all' is passed along with invalid domains", () => {
      const manager = new DomainsManager(["a", "all", "wiki"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });
  });
});
