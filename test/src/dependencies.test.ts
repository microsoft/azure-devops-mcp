// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readFileSync, readdirSync } from "fs";
import { builtinModules } from "module";
import { join } from "path";

const SRC_DIR = join(__dirname, "..", "..", "src");
const PACKAGE_JSON = join(__dirname, "..", "..", "package.json");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

/** Reduces an import specifier to its installable package name. */
function toPackageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

function collectImportedPackages(): Set<string> {
  const builtins = new Set(builtinModules);
  const packages = new Set<string>();

  for (const file of listSourceFiles(SRC_DIR)) {
    const contents = readFileSync(file, "utf8");
    for (const match of contents.matchAll(/(?:from|import)\s+"([^"]+)"/g)) {
      const specifier = match[1];
      if (specifier.startsWith(".")) continue;

      const packageName = toPackageName(specifier);
      if (builtins.has(packageName) || builtins.has(specifier)) continue;

      packages.add(packageName);
    }
  }

  return packages;
}

describe("package dependencies", () => {
  it("declares every third-party package imported by src", () => {
    const declared = new Set(Object.keys(JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).dependencies ?? {}));

    const undeclared = [...collectImportedPackages()].filter((name) => !declared.has(name)).sort();

    // An undeclared package resolves only while a transitive dependency happens to
    // provide it, so a consumer install can break without any change to this repo.
    expect(undeclared).toEqual([]);
  });
});
