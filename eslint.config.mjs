import pluginHeader from "eslint-plugin-header";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import validateToolNamesRule from "./eslint-rules/tool-name-lint-rule.js";

pluginHeader.rules.header.meta.schema = false; // workaround for https://github.com/Stuk/eslint-plugin-header/issues/57

export default tseslint.config(
  // Global ignores
  {
    ignores: ["dist/**", "coverage/**", "src/version.ts"],
  },

  // Basic rule set
  tseslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,

  // Custom rule overrides
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Copyright
  {
    files: ["src/**/*.ts"],
    ignores: ["src/index.ts"],
    plugins: {
      header: pluginHeader,
    },
    rules: {
      "header/header": ["error", "line", [" Copyright (c) Microsoft Corporation.", " Licensed under the MIT License."], 2],
    },
  },

  // Tool name validation for MCP tools
  {
    files: ["src/tools/*.ts"],
    plugins: {
      custom: {
        rules: {
          "validate-tool-names": validateToolNamesRule,
        },
      },
    },
    rules: {
      "custom/validate-tool-names": "error",
    },
  },

  // Prettier integration (must be last)
  eslintConfigPrettier
);
