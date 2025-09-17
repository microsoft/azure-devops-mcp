// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { orgName } from "../index.js";

const TAG_TOOLS = {
  search_workitem_by_tags: "search_workitem_by_tags",
  workitem_tags_comprehensive_analytics: "workitem_tags_comprehensive_analytics",
  list_project_workitem_tags: "list_project_workitem_tags",
  delete_workitem_tag_by_name: "delete_workitem_tag_by_name",
  delete_unused_workitem_tags: "delete_unused_workitem_tags",
  update_workitem_tag: "update_workitem_tag",
  add_tags_to_workitem: "add_tags_to_workitem",
  remove_tags_from_workitem: "remove_tags_from_workitem",
};

function configureTagTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    TAG_TOOLS.search_workitem_by_tags,
    "Get Azure DevOps Work Item search results for a given search text",
    {
      project: z.array(z.string()).optional(),
      areaPath: z.array(z.string()).optional(),
      workItemType: z.array(z.string()).optional(),
      state: z.array(z.string()).optional(),
      tag: z.array(z.string()),
      assignedTo: z.array(z.string()).optional(),
    },
    async ({ project, areaPath, workItemType, state, tag, assignedTo }) => {
      const accessToken = await tokenProvider();

      const wiqlConditions: string[] = [];

      if (project && project.length > 0) {
        wiqlConditions.push(`[System.TeamProject] = '${project[0]}'`);
      }
      if (areaPath && areaPath.length > 0) {
        wiqlConditions.push(`[System.AreaPath] IN ('${areaPath.join("','")}')`);
      }
      if (workItemType && workItemType.length > 0) {
        wiqlConditions.push(`[System.WorkItemType] IN ('${workItemType.join("','")}')`);
      }
      if (state && state.length > 0) {
        wiqlConditions.push(`[System.State] IN ('${state.join("','")}')`);
      }
      if (assignedTo && assignedTo.length > 0) {
        wiqlConditions.push(`[System.AssignedTo] IN ('${assignedTo.join("','")}')`);
      }

      tag.forEach(t => {
        wiqlConditions.push(`[System.Tags] CONTAINS '${t}'`);
      });

      const wiqlQuery = `
        SELECT [System.Id], [System.Title], [System.State], [System.Tags]
        FROM WorkItems
        WHERE ${wiqlConditions.join(" AND ")}
        ORDER BY [System.ChangedDate] DESC
      `;

      const wiqlUrl = `https://dev.azure.com/${orgName}/${project?.[0] || ''}/_apis/wit/wiql?api-version=7.1-preview.2`;

      const wiqlResponse = await fetch(wiqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify({ query: wiqlQuery }),
      });

      if (!wiqlResponse.ok) {
        throw new Error(`WIQL API error: ${wiqlResponse.status} ${wiqlResponse.statusText}`);
      }

      const wiqlResult = await wiqlResponse.json();
      return {
        content: [{ type: "text", text: JSON.stringify(wiqlResult.workItems, null, 2) }],
      };
    }
  );

  server.tool(
    TAG_TOOLS.list_project_workitem_tags,
    "List all tags for a repository.",
    {
      project: z.string().describe("Project name or ID"),
    },
    async ({ project }) => {
      try {
        const accessToken = await tokenProvider();
        const url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags/`;
        const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
          "User-Agent": userAgentProvider(),
        },
      });
      const tags = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              tags.value.map((tag: { name: string }) => tag.name),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
          content: [
            {
              type: "text",
              text: `Error fetching tags: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.workitem_tags_comprehensive_analytics,
    "Comprehensive tag analytics showing usage statistics, trends, and unused tags in a single response",
    { 
      project: z.string().describe("Project name or ID"),
      top: z.number().default(1000).describe("The maximum number of work items to analyze for tag usage. Defaults to 1000."),
      maxTagsToCheck: z.number().default(100).describe("The maximum number of tags to check for unused status. Defaults to 100 for performance.")
    },
    async ({ project, top, maxTagsToCheck }) => {
      try {
        const accessToken = await tokenProvider();
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        // Step 1: Get all tags in the project
        const tagsUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags?api-version=7.0`;
        const tagsResponse = await fetch(tagsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!tagsResponse.ok) {
          const errorText = await tagsResponse.text();
          return {
            content: [{ type: "text", text: `Error fetching tags: ${tagsResponse.status} ${tagsResponse.statusText} - ${errorText}` }],
            isError: true,
          };
        }

        const tagsData = await tagsResponse.json();
        const allProjectTags = tagsData.value?.map((tag: { name: string }) => tag.name) || [];

        // Step 2: WIQL query to fetch work items (limited by top parameter)
        const wiqlQuery = `SELECT [System.Id], [System.Title], [System.Tags], [System.ChangedDate] FROM WorkItems WHERE [System.TeamProject] = '${project}' ORDER BY [System.Id]`;

        const wiqlUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/wiql?$top=${top}&api-version=7.1-preview.2`;

        const wiqlResponse = await fetch(wiqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify({ query: wiqlQuery }),
        });

        if (!wiqlResponse.ok) {
          const errorText = await wiqlResponse.text();
          return {
            content: [{ type: "text", text: `WIQL API error: ${wiqlResponse.status} ${wiqlResponse.statusText} - ${errorText}` }],
            isError: true,
          };
        }

        const wiqlResult = await wiqlResponse.json();
        const workItemIds = wiqlResult.workItems.map((w: { id: number }) => w.id);

        // Step 3: Batch fetch work item details to get Tags and analyze usage
        const workItemBatchSize = 200;
        const tagCounts: Record<string, { count: number; lastUsed: string | null }> = {};

        for (let i = 0; i < workItemIds.length; i += workItemBatchSize) {
          const batchIds = workItemIds.slice(i, i + workItemBatchSize);
          const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "System.ChangedDate", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];

          const workitems = await workItemApi.getWorkItemsBatch({ ids: batchIds, fields: defaultFields }, project);

          for (const wi of workitems) {
            const tags: string[] = wi.fields && wi.fields["System.Tags"]
              ? wi.fields["System.Tags"].split(";").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
              : [];

            // Skip work items without tags
            if (tags.length === 0) continue;

            const changedDate = wi.fields?.["System.ChangedDate"];

            for (const t of tags) {
              if (!tagCounts[t]) tagCounts[t] = { count: 0, lastUsed: null };
              tagCounts[t].count += 1;
              
              // Track the most recent usage
              if (!tagCounts[t].lastUsed || (changedDate && tagCounts[t].lastUsed && new Date(changedDate) > new Date(tagCounts[t].lastUsed))) {
                tagCounts[t].lastUsed = changedDate;
              }
            }
          }
        }

        // Step 4: Identify used and unused tags
        const usedTagNames = Object.keys(tagCounts);
        const unusedTags = allProjectTags.filter((tag: string) => !usedTagNames.includes(tag));

        // Limit the number of unused tags we report based on maxTagsToCheck
        const reportedUnusedTags = unusedTags.slice(0, maxTagsToCheck);

        // Step 5: Format used tags results, sorted by usage count
        const usedTagsAnalytics = Object.entries(tagCounts)
          .map(([tag, info]) => ({
            tag,
            usageCount: info.count,
            lastUsed: info.lastUsed,
          }))
          .sort((a, b) => b.usageCount - a.usageCount);

        // Step 6: Create comprehensive result
        const result = {
          summary: {
            totalTagsInProject: allProjectTags.length,
            usedTagsCount: usedTagNames.length,
            unusedTagsCount: unusedTags.length,
            workItemsAnalyzed: workItemIds.length,
            maxWorkItemsRequested: top,
            unusedTagsReported: reportedUnusedTags.length,
            maxUnusedTagsToCheck: maxTagsToCheck
          },
          usedTags: usedTagsAnalytics,
          unusedTags: reportedUnusedTags,
          analysis: {
            mostUsedTag: usedTagsAnalytics.length > 0 ? usedTagsAnalytics[0] : null,
            leastUsedTag: usedTagsAnalytics.length > 0 ? usedTagsAnalytics[usedTagsAnalytics.length - 1] : null,
            tagUtilizationRate: allProjectTags.length > 0 ? ((usedTagNames.length / allProjectTags.length) * 100).toFixed(2) + '%' : '0%'
          }
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error in comprehensive tag analytics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.delete_workitem_tag_by_name,
    "Delete a tag from the project. Will only delete if the tag is unused (not attached to any work items).",
    {
      project: z.string().describe("Project name or ID"),
      tagName: z.string().describe("The name of the tag to delete"),
    },
    async ({ project, tagName }) => {
      try {
        const accessToken = await tokenProvider();

        // Step 1: Check if the tag exists and get its usage status
        const tagsUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags?api-version=7.0`;
        const tagsResponse = await fetch(tagsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!tagsResponse.ok) {
          const errorText = await tagsResponse.text();
          return {
            content: [{ type: "text", text: `Error fetching tags: ${tagsResponse.status} ${tagsResponse.statusText} - ${errorText}` }],
            isError: true,
          };
        }

        const tagsData = await tagsResponse.json();
        const allTags = tagsData.value || [];
        const tagExists = allTags.some((tag: { name: string }) => tag.name === tagName);

        if (!tagExists) {
          return {
            content: [{ type: "text", text: `Tag "${tagName}" does not exist in project "${project}".` }],
            isError: true,
          };
        }

        // Step 2: Check if the tag is in use
        const wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.Tags] CONTAINS '${tagName}'`;
        const wiqlUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/wiql?$top=1&api-version=7.1-preview.2`;
        
        const wiqlResponse = await fetch(wiqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify({ query: wiqlQuery }),
        });

        if (wiqlResponse.ok) {
          const wiqlData = await wiqlResponse.json();
          if (wiqlData.workItems && wiqlData.workItems.length > 0) {
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: "Tag is in use",
                  message: `Tag "${tagName}" is currently in use by ${wiqlData.workItems.length} or more work items.`,
                  tagName: tagName,
                  project: project,
                  workItemsFound: wiqlData.workItems.length
                }, null, 2)
              }],
              isError: true,
            };
          }
        }

        // Step 3: Delete the tag using the DELETE API
        const deleteTagUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags/${encodeURIComponent(tagName)}?api-version=7.0`;
        
        const deleteResponse = await fetch(deleteTagUrl, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          return {
            content: [{ type: "text", text: `Error deleting tag: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}` }],
            isError: true,
          };
        }

        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                success: true,
                message: `Tag "${tagName}" has been successfully deleted`,
                tagName: tagName,
                project: project,
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting tag: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.delete_unused_workitem_tags,
    "Delete multiple unused tags from the project. Gets unused tags and deletes them in batch for cleanup.",
    {
      project: z.string().describe("Project name or ID"),
      top: z.number().default(20).describe("Maximum number of unused tags to delete. Defaults to 20 for safety."),
      dryRun: z.boolean().default(true).describe("If true, only shows what would be deleted without actually deleting. Defaults to true for safety."),
    },
    async ({ project, top, dryRun }) => {
      try {
        const accessToken = await tokenProvider();

        // Step 1: Get all tags in the project
        const tagsUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags?api-version=7.0`;
        const tagsResponse = await fetch(tagsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!tagsResponse.ok) {
          const errorText = await tagsResponse.text();
          return {
            content: [{ type: "text", text: `Error fetching tags: ${tagsResponse.status} ${tagsResponse.statusText} - ${errorText}` }],
            isError: true,
          };
        }

        const tagsData = await tagsResponse.json();
        const allTags = tagsData.value || [];

        if (allTags.length === 0) {
          return {
            content: [{ type: "text", text: "No tags found in the project." }],
          };
        }

        // Step 2: Find unused tags by processing work items in batches
        const unusedTags: string[] = [];
        const usedTags: string[] = [];
        let tagsChecked = 0;
        let workItemsProcessed = 0;
        const workItemBatchSize = 100; // Process 100 work items at a time
        let skip = 0;
        const allTagNames = allTags.map((tag: { name: string }) => tag.name);
        const potentiallyUnusedTags = new Set<string>(allTagNames); // Start with all tags as potentially unused

        // Process work items in batches until we find enough unused tags
        while (unusedTags.length < top && potentiallyUnusedTags.size > 0) {
          // Get a batch of work items using WIQL with SKIP
          const wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' ORDER BY [System.Id]`;
          const wiqlUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/wiql?$top=${workItemBatchSize}&$skip=${skip}&api-version=7.1-preview.2`;
          
          try {
            const wiqlResponse = await fetch(wiqlUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken.token}`,
                "User-Agent": userAgentProvider(),
              },
              body: JSON.stringify({ query: wiqlQuery }),
            });

            if (!wiqlResponse.ok) {
              break; // Exit if we can't get work items
            }

            const wiqlResult = await wiqlResponse.json();
            const batchWorkItemIds = wiqlResult.workItems?.map((w: { id: number }) => w.id) || [];
            
            // If no more work items, break
            if (batchWorkItemIds.length === 0) {
              break;
            }

            // Get work item details for this batch (using Azure DevOps Node API)
            const connection = await connectionProvider();
            const workItemApi = await connection.getWorkItemTrackingApi();
            const workItems = await workItemApi.getWorkItemsBatch(
              { ids: batchWorkItemIds, fields: ["System.Tags"] }, 
              project
            );

            // Process tags from this batch of work items
            for (const workItem of workItems) {
              const tagsString = workItem.fields?.["System.Tags"] || "";
              if (tagsString) {
                const workItemTags = tagsString
                  .split(";")
                  .map((tag: string) => tag.trim())
                  .filter((tag: string) => tag.length > 0);
                
                // Remove these tags from potentially unused set
                for (const tag of workItemTags) {
                  if (potentiallyUnusedTags.has(tag)) {
                    potentiallyUnusedTags.delete(tag);
                    usedTags.push(tag);
                  }
                }
              }
              workItemsProcessed++;
            }

            // Update counters
            skip += workItemBatchSize;

            // Check if we have enough unused tags from remaining potentially unused tags
            const currentUnusedTags = Array.from(potentiallyUnusedTags);
            if (currentUnusedTags.length >= top) {
              // We have enough unused tags, take only what we need
              unusedTags.push(...currentUnusedTags.slice(0, top));
              break;
            } else {
              // Add all remaining unused tags and continue if we need more
              unusedTags.push(...currentUnusedTags);
              if (unusedTags.length >= top) {
                break;
              }
            }

          } catch (error) {
            console.warn("Error processing work item batch:", error);
            break;
          }
        }

        // If we still don't have enough unused tags and there are remaining potentially unused tags
        if (unusedTags.length < top && potentiallyUnusedTags.size > 0) {
          const remainingUnused = Array.from(potentiallyUnusedTags).slice(0, top - unusedTags.length);
          unusedTags.push(...remainingUnused);
        }

        tagsChecked = allTags.length;
        const tagsToDelete = unusedTags.slice(0, top); // Ensure we don't exceed the requested limit

        if (tagsToDelete.length === 0) {
          return {
            content: [
              { 
                type: "text", 
                text: JSON.stringify({
                  success: true,
                  message: "No unused tags found to delete.",
                  project: project,
                  tagsChecked: tagsChecked,
                  workItemsProcessed: workItemsProcessed,
                  unusedTagsFound: 0,
                  tagsToDelete: [],
                  dryRun: dryRun
                }, null, 2) 
              }
            ],
          };
        }

        // Step 3: Delete tags (or simulate if dry run)
        const deletionResults: { tag: string; success: boolean; error?: string }[] = [];

        if (dryRun) {
          // Dry run - just simulate the deletions
          for (const tagName of tagsToDelete) {
            deletionResults.push({ tag: tagName, success: true });
          }
        } else {
          // Actually delete the tags
          for (const tagName of tagsToDelete) {
            try {
              const deleteTagUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags/${encodeURIComponent(tagName)}?api-version=7.0`;
              
              const deleteResponse = await fetch(deleteTagUrl, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken.token}`,
                  "User-Agent": userAgentProvider(),
                },
              });

              if (deleteResponse.ok) {
                deletionResults.push({ tag: tagName, success: true });
              } else {
                const errorText = await deleteResponse.text();
                deletionResults.push({ 
                  tag: tagName, 
                  success: false, 
                  error: `${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}` 
                });
              }
            } catch (error) {
              deletionResults.push({ 
                tag: tagName, 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
              });
            }
          }
        }

        const successfulDeletions = deletionResults.filter(r => r.success);
        const failedDeletions = deletionResults.filter(r => !r.success);

        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                success: failedDeletions.length === 0,
                message: dryRun 
                  ? `Dry run completed. Found ${tagsToDelete.length} unused tags that would be deleted.`
                  : `Deletion completed. Successfully deleted ${successfulDeletions.length} out of ${tagsToDelete.length} unused tags.`,
                project: project,
                dryRun: dryRun,
                tagsChecked: tagsChecked,
                workItemsProcessed: workItemsProcessed,
                unusedTagsFound: unusedTags.length,
                tagsToDelete: tagsToDelete,
                results: {
                  successful: successfulDeletions.length,
                  failed: failedDeletions.length,
                  details: deletionResults
                },
                summary: dryRun 
                  ? `Would delete ${tagsToDelete.length} unused tags. Set dryRun=false to actually delete them.`
                  : `Deleted ${successfulDeletions.length} unused tags${failedDeletions.length > 0 ? `, ${failedDeletions.length} failed` : ''}.`
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting unused tags: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.update_workitem_tag,
    "Update a work item tag in the project",
    {
      project: z.string().describe("Project ID or project name"),
      tagIdOrName: z.string().describe("Tag ID or tag name to update"),
      name: z.string().describe("New name for the tag"),
    },
    async ({ project, tagIdOrName, name }) => {
      try {
        const accessToken = await tokenProvider();
        
        // First, get the current tag to retrieve its ID and other properties
        const getTagUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags/${encodeURIComponent(tagIdOrName)}?api-version=7.2-preview.1`;
        const getTagResponse = await fetch(getTagUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!getTagResponse.ok) {
          throw new Error(`Failed to get tag details: ${getTagResponse.status} ${getTagResponse.statusText}`);
        }

        const currentTag = await getTagResponse.json();

        // Prepare the update request body
        const updateBody = {
          id: currentTag.id,
          name: name,
          url: currentTag.url,
        };

        // Update the tag
        const updateUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags/${encodeURIComponent(tagIdOrName)}?api-version=7.2-preview.1`;
        const updateResponse = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify(updateBody),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update tag: ${updateResponse.status} ${updateResponse.statusText}. ${errorText}`);
        }

        const updatedTag = await updateResponse.json();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Tag '${tagIdOrName}' successfully updated to '${name}'`,
                updatedTag: updatedTag
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating tag: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.add_tags_to_workitem,
    "Add one or more tags to a specific work item. Existing tags on the work item will be preserved.",
    {
      project: z.string().describe("Project ID or project name"),
      workItemId: z.number().describe("Work item ID to add tags to"),
      tags: z.array(z.string()).describe("Array of tag names to add to the work item"),
      createTagsIfNotExist: z.boolean().default(true).describe("If true, creates tags in the project if they don't exist. Defaults to true."),
    },
    async ({ project, workItemId, tags, createTagsIfNotExist }) => {
      try {
        const accessToken = await tokenProvider();
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        if (tags.length === 0) {
          return {
            content: [{ type: "text", text: "No tags provided to add." }],
            isError: true,
          };
        }

        // Step 1: If createTagsIfNotExist is true, ensure all tags exist in the project
        if (createTagsIfNotExist) {
          const existingTagsUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags?api-version=7.0`;
          const existingTagsResponse = await fetch(existingTagsUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken.token}`,
              "User-Agent": userAgentProvider(),
            },
          });

          if (existingTagsResponse.ok) {
            const existingTagsData = await existingTagsResponse.json();
            const existingTagNames = existingTagsData.value?.map((tag: { name: string }) => tag.name) || [];
            
            // Create tags that don't exist
            for (const tagName of tags) {
              if (!existingTagNames.includes(tagName)) {
                const createTagUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/tags?api-version=7.0`;
                try {
                  await fetch(createTagUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${accessToken.token}`,
                      "User-Agent": userAgentProvider(),
                    },
                    body: JSON.stringify({ name: tagName }),
                  });
                } catch (error) {
                  console.warn(`Failed to create tag "${tagName}":`, error);
                }
              }
            }
          }
        }

        // Step 2: Get the current work item to retrieve existing tags
        const workItems = await workItemApi.getWorkItemsBatch({ ids: [workItemId], fields: ["System.Tags"] }, project);
        
        if (!workItems || workItems.length === 0) {
          return {
            content: [{ type: "text", text: `Work item ${workItemId} not found in project ${project}.` }],
            isError: true,
          };
        }

        const currentWorkItem = workItems[0];

        // Step 3: Parse existing tags
        const existingTagsString = currentWorkItem.fields?.["System.Tags"] || "";
        const existingTags = existingTagsString
          ? existingTagsString.split(";").map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
          : [];

        // Step 4: Determine new tags to add (avoid duplicates)
        const newTags = tags.filter(tag => !existingTags.includes(tag));
        
        if (newTags.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "All specified tags already exist on this work item.",
                  workItemId,
                  requestedTags: tags,
                  existingTags,
                  addedTags: [],
                }, null, 2),
              },
            ],
          };
        }

        // Step 5: Combine existing and new tags
        const allTags = [...existingTags, ...newTags];
        const combinedTagsString = allTags.join("; ");

        // Step 6: Update the work item with the combined tags
        const patchDocument = [
          {
            op: "add",
            path: "/fields/System.Tags",
            value: combinedTagsString,
          },
        ];

        await workItemApi.updateWorkItem(
          undefined,
          patchDocument,
          workItemId,
          project
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully added ${newTags.length} new tag(s) to work item ${workItemId}.`,
                workItemId,
                addedTags: newTags,
                existingTags,
                allTags,
                createTagsIfNotExist,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding tags to work item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.remove_tags_from_workitem,
    "Remove specific tags from a work item or clear all tags. Other existing tags will be preserved.",
    {
      project: z.string().describe("Project ID or project name"),
      workItemId: z.number().describe("Work item ID to remove tags from"),
      tagsToRemove: z.array(z.string()).optional().describe("Array of tag names to remove. If empty or not provided, all tags will be removed."),
      removeAllTags: z.boolean().default(false).describe("If true, removes all tags from the work item. Defaults to false."),
    },
    async ({ project, workItemId, tagsToRemove, removeAllTags }) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        // Step 1: Get the current work item to retrieve existing tags
        const workItems = await workItemApi.getWorkItemsBatch({ ids: [workItemId], fields: ["System.Tags"] }, project);
        
        if (!workItems || workItems.length === 0) {
          return {
            content: [{ type: "text", text: `Work item ${workItemId} not found in project ${project}.` }],
            isError: true,
          };
        }

        const currentWorkItem = workItems[0];

        // Step 2: Parse existing tags
        const existingTagsString = currentWorkItem.fields?.["System.Tags"] || "";
        const existingTags = existingTagsString
          ? existingTagsString.split(";").map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
          : [];

        if (existingTags.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Work item has no tags to remove.",
                  workItemId,
                  existingTags: [],
                  removedTags: [],
                  remainingTags: [],
                }, null, 2),
              },
            ],
          };
        }

        // Step 3: Determine which tags to remove
        let tagsToRemoveArray: string[] = [];
        let remainingTags: string[] = [];

        if (removeAllTags) {
          // Remove all tags
          tagsToRemoveArray = [...existingTags];
          remainingTags = [];
        } else if (tagsToRemove && tagsToRemove.length > 0) {
          // Remove specific tags
          tagsToRemoveArray = tagsToRemove.filter(tag => existingTags.includes(tag));
          remainingTags = existingTags.filter((tag: string) => !tagsToRemove.includes(tag));
        } else {
          // No tags specified to remove and removeAllTags is false
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: "No tags specified to remove. Use 'tagsToRemove' parameter to specify tags or set 'removeAllTags' to true to remove all tags.",
                  workItemId,
                  existingTags,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        if (tagsToRemoveArray.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "None of the specified tags were found on this work item.",
                  workItemId,
                  requestedTagsToRemove: tagsToRemove || [],
                  existingTags,
                  removedTags: [],
                  remainingTags: existingTags,
                }, null, 2),
              },
            ],
          };
        }

        // Step 4: Update the work item with remaining tags
        const newTagsString = remainingTags.length > 0 ? remainingTags.join("; ") : "";

        const patchDocument = [
          {
            op: remainingTags.length > 0 ? "add" : "remove",
            path: "/fields/System.Tags",
            value: remainingTags.length > 0 ? newTagsString : undefined,
          },
        ];

        await workItemApi.updateWorkItem(
          undefined,
          patchDocument,
          workItemId,
          project
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully removed ${tagsToRemoveArray.length} tag(s) from work item ${workItemId}.`,
                workItemId,
                removedTags: tagsToRemoveArray,
                remainingTags,
                existingTags,
                removeAllTags,
                totalTagsRemoved: tagsToRemoveArray.length,
                totalTagsRemaining: remainingTags.length,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing tags from work item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { TAG_TOOLS, configureTagTools };
