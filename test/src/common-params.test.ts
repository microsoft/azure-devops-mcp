// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

import { optionalProject, optionalProjectWith, optionalTeam, optionalTeamWith, requiredProject, requiredTeam } from "../../src/shared/common-params";

describe("common project and team params", () => {
  it("makes the optional ones optional and the required ones required", () => {
    expect(optionalProject.isOptional()).toBe(true);
    expect(optionalTeam.isOptional()).toBe(true);
    expect(requiredProject.isOptional()).toBe(false);
    expect(requiredTeam.isOptional()).toBe(false);
  });

  it("accepts a name or an id, and rejects a non-string", () => {
    expect(requiredProject.parse("Contoso")).toBe("Contoso");
    expect(optionalProject.parse(undefined)).toBeUndefined();
    expect(() => requiredProject.parse(42)).toThrow();
  });

  // These strings are repeated across every tool schema, so a sentence added
  // here costs the model context on every single request.
  it("keeps the descriptions to one short sentence", () => {
    for (const schema of [optionalProject, requiredProject, optionalTeam, requiredTeam]) {
      expect(schema.description?.length).toBeLessThanOrEqual(40);
    }
  });

  it("appends a caller-visible note without repeating the boilerplate", () => {
    const described = optionalProjectWith("The project to delete.").description ?? "";
    expect(described).toBe("Azure DevOps project name or ID. The project to delete.");
    expect(optionalTeamWith("Omit for project-scoped dashboards.").description).toContain("Omit for project-scoped");
  });
});

// The wording lives in one module precisely so it cannot drift back into 171
// hand-written copies.
describe("tool modules", () => {
  const toolsDir = path.join(__dirname, "../../src/tools");

  // Matches any hand-written describe() whose text names the project or team
  // as such — the first sweep only caught one wording and left eleven sites
  // spelled "The unique identifier (ID or name) of the Azure DevOps project".
  const INLINE_DESCRIPTION = /\.describe\(\s*"[^"]*\bAzure DevOps (project|team)\b[^"]*"/;

  it("do not re-describe project or team inline", () => {
    const offenders = fs
      .readdirSync(toolsDir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => INLINE_DESCRIPTION.test(fs.readFileSync(path.join(toolsDir, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
