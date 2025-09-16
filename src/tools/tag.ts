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

        // Step 2: Find unused tags (limited by top parameter)
        const tagsToCheck = allTags.slice(0, Math.min(top * 2, allTags.length)); // Check more than we need to delete
        const unusedTags: string[] = [];
        const usedTags: string[] = [];
        const errorTags: string[] = [];

        for (const tag of tagsToCheck) {
          // Use a simple count query to check if any work items have this tag
          const wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.Tags] CONTAINS '${tag.name}'`;
          const wiqlUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/wiql?$top=1&api-version=7.1-preview.2`;
          
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

            if (wiqlResponse.ok) {
              const wiqlData = await wiqlResponse.json();
              if (!wiqlData.workItems || wiqlData.workItems.length === 0) {
                unusedTags.push(tag.name);
              } else {
                usedTags.push(tag.name);
              }
            } else {
              errorTags.push(tag.name);
            }
          } catch {
            errorTags.push(tag.name);
          }

          // Stop if we have enough unused tags to delete
          if (unusedTags.length >= top) {
            break;
          }
        }

        // Limit to the requested number of deletions
        const tagsToDelete = unusedTags.slice(0, top);

        if (tagsToDelete.length === 0) {
          return {
            content: [
              { 
                type: "text", 
                text: JSON.stringify({
                  success: true,
                  message: "No unused tags found to delete.",
                  project: project,
                  tagsChecked: tagsToCheck.length,
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
                tagsChecked: tagsToCheck.length,
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
}

export { TAG_TOOLS, configureTagTools };
