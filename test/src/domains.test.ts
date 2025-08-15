// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DomainsManager } from "../../src/shared/domains";

describe("DomainsManager backward compatibility", () => {
  // Mock console.log and console.warn to avoid test output noise
  let consoleSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe("constructor", () => {
    it("should enable all domains when no input is provided (backward compatibility)", () => {
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

      expect(consoleSpy).toHaveBeenCalledWith("No domains specified, enabling all domains for backward compatibility");
    });

    it("should enable all domains when undefined is passed", () => {
      const manager = new DomainsManager(undefined);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(Array.from(enabledDomains).sort()).toEqual(["advanced-security", "builds", "core", "releases", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
    });

    it("should enable all domains when null is passed", () => {
      // @ts-ignore - Testing null input for backward compatibility
      const manager = new DomainsManager(null);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });
  });

  describe("string input handling", () => {
    it("should enable all domains when 'all' string is passed", () => {
      const manager = new DomainsManager("all");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("should enable single domain when valid domain name is passed", () => {
      const manager = new DomainsManager("repositories");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(1);
      expect(enabledDomains.has("repositories")).toBe(true);
    });

    it("should handle case insensitive domain names", () => {
      const manager = new DomainsManager("REPOSITORIES");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(1);
      expect(enabledDomains.has("repositories")).toBe(true);
    });

    it("should warn and enable all domains when invalid domain is passed", () => {
      const manager = new DomainsManager("invalid-domain");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(warnSpy).toHaveBeenCalledWith(
        "Warning: Unknown domain 'invalid-domain'. Available domains: advanced-security, builds, core, releases, repositories, search, test-plans, wiki, work, work-items"
      );
      expect(consoleSpy).toHaveBeenCalledWith("No valid domains specified, enabling all domains by default");
    });
  });

  describe("array input handling", () => {
    it("should enable all domains when ['all'] array is passed", () => {
      const manager = new DomainsManager(["all"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("should enable multiple specific domains when array is passed", () => {
      const manager = new DomainsManager(["repositories", "builds", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
      expect(enabledDomains.has("wiki")).toBe(false);
    });

    it("should handle empty array by enabling all domains", () => {
      const manager = new DomainsManager([]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith("No valid domains specified, enabling all domains by default");
    });

    it("should filter out invalid domains and keep valid ones", () => {
      const manager = new DomainsManager(["repositories", "invalid-domain", "builds"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        "Warning: Unknown domain 'invalid-domain'. Available domains: advanced-security, builds, core, releases, repositories, search, test-plans, wiki, work, work-items"
      );
    });

    it("should handle case insensitive domain names in arrays", () => {
      const manager = new DomainsManager(["REPOSITORIES", "Builds", "work"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(3);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
      expect(enabledDomains.has("work")).toBe(true);
    });
  });

  describe("isDomainEnabled method", () => {
    it("should return true for enabled domains", () => {
      const manager = new DomainsManager(["repositories", "builds"]);

      expect(manager.isDomainEnabled("repositories")).toBe(true);
      expect(manager.isDomainEnabled("builds")).toBe(true);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });

    it("should return false for non-enabled domains", () => {
      const manager = new DomainsManager(["repositories"]);

      expect(manager.isDomainEnabled("builds")).toBe(false);
      expect(manager.isDomainEnabled("wiki")).toBe(false);
    });
  });

  describe("static methods", () => {
    it("should return all available domains", () => {
      const availableDomains = DomainsManager.getAvailableDomains();

      expect(availableDomains).toEqual(["advanced-security", "builds", "core", "releases", "repositories", "search", "test-plans", "wiki", "work", "work-items"]);
      expect(availableDomains.length).toBe(10);
    });
  });

  describe("getEnabledDomains method", () => {
    it("should return a new Set instance (not reference to internal set)", () => {
      const manager = new DomainsManager(["repositories"]);
      const enabledDomains1 = manager.getEnabledDomains();
      const enabledDomains2 = manager.getEnabledDomains();

      expect(enabledDomains1).not.toBe(enabledDomains2);
      expect(enabledDomains1).toEqual(enabledDomains2);
    });

    it("should not allow external modification of enabled domains", () => {
      const manager = new DomainsManager(["repositories"]);
      const enabledDomains = manager.getEnabledDomains();

      enabledDomains.add("builds");

      // Original manager should not be affected
      expect(manager.isDomainEnabled("builds")).toBe(false);
      expect(manager.getEnabledDomains().has("builds")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace in domain names", () => {
      const manager = new DomainsManager([" repositories ", " builds "]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("should handle duplicate domain names", () => {
      const manager = new DomainsManager(["repositories", "repositories", "builds"]);
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(2);
      expect(enabledDomains.has("repositories")).toBe(true);
      expect(enabledDomains.has("builds")).toBe(true);
    });

    it("should handle mixed case 'ALL' string", () => {
      const manager = new DomainsManager("ALL");
      const enabledDomains = manager.getEnabledDomains();

      expect(enabledDomains.size).toBe(10);
    });
  });
});
