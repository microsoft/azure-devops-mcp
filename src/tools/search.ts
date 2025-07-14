// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi.js";
import { z } from "zod";
import { apiVersion } from "../utils.js";
import { orgName } from "../index.js";
import { VersionControlRecursionType } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { GitItem } from "azure-devops-node-api/interfaces/GitInterfaces.js";

const SEARCH_TOOLS = {
  search_code: "search_code",
  search_wiki: "search_wiki",
  search_workitem: "search_workitem",
};

function configureSearchTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  /*
    CODE SEARCH
    Get the code search results for a given search text.
  */
  server.tool(
    SEARCH_TOOLS.search_code,
    "Get the code search results for a given search text.",
    {
      searchRequest: z
        .object({
          searchText: z.string().describe("Search text to find in code"),
          $skip: z.number().default(0).describe("Number of results to skip (for pagination)"),
          $top: z.number().default(5).describe("Number of results to return (for pagination)"),
          filters: z
            .object({
              Project: z.array(z.string()).optional().describe("Filter in these projects"),
              Repository: z.array(z.string()).optional().describe("Filter in these repositories"),
              Path: z.array(z.string()).optional().describe("Filter in these paths"),
              Branch: z.array(z.string()).optional().describe("Filter in these branches"),
              CodeElement: z.array(z.string()).optional().describe("Filter for these code elements (e.g., classes, functions, symbols)"),
              // Note: CodeElement is optional and can be used to filter results by specific code elements.
              // It can be a string or an array of strings.
              // If provided, the search will only return results that match the specified code elements.
              // This is useful for narrowing down the search to specific classes, functions, definitions, or symbols.
              // Example: CodeElement: ["MyClass", "MyFunction"]
            })
            .partial()
            .optional(),
          includeFacets: z.boolean().optional(),
        })
        .strict(),
    },
    async ({ searchRequest }) => {
      const accessToken = await tokenProvider();
      const connection = await connectionProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/codesearchresults?api-version=${apiVersion}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Code Search API error: ${response.status} ${response.statusText}`);
      }

      const resultText = await response.text();
      const resultJson = JSON.parse(resultText) as { results?: SearchResult[] };

      const topResults: SearchResult[] = Array.isArray(resultJson.results) ? resultJson.results.slice(0, Math.min(searchRequest.$top, resultJson.results.length)) : [];

      const gitApi = await connection.getGitApi();
      const combinedResults = await fetchCombinedResults(topResults, gitApi);

      return {
        content: [{ type: "text", text: resultText + JSON.stringify(combinedResults) }],
      };
    }
  );

  /*
  WIKI SEARCH
  Get wiki search results for a given search text.
*/
  server.tool(
    SEARCH_TOOLS.search_wiki,
    "Get wiki search results for a given search text.",
    {
      searchRequest: z
        .object({
          searchText: z.string().describe("Search text to find in wikis"),
          $skip: z.number().default(0).describe("Number of results to skip (for pagination)"),
          $top: z.number().default(10).describe("Number of results to return (for pagination)"),
          filters: z
            .object({
              Project: z.array(z.string()).optional().describe("Filter in these projects"),
              Wiki: z.array(z.string()).optional().describe("Filter in these wiki names"),
            })
            .partial()
            .optional()
            .describe("Filters to apply to the search text"),
          includeFacets: z.boolean().optional(),
        })
        .strict(),
    },
    async ({ searchRequest }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/wikisearchresults?api-version=${apiVersion}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Wiki Search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      return {
        content: [{ type: "text", text: result }],
      };
    }
  );

  /*
  WORK ITEM SEARCH
  Get work item search results for a given search text.
*/
  server.tool(
    SEARCH_TOOLS.search_workitem,
    "Get work item search results for a given search text.",
    {
      searchRequest: z
        .object({
          searchText: z.string().describe("Search text to find in work items"),
          $skip: z.number().default(0).describe("Number of results to skip for pagination"),
          $top: z.number().default(10).describe("Number of results to return"),
          filters: z
            .object({
              "System.TeamProject": z.array(z.string()).optional().describe("Filter by team project"),
              "System.AreaPath": z.array(z.string()).optional().describe("Filter by area path"),
              "System.WorkItemType": z.array(z.string()).optional().describe("Filter by work item type like Bug, Task, User Story"),
              "System.State": z.array(z.string()).optional().describe("Filter by state"),
              "System.AssignedTo": z.array(z.string()).optional().describe("Filter by assigned to"),
            })
            .partial()
            .optional(),
          includeFacets: z.boolean().optional(),
        })
        .strict(),
    },
    async ({ searchRequest }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/workitemsearchresults?api-version=${apiVersion}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Work Item Search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      return {
        content: [{ type: "text", text: result }],
      };
    }
  );
}

/*
  Fetch git repo file content for top 5(default) search results.
*/

interface SearchResult {
  project?: { id?: string };
  repository?: { id?: string };
  path?: string;
  versions?: { changeId?: string }[];
  [key: string]: unknown;
}

type CombinedResult = { gitItem: GitItem } | { error: string };

async function fetchCombinedResults(topSearchResults: SearchResult[], gitApi: IGitApi): Promise<CombinedResult[]> {
  const combinedResults: CombinedResult[] = [];
  for (const searchResult of topSearchResults) {
    try {
      const projectId = searchResult.project?.id;
      const repositoryId = searchResult.repository?.id;
      const filePath = searchResult.path;
      const changeId = Array.isArray(searchResult.versions) && searchResult.versions.length > 0 ? searchResult.versions[0].changeId : undefined;
      if (!projectId || !repositoryId || !filePath || !changeId) {
        combinedResults.push({
          error: `Missing projectId, repositoryId, filePath, or changeId in the result: ${JSON.stringify(searchResult)}`,
        });
        continue;
      }

      const versionDescriptor = changeId ? { version: changeId, versionType: 2, versionOptions: 0 } : undefined;

      const item = await gitApi.getItem(
        repositoryId,
        filePath,
        projectId,
        undefined,
        VersionControlRecursionType.None,
        true, // includeContentMetadata
        false, // latestProcessedChange
        false, // download
        versionDescriptor,
        true, // includeContent
        true, // resolveLfs
        true // sanitize
      );
      combinedResults.push({
        gitItem: item,
      });
    } catch (err) {
      combinedResults.push({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return combinedResults;
}

export { SEARCH_TOOLS, configureSearchTools };
