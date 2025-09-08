// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { validateToolName, validateParameterName, extractToolNames, extractParameterNames } from "../../src/shared/tool-validation";

describe("Tool Name Validation", () => {
  describe("validateToolName", () => {
    test("should accept valid tool names", () => {
      const validNames = [
        "repo_create_pull_request",
        "pipelines_get_build_status",
        "tool.name",
        "tool-name",
        "tool_123",
        "a",
        "A" + "a".repeat(62) + "Z", // exactly 64 characters
      ];

      validNames.forEach((name) => {
        const result = validateToolName(name);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test("should reject invalid tool names", () => {
      const invalidCases = [
        { name: "", expectedError: "Tool name cannot be empty" },
        { name: "tool name", expectedError: "contains invalid characters" },
        { name: "tool/name", expectedError: "contains invalid characters" },
        { name: "tool@name", expectedError: "contains invalid characters" },
        { name: "tool name with spaces", expectedError: "contains invalid characters" },
        { name: "A" + "a".repeat(63) + "Z", expectedError: "is 65 characters long, maximum allowed is 64" }, // 65 characters
      ];

      invalidCases.forEach(({ name, expectedError }) => {
        const result = validateToolName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(expectedError);
      });
    });
  });

  describe("validateParameterName", () => {
    test("should accept valid parameter names", () => {
      const validNames = ["project", "repositoryId", "includeDetails", "param.name", "param-name", "param_123"];

      validNames.forEach((name) => {
        const result = validateParameterName(name);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test("should reject invalid parameter names", () => {
      const invalidCases = [
        { name: "", expectedError: "Parameter name cannot be empty" },
        { name: "param name", expectedError: "contains invalid characters" },
        { name: "param/name", expectedError: "contains invalid characters" },
      ];

      invalidCases.forEach(({ name, expectedError }) => {
        const result = validateParameterName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(expectedError);
      });
    });
  });

  describe("Character limits", () => {
    test("should handle edge cases for 64 character limit", () => {
      const exactly64 = "a".repeat(64);
      const exactly65 = "a".repeat(65);

      expect(validateToolName(exactly64).isValid).toBe(true);
      expect(validateToolName(exactly65).isValid).toBe(false);
    });
  });

  describe("Valid character patterns", () => {
    test("should allow all valid characters", () => {
      // Test a shorter string that includes all valid character types but stays under 64 chars
      const validChars = "abc_XYZ_123_.-test";
      const result = validateToolName(validChars);
      expect(result.isValid).toBe(true);
    });

    test("should reject invalid characters", () => {
      const invalidChars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "+", "=", "[", "]", "{", "}", "|", "\\", ":", ";", '"', "'", "<", ">", ",", "?", "/", " "];

      invalidChars.forEach((char) => {
        const result = validateToolName(`tool${char}name`);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("contains invalid characters");
      });
    });
  });

  describe("extractToolNames", () => {
    test("should extract tool names from tool constants", () => {
      const fileContent = `
        const REPO_TOOLS = {
          getRepo: "repo_get_repo",
          createPullRequest: "repo_create_pull_request",
          listBranches: "repo_list_branches",
        };

        const BUILD_TOOLS = {
          getBuild: "pipelines_get_builds",
          runBuild: "pipelines_run_pipeline",
        };
      `;

      const result = extractToolNames(fileContent);
      expect(result).toEqual(["repo_get_repo", "repo_create_pull_request", "repo_list_branches", "pipelines_get_builds", "pipelines_run_pipeline"]);
    });

    test("should handle different tool constant naming patterns", () => {
      const fileContent = `
        const WorkItemTools = {
          getWorkItem: "wit_get_work_item",
          updateWorkItem: "wit_update_work_item",
        };

        const Test_Plan_Tools = {
          createTestPlan: "testplan_create_test_plan",
        };

        const WIKI_TOOL = {
          getWiki: "wiki_get_wiki",
        };
      `;

      const result = extractToolNames(fileContent);
      expect(result).toEqual(["wit_get_work_item", "wit_update_work_item", "testplan_create_test_plan", "wiki_get_wiki"]);
    });

    test("should return empty array when no tools found", () => {
      const fileContent = `
        const someOtherConstant = {
          value: "not_a_tool",
        };

        function someFunction() {
          return "also_not_a_tool";
        }
      `;

      const result = extractToolNames(fileContent);
      expect(result).toEqual([]);
    });

    test("should handle malformed or incomplete tool definitions", () => {
      const fileContent = `
        const PARTIAL_TOOLS = {
          validTool: "valid_tool_name",
          // Missing quotes or malformed entries should be ignored
          invalidTool: invalid_without_quotes,
          anotherValid: "another_valid_tool",
        };
      `;

      const result = extractToolNames(fileContent);
      expect(result).toEqual(["valid_tool_name", "another_valid_tool"]);
    });
  });

  describe("extractParameterNames", () => {
    test("should extract parameter names from Zod schemas", () => {
      const fileContent = `
        const schema = z.object({
          projectId: z.string(),
          repositoryId: z.string(),
          includeDetails: z.boolean().optional(),
          maxResults: z.number(),
        });

        const anotherSchema = z.object({
          buildId: z.string(),
          status: z.enum(['pending', 'running', 'completed']),
        });
      `;

      const result = extractParameterNames(fileContent);
      expect(result).toEqual(["projectId", "repositoryId", "includeDetails", "maxResults", "buildId", "status"]);
    });

    test("should handle different Zod type definitions", () => {
      const fileContent = `
        const complexSchema = z.object({
          simpleString: z.string(),
          optionalNumber: z.number().optional(),
          arrayField: z.array(z.string()),
          unionField: z.union([z.string(), z.number()]),
          enumField: z.enum(['value1', 'value2']),
          booleanField: z.boolean(),
        });
      `;

      const result = extractParameterNames(fileContent);
      expect(result).toEqual(["simpleString", "optionalNumber", "arrayField", "unionField", "enumField", "booleanField"]);
    });

    test("should return empty array when no parameters found", () => {
      const fileContent = `
        const nonZodObject = {
          regularProperty: "value",
          anotherProperty: 123,
        };

        function regularFunction() {
          return "not a schema";
        }
      `;

      const result = extractParameterNames(fileContent);
      expect(result).toEqual([]);
    });

    test("should handle mixed content with both schemas and other code", () => {
      const fileContent = `
        import { z } from 'zod';

        const REPO_TOOLS = {
          getRepo: "repo_get_repo",
        };

        const getRepoSchema = z.object({
          repositoryId: z.string(),
          includeMetadata: z.boolean().optional(),
        });

        function someHelper() {
          return "helper function";
        }

        const updateSchema = z.object({
          id: z.string(),
          name: z.string(),
        });
      `;

      const result = extractParameterNames(fileContent);
      expect(result).toEqual(["repositoryId", "includeMetadata", "id", "name"]);
    });
  });
});
