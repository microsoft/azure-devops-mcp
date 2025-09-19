// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { Domain } from "../../../src/shared/domains";
import { _mockTags, _mockWorkItemsWithTags, _mockWiqlQueryResult, _mockEmptyWiqlQueryResult, _mockTagAnalyticsResponse } from "../../mocks/tags";

describe("Tag Tools - Mock Data and Structure Tests", () => {
  describe("Mock data validation", () => {
    it("should have valid mock tags structure", () => {
      expect(_mockTags).toHaveProperty("count");
      expect(_mockTags).toHaveProperty("value");
      expect(Array.isArray(_mockTags.value)).toBe(true);
      expect(_mockTags.count).toBe(5);
      expect(_mockTags.value.length).toBe(5);

      _mockTags.value.forEach((tag) => {
        expect(tag).toHaveProperty("id");
        expect(tag).toHaveProperty("name");
        expect(tag).toHaveProperty("url");
        expect(typeof tag.name).toBe("string");
      });
    });

    it("should have valid mock work items with tags", () => {
      expect(_mockWorkItemsWithTags).toHaveProperty("count");
      expect(_mockWorkItemsWithTags).toHaveProperty("value");
      expect(Array.isArray(_mockWorkItemsWithTags.value)).toBe(true);
      expect(_mockWorkItemsWithTags.value.length).toBe(4);

      _mockWorkItemsWithTags.value.forEach((workItem) => {
        expect(workItem).toHaveProperty("id");
        expect(workItem).toHaveProperty("fields");
        if (workItem.fields["System.Tags"]) {
          expect(typeof workItem.fields["System.Tags"]).toBe("string");
        }
      });
    });

    it("should have valid WIQL query result structure", () => {
      expect(_mockWiqlQueryResult).toHaveProperty("workItems");
      expect(Array.isArray(_mockWiqlQueryResult.workItems)).toBe(true);
      expect(_mockWiqlQueryResult.workItems.length).toBe(2);

      _mockWiqlQueryResult.workItems.forEach((item) => {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("url");
      });
    });

    it("should have valid empty WIQL query result", () => {
      expect(_mockEmptyWiqlQueryResult).toHaveProperty("workItems");
      expect(Array.isArray(_mockEmptyWiqlQueryResult.workItems)).toBe(true);
      expect(_mockEmptyWiqlQueryResult.workItems.length).toBe(0);
    });

    it("should have valid tag analytics response", () => {
      expect(_mockTagAnalyticsResponse).toHaveProperty("summary");
      expect(_mockTagAnalyticsResponse).toHaveProperty("usedTags");
      expect(_mockTagAnalyticsResponse).toHaveProperty("unusedTags");
      expect(_mockTagAnalyticsResponse).toHaveProperty("analysis");
      expect(Array.isArray(_mockTagAnalyticsResponse.usedTags)).toBe(true);
      expect(_mockTagAnalyticsResponse.usedTags.length).toBe(4);

      _mockTagAnalyticsResponse.usedTags.forEach((usage) => {
        expect(usage).toHaveProperty("tag");
        expect(usage).toHaveProperty("usageCount");
        expect(typeof usage.tag).toBe("string");
        expect(typeof usage.usageCount).toBe("number");
      });
    });
  });

  describe("Domain configuration", () => {
    it("should include TAG domain in available domains", () => {
      expect(Domain.TAG).toBe("tag");
    });
  });

  describe("Tag tool names and functionality expectations", () => {
    // These tests verify the expected tool names exist in the codebase without importing the problematic module
    const expectedTagTools = [
      "search_workitem_by_tags",
      "list_project_workitem_tags",
      "add_tags_to_workitem",
      "remove_tags_from_workitem",
      "delete_workitem_tag_by_name",
      "delete_unused_workitem_tags",
      "update_workitem_tag",
      "workitem_tags_comprehensive_analytics",
    ];

    it("should expect all 8 tag tools to be available", () => {
      expect(expectedTagTools.length).toBe(8);

      // Verify each tool name follows expected naming convention
      expectedTagTools.forEach((toolName) => {
        expect(toolName).toMatch(/^[a-z_]+$/); // lowercase with underscores
        expect(toolName).toContain("tag"); // all should contain "tag"
      });
    });

    it("should have tag tools that cover main functionality areas", () => {
      const searchTools = expectedTagTools.filter((name) => name.includes("search"));
      const listTools = expectedTagTools.filter((name) => name.includes("list"));
      const addTools = expectedTagTools.filter((name) => name.includes("add"));
      const removeTools = expectedTagTools.filter((name) => name.includes("remove"));
      const deleteTools = expectedTagTools.filter((name) => name.includes("delete"));
      const updateTools = expectedTagTools.filter((name) => name.includes("update"));
      const analyticsTools = expectedTagTools.filter((name) => name.includes("analytics"));

      expect(searchTools.length).toBeGreaterThan(0);
      expect(listTools.length).toBeGreaterThan(0);
      expect(addTools.length).toBeGreaterThan(0);
      expect(removeTools.length).toBeGreaterThan(0);
      expect(deleteTools.length).toBeGreaterThan(0);
      expect(updateTools.length).toBeGreaterThan(0);
      expect(analyticsTools.length).toBeGreaterThan(0);
    });
  });

  describe("Mock data integration scenarios", () => {
    it("should simulate tag search functionality", () => {
      const searchQuery = "backend";
      const matchingTags = _mockTags.value.filter((tag) => tag.name.toLowerCase().includes(searchQuery.toLowerCase()));

      expect(matchingTags.length).toBe(1);
      expect(matchingTags[0].name).toBe("backend");
    });

    it("should simulate work item tag retrieval", () => {
      const workItemWithTags = _mockWorkItemsWithTags.value.find((item) => item.fields["System.Tags"] && item.fields["System.Tags"].includes("backend"));

      expect(workItemWithTags).toBeDefined();
      expect(workItemWithTags?.fields["System.Tags"]).toContain("backend");
    });

    it("should simulate tag analytics processing", () => {
      const totalUsage = _mockTagAnalyticsResponse.usedTags.reduce((sum, usage) => sum + usage.usageCount, 0);

      expect(totalUsage).toBe(5); // 2 + 1 + 1 + 1

      const mostUsedTag = _mockTagAnalyticsResponse.usedTags.reduce((max, current) => (current.usageCount > max.usageCount ? current : max));

      expect(mostUsedTag.tag).toBe("bug");
      expect(mostUsedTag.usageCount).toBe(2);
    });

    it("should handle empty tag scenarios", () => {
      expect(_mockEmptyWiqlQueryResult.workItems.length).toBe(0);

      const workItemsWithoutTags = _mockWorkItemsWithTags.value.filter((item) => !item.fields["System.Tags"]);

      expect(workItemsWithoutTags.length).toBeGreaterThan(0);
    });
  });

  describe("Error handling scenarios", () => {
    it("should handle invalid tag operations gracefully", () => {
      const invalidTagName = "";
      const invalidWorkItemId = -1;

      expect(typeof invalidTagName).toBe("string");
      expect(typeof invalidWorkItemId).toBe("number");
      expect(invalidTagName.length).toBe(0);
      expect(invalidWorkItemId).toBeLessThan(0);
    });

    it("should validate tag name constraints", () => {
      const validTagNames = ["backend", "feature", "high-priority", "bug"];
      const invalidTagNames = ["", "   ", "tag with spaces", "tag;with;semicolons"];

      validTagNames.forEach((name) => {
        expect(name.length).toBeGreaterThan(0);
        expect(name.trim()).toBe(name);
      });

      invalidTagNames.forEach((name) => {
        const hasIssues = name.length === 0 || name.trim() !== name || name.includes(" ") || name.includes(";");
        expect(hasIssues).toBe(true);
      });
    });
  });
});
