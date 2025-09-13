// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { orgName } from "../index.js";

const TAG_TOOLS = {
  search_workitem_by_tags: "search_workitem_by_tags",
  tags_usage_analytics: "tags_usage_analytics",
  repo_list_tags: "repo_list_tags",
  list_unused_tags: "list_unused_tags",
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
    TAG_TOOLS.repo_list_tags,
    "List all tags for a repository.",
    {
      project: z.string().describe("Project name or ID"),
    },
    async ({ project }) => {
      try {
        const accessToken = await tokenProvider();
        const url = `https://dev.azure.com/dynamicscrm/${project}/_apis/wit/tags/`;
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
    TAG_TOOLS.tags_usage_analytics,
    "Show tag usage statistics and trends",
    { 
      project: z.string().describe("Project name or ID"),
      top: z.number().default(1000).describe("The maximum number of work items to analyze for tag usage. Defaults to 1000.")
    },
    async ({ project, top }) => {
      try {
        const accessToken = await tokenProvider();
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        // Step 1: WIQL query to fetch work items (limited by top parameter)
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

        console.log(`Found ${workItemIds.length} work items to analyze for tag usage.`);

        // Step 2: Batch fetch work item details to get Tags
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

        // Step 3: Format results, sorted by usage count
        const result = Object.entries(tagCounts)
          .map(([tag, info]) => ({
            tag,
            usageCount: info.count,
            lastUsed: info.lastUsed,
          }))
          .sort((a, b) => b.usageCount - a.usageCount);

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
              text: `Error in tag usage analytics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    TAG_TOOLS.list_unused_tags,
    "List all unused tags in a project (tags not attached to any work items).",
    {
      project: z.string().describe("Project name or ID"),
      top: z.number().default(100).describe("The maximum number of tags to check for usage. Defaults to 100."),
    },
    async ({ project, top }) => {
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

        // Limit the number of tags to check based on the top parameter
        const tagsToCheck = allTags.slice(0, top);

        // Step 2: Get ALL tags that are actually used in work items with a single query
        // We'll use a large result set to get comprehensive coverage of used tags
        const wiqlQuery = `SELECT [System.Id], [System.Tags] FROM WorkItems WHERE [System.TeamProject] = '${project}'`;
        
        const wiqlUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/wiql?$top=19000&api-version=7.1-preview.2`;
        
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

        const wiqlData = await wiqlResponse.json();
        const workItemIds = wiqlData.workItems?.map((w: { id: number }) => w.id) || [];

        // Step 3: Extract all used tags from work items
        const usedTags = new Set<string>();
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        
        // Process work items in batches to get their tags
        const batchSize = 200;
        for (let i = 0; i < workItemIds.length; i += batchSize) {
          const batchIds = workItemIds.slice(i, i + batchSize);
          const workItems = await workItemApi.getWorkItemsBatch({ ids: batchIds, fields: ["System.Tags"] }, project);
          
          for (const wi of workItems) {
            const tagsString = wi.fields && wi.fields["System.Tags"] ? wi.fields["System.Tags"] : "";
            if (tagsString) {
              const tags: string[] = tagsString.split(";").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
              
              // Add each tag to the used set - once a tag is encountered, it's marked as used
              tags.forEach((tag: string) => usedTags.add(tag));
            }
          }
        }

        // Step 4: Find unused tags by checking which project tags are NOT in the used tags set
        const unusedTags = tagsToCheck
          .map((tag: { name: string }) => tag.name)
          .filter((tagName: string) => !usedTags.has(tagName));

        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                totalTagsInProject: allTags.length,
                tagsChecked: tagsToCheck.length,
                workItemsAnalyzed: workItemIds.length,
                totalUsedTags: usedTags.size,
                unusedTags: unusedTags,
                unusedCount: unusedTags.length
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error finding unused tags: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

}

export { TAG_TOOLS, configureTagTools };
