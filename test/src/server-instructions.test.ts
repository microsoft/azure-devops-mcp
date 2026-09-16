// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";

// domains.ts pulls in the winston logger, whose Azure dependency confuses the
// suite's ".js" -> ".ts" module mapping.
jest.mock("../../src/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { Domain } from "../../src/shared/domains";
import { resolvePreset } from "../../src/shared/presets";
import { buildServerInstructions } from "../../src/shared/server-instructions";

const allDomains = new Set<string>(Object.values(Domain));

function preset(name: string): Set<string> {
  const domains = resolvePreset(name);
  if (!domains) throw new Error(`unknown preset ${name}`);
  return domains;
}

describe("buildServerInstructions", () => {
  it("names the organization it is bound to", () => {
    expect(buildServerInstructions(allDomains, { organization: "contoso" })).toContain('"contoso"');
  });

  it("falls back to a generic scope when no organization is given", () => {
    const text = buildServerInstructions(allDomains);
    expect(text).toContain("an Azure DevOps organization");
  });

  // The text is sent with every initialize; it has to stay small enough to be
  // worth it next to the tool schemas.
  it("stays well under the cost of the tool schemas", () => {
    expect(buildServerInstructions(allDomains, { organization: "contoso" }).length).toBeLessThan(6000);
  });

  it("describes every enabled domain's name prefix", () => {
    const text = buildServerInstructions(allDomains);
    for (const prefix of ["core_", "wit_", "work_", "repo_", "pipelines_", "witprocess_", "search_", "memberentitlement_"]) {
      expect(text).toContain(prefix);
    }
  });

  // A domain with no guide entry would be served but never described, and the
  // organization-wide warning below looks its prefix up in the same table.
  it.each(Object.values(Domain))("describes the '%s' domain", (domain) => {
    const text = buildServerInstructions(new Set<string>([domain]));
    const described = text.split("\n").filter((line) => line.startsWith("- ") && line.includes("_ —"));
    expect(described).toHaveLength(1);
    expect(text).not.toContain("undefined");
  });

  it("does not advertise domains the endpoint does not serve", () => {
    const text = buildServerInstructions(new Set<string>([Domain.CORE, Domain.PROFILE]));
    expect(text).toContain("core_");
    expect(text).not.toContain("witprocess_");
    expect(text).not.toContain("repo_");
  });

  it("omits guidance whose tools are not served", () => {
    const withSearch = buildServerInstructions(new Set<string>([Domain.CORE, Domain.SEARCH]));
    const withoutSearch = buildServerInstructions(new Set<string>([Domain.CORE]));

    expect(withSearch).toContain("search_code");
    expect(withoutSearch).not.toContain("search_code");
  });

  it("warns about organization-wide writes only when such a domain is enabled", () => {
    expect(buildServerInstructions(new Set<string>([Domain.WIT_PROCESS]))).toContain("affect the whole organization");
    expect(buildServerInstructions(new Set<string>([Domain.CORE, Domain.REPOSITORIES]))).not.toContain("affect the whole organization");
  });

  // Clients do not fetch resources by themselves, so an unmentioned resource
  // is an unused one.
  it("points at the resources the endpoint serves, and only those", () => {
    const withWorkItems = buildServerInstructions(new Set<string>([Domain.CORE, Domain.WORK_ITEMS]));
    expect(withWorkItems).toContain("ado://wiql-reference");
    expect(withWorkItems).toContain("ado://projects");

    const withoutWorkItems = buildServerInstructions(new Set<string>([Domain.CORE]));
    expect(withoutWorkItems).toContain("ado://projects");
    expect(withoutWorkItems).not.toContain("ado://wiql-reference");

    expect(buildServerInstructions(new Set<string>([Domain.REPOSITORIES]))).not.toContain("ado://");
  });

  it("tells the model when it is talking to a preset endpoint", () => {
    expect(buildServerInstructions(preset("dev"), { preset: "dev" })).toContain('"dev" subset');

    expect(buildServerInstructions(allDomains)).not.toContain("subset of the server's tools");
  });

  it("is deterministic — it runs on every request", () => {
    const domains = preset("ops");
    expect(buildServerInstructions(domains, { organization: "contoso", preset: "ops" })).toBe(buildServerInstructions(domains, { organization: "contoso", preset: "ops" }));
  });
});
