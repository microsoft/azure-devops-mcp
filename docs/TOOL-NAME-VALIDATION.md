# Tool Name Validation Guardrails

This document describes the validation system for Azure DevOps MCP server tool names and parameter names to prevent Claude API validation errors.

## Problem Statement

Claude API has strict requirements for tool names and parameter names:

- Must match pattern: `^[a-zA-Z0-9_.-]{1,64}$`
- Maximum length: 64 characters
- Only alphanumeric characters, underscores, dots, and hyphens are allowed
- No spaces or special characters

Failing to comply results in errors like:

```json
API Error: 400
{"type":"error","error":{"type":"invalid_request_error","message":"tools.127.custom.input_schema.properties: Property keys should match pattern '^[a-zA-Z0-9_.-]{1,64}$'"}}
```

## Guardrails Implemented

### 1. Build-time Validation Script

**Location:** `scripts/build-validate-tools.js`

**Description:** Scans all tool files and validates tool names and parameter names.

**Usage:**

```bash
npm run validate-tools
```

**Features:**

- Extracts tool names from `*_TOOLS` constant objects
- Extracts parameter names from Zod schema definitions
- Validates against Claude API requirements
- Shows character counts for each name
- Warns about parameter names longer than 32 characters (recommendation)
- Fails build if invalid names are found

### 2. ESLint Rule

**Location:** `eslint-rules/tool-name-lint-rule.js`

**Description:** Custom ESLint rule that validates tool names and parameter names during development.

**Features:**

- Real-time validation in IDE
- Integrated with existing ESLint configuration
- Shows errors for invalid names
- Warnings for long parameter names

**Configuration in `eslint.config.mjs`:**

```javascript
{
  files: ["src/tools/*.ts"],
  plugins: {
    "custom": {
      rules: {
        "validate-tool-names": validateToolNamesRule,
      },
    },
  },
  rules: {
    "custom/validate-tool-names": "error",
  },
}
```

### 3. Shared Validation Module

**Location:** `src/shared/tool-validation.ts`

**Functions:**

- `validateToolName(toolName: string)`: Validates a single tool name
- `validateParameterName(paramName: string)`: Validates a single parameter name
- `validateName(name: string)`: Core validation function used by both tool and parameter validation
- `extractToolNames(fileContent: string)`: Extracts tool names from TypeScript files
- `extractParameterNames(fileContent: string)`: Extracts parameter names from Zod schemas

**Usage:**

```typescript
import { validateToolName, validateParameterName } from "./shared/tool-validation.js";

const validation = validateToolName("my_tool_name");
if (!validation.isValid) {
  console.error(validation.error);
}
```

### 4. Test Coverage

**Location:** `test/src/tool-name-validation.test.ts`

**Coverage:** 100% statements, branches, functions, and lines

**Test Categories:**

- **Validation Functions**: Tests for `validateToolName` and `validateParameterName` with valid/invalid inputs
- **Character Patterns**: Tests for all valid characters (a-z, A-Z, 0-9, \_, ., -) and invalid characters
- **Length Limits**: Edge cases for 64-character maximum length
- **Extraction Functions**: Tests for `extractToolNames` and `extractParameterNames` with real-world patterns
- **Edge Cases**: Empty inputs, malformed content, mixed file content

**Running Tests:**

```bash
# Run all validation tests
npm test test/src/tool-name-validation.test.ts

# Run with coverage report
npm test test/src/tool-name-validation.test.ts -- --coverage
```

## Architecture Overview

The validation system uses a **consolidated architecture** with shared validation logic:

```bash
src/shared/tool-validation.ts         # Single source of truth for validation logic
├── validateName()                    # Core validation function
├── validateToolName()                # Tool-specific validation
├── validateParameterName()           # Parameter-specific validation
├── extractToolNames()                # Extract tools from TypeScript files
└── extractParameterNames()           # Extract parameters from Zod schemas

scripts/build-validate-tools.js       # Build-time validation (imports shared module)
eslint-rules/tool-name-lint-rule.js   # ESLint rule (imports shared module)
test/src/tool-name-validation.test.ts # Comprehensive tests (100% coverage)
```

**Benefits:**

- **No Code Duplication**: Single validation implementation
- **Consistent Behavior**: Same logic across build-time and development-time validation
- **Maintainable**: Changes in one place update all validation systems
- **Well-Tested**: 100% test coverage ensures reliability

## Best Practices

### Tool Naming

- Use descriptive but concise names
- Follow the pattern: `{category}_{action}_{object}`
- Examples: `repo_create_pull_request`, `pipelines_get_build_status`
- Maximum 64 characters (current longest is 40 characters)

### Parameter Naming

- Use clear, descriptive names
- Avoid abbreviations unless commonly understood
- Keep under 32 characters for readability (recommendation)
- Examples: `project`, `repositoryId`, `includeDetails`

### Development Workflow

1. Create new tools with descriptive names
2. Run `npm run validate-tools` to check compliance
3. Fix any validation errors before committing
4. ESLint will catch issues in real-time during development

## Validation Rules

### Valid Characters

- Alphanumeric: `a-z`, `A-Z`, `0-9`
- Underscore: `_`
- Dot: `.`
- Hyphen: `-`

### Invalid Characters

- Spaces: ` `
- Forward slash: `/`
- Special characters: `@`, `#`, `$`, `%`, etc.

### Length Limits

- Minimum: 1 character
- Maximum: 64 characters
- Recommended for parameters: ≤32 characters

## Troubleshooting

### Common Issues

1. **Tool name contains spaces**

   ```text
   Error: Tool name 'my tool name' contains invalid characters
   ```

   Solution: Use underscores instead: `my_tool_name`

2. **Tool name too long**

   ```text
   Error: Tool name 'very_long_descriptive_tool_name_that_exceeds_limit' is 45 characters long, maximum allowed is 64
   ```

   Solution: Shorten the name: `long_tool_name`

3. **Special characters in name**

   ```text
   Error: Tool name 'tool/name' contains invalid characters
   ```

   Solution: Use allowed characters: `tool_name`

### Running Validation

```bash
# Validate all tools
npm run validate-tools

# Run ESLint on tool files
npx eslint src/tools/*.ts
```
