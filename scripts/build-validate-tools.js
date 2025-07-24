#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readFileSync } from "fs";
import { globSync } from "glob";
import { validateToolName, validateParameterName, extractToolNames, extractParameterNames } from "../dist/shared/tool-validation.js";

/**
 * Main validation function
 */
function validateToolsAndParameters() {
  console.log("🔍 Validating tool names and parameter names...\n");

  const toolFiles = globSync("src/tools/*.ts");
  let hasErrors = false;

  for (const filePath of toolFiles) {
    const fileContent = readFileSync(filePath, "utf-8");
    const toolNames = extractToolNames(fileContent);
    const paramNames = extractParameterNames(fileContent);

    console.log(`📁 ${filePath}:`);

    // Validate tool names
    for (const toolName of toolNames) {
      const validation = validateToolName(toolName);
      if (!validation.isValid) {
        console.error(`  ❌ Tool name error: ${validation.error}`);
        hasErrors = true;
      } else {
        console.log(`  ✅ Tool: ${toolName} (${toolName.length} chars)`);
      }
    }

    // Validate parameter names
    for (const paramName of paramNames) {
      const validation = validateParameterName(paramName);
      if (!validation.isValid) {
        console.error(`  ❌ Parameter name error: ${validation.error}`);
        hasErrors = true;
      } else if (paramName.length > 32) {
        // Warning for long parameter names
        console.warn(`  ⚠️  Parameter: ${paramName} (${paramName.length} chars - consider shortening)`);
      }
    }

    console.log("");
  }

  if (hasErrors) {
    console.error("❌ Validation failed! Please fix the errors above.");
    process.exit(1);
  } else {
    console.log("✅ All tool names and parameter names are valid!");
  }
}

validateToolsAndParameters();
