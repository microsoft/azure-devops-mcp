// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { logger } from "../logger.js";

/**
 * Available Azure DevOps MCP domains
 */
export enum Domain {
  ADVANCED_SECURITY = "advanced-security",
  PIPELINES = "pipelines",
  CORE = "core",
  REPOSITORIES = "repositories",
  SEARCH = "search",
  TEST_PLANS = "test-plans",
  WIKI = "wiki",
  WORK = "work",
  WORK_ITEMS = "work-items",
}

export const ALL_DOMAINS = "all";

/**
 * Manages domain parsing and validation for Azure DevOps MCP server tools
 */
export class DomainsManager {
  private static readonly AVAILABLE_DOMAINS = Object.values(Domain);

  private readonly enabledDomains: Set<string>;

  constructor(domainsInput?: string | string[]) {
    this.enabledDomains = new Set();
    this.parseDomains(domainsInput);
  }

  /**
   * Parse and validate domains from input
   * @param domainsInput - Either "all", single domain name, array of domain names, or undefined (defaults to "all")
   */
  private parseDomains(domainsInput?: string | string[]): void {
    if (!domainsInput) {
      this.enableAllDomains();
      return;
    }

    if (Array.isArray(domainsInput)) {
      this.handleArrayInput(domainsInput);
      return;
    }

    this.handleStringInput(domainsInput);
  }

  private handleArrayInput(domainsInput: string[]): void {
    if (domainsInput.length === 0 || domainsInput.includes(ALL_DOMAINS)) {
      this.enableAllDomains();
      return;
    }

    const domains = domainsInput.map((d) => d.trim().toLowerCase());
    this.validateAndAddDomains(domains);
  }

  private handleStringInput(domainsInput: string): void {
    if (domainsInput === ALL_DOMAINS) {
      this.enableAllDomains();
      return;
    }

    // Handle comma-separated domains
    const domains = domainsInput.split(",").map((d) => d.trim().toLowerCase());
    this.validateAndAddDomains(domains);
  }

  private validateAndAddDomains(domains: string[]): void {
    const availableDomainsAsStringArray = Object.values(Domain) as string[];
    domains.forEach((domain) => {
      if (availableDomainsAsStringArray.includes(domain)) {
        this.enabledDomains.add(domain);
      } else if (domain === ALL_DOMAINS) {
        this.enableAllDomains();
      } else {
        logger.error(`Error: Specified invalid domain '${domain}'. Please specify exactly as available domains: ${Object.values(Domain).join(", ")}`);
      }
    });

    if (this.enabledDomains.size === 0) {
      this.enableAllDomains();
    }
  }

  private enableAllDomains(): void {
    Object.values(Domain).forEach((domain) => this.enabledDomains.add(domain));
  }

  /**
   * Check if a specific domain is enabled
   * @param domain - Domain name to check
   * @returns true if domain is enabled
   */
  public isDomainEnabled(domain: string): boolean {
    return this.enabledDomains.has(domain);
  }

  /**
   * Get all enabled domains
   * @returns Set of enabled domain names
   */
  public getEnabledDomains(): Set<string> {
    return new Set(this.enabledDomains);
  }

  /**
   * Get list of all available domains
   * @returns Array of available domain names
   */
  public static getAvailableDomains(): string[] {
    return Object.values(Domain);
  }

  /**
   * Parse domains input from string or array to a normalized array of strings
   * @param domainsInput - Domains input to parse
   * @returns Normalized array of domain strings
   */
  public static parseDomainsInput(domainsInput?: string | string[]): string[] {
    if (!domainsInput || this.isEmptyDomainsInput(domainsInput)) {
      return ["all"];
    }

    if (typeof domainsInput === "string") {
      return domainsInput.split(",").map((d) => d.trim().toLowerCase());
    }

    return domainsInput.map((d) => d.trim().toLowerCase());
  }

  private static isEmptyDomainsInput(domainsInput?: string | string[]): boolean {
    if (typeof domainsInput === "string" && domainsInput.trim() === "") return true;
    if (Array.isArray(domainsInput) && domainsInput.length === 0) return true;
    return false;
  }
}
