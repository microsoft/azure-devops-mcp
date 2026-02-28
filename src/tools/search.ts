// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { IGitApi } from "azure-devops-node-api/GitApi.js";
import { z } from "zod";
import { apiVersion } from "../utils.js";
import { VersionControlRecursionType, GitItem } from "azure-devops-node-api/interfaces/GitInterfaces.js";

const SEARCH_TOOLS = {
  search_code: "search_code",
  search_wiki: "search_wiki",
  search_workitem: "search_workitem",
};

function configureSearchTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string, orgName: string) {
  server.tool(
    SEARCH_TOOLS.search_code,
    "Search Azure DevOps Repositories for a given search text",
    {
      searchText: z.string().describe("Keywords to search for in code repositories"),
      project: z.array(z.string()).optional().describe("Filter by projects"),
      repository: z.array(z.string()).optional().describe("Filter by repositories"),
      path: z.array(z.string()).optional().describe("Filter by paths"),
      branch: z.array(z.string()).optional().describe("Filter by branches"),
      includeFacets: z.boolean().default(false).describe("Include facets in the search results"),
      skip: z.number().default(0).describe("Number of results to skip"),
      top: z.number().default(5).describe("Maximum number of results to return"),
    },
    async ({ searchText, project, repository, path, branch, includeFacets, skip, top }) => {
      const accessToken = await tokenProvider();
      const connection = await connectionProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/codesearchresults?api-version=${apiVersion}`;

      const requestBody: Record<string, unknown> = {
        searchText,
        includeFacets,
        $skip: skip,
        $top: top,
      };

      const filters: Record<string, string[]> = {};
      if (project && project.length > 0) filters.Project = project;
      if (repository && repository.length > 0) filters.Repository = repository;
      if (path && path.length > 0) filters.Path = path;
      if (branch && branch.length > 0) filters.Branch = branch;

      if (Object.keys(filters).length > 0) {
        requestBody.filters = filters;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps Code Search API error: ${response.status} ${response.statusText}`);
      }

      const resultText = await response.text();
      const resultJson = JSON.parse(resultText) as { results?: SearchResult[] };

      const gitApi = await connection.getGitApi();
      const combinedResults = await fetchCombinedResults(resultJson.results ?? [], gitApi);

      return {
        content: [{ type: "text", text: resultText + JSON.stringify(combinedResults) }],
      };
    }
  );

  server.tool(
    SEARCH_TOOLS.search_wiki,
    "Search Azure DevOps Wiki for a given search text",
    {
      searchText: z.string().describe("Keywords to search for wiki pages"),
      project: z.array(z.string()).optional().describe("Filter by projects"),
      wiki: z.array(z.string()).optional().describe("Filter by wiki names"),
      includeFacets: z.boolean().default(false).describe("Include facets in the search results"),
      skip: z.number().default(0).describe("Number of results to skip"),
      top: z.number().default(10).describe("Maximum number of results to return"),
    },
    async ({ searchText, project, wiki, includeFacets, skip, top }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/wikisearchresults?api-version=${apiVersion}`;

      const requestBody: Record<string, unknown> = {
        searchText,
        includeFacets,
        $skip: skip,
        $top: top,
      };

      const filters: Record<string, string[]> = {};
      if (project && project.length > 0) filters.Project = project;
      if (wiki && wiki.length > 0) filters.Wiki = wiki;

      if (Object.keys(filters).length > 0) {
        requestBody.filters = filters;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(requestBody),
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

  server.tool(
    SEARCH_TOOLS.search_workitem,
    "Get Azure DevOps Work Item search results for a given search text",
    {
      searchText: z.string().describe("Search text to find in work items"),
      project: z.array(z.string()).optional().describe("Filter by projects"),
      areaPath: z.array(z.string()).optional().describe("Filter by area paths"),
      workItemType: z.array(z.string()).optional().describe("Filter by work item types"),
      state: z.array(z.string()).optional().describe("Filter by work item states"),
      assignedTo: z.array(z.string()).optional().describe("Filter by assigned to users"),
      includeFacets: z.boolean().default(false).describe("Include facets in the search results"),
      skip: z.number().default(0).describe("Number of results to skip for pagination"),
      top: z.number().default(10).describe("Number of results to return"),
    },
    async ({ searchText, project, areaPath, workItemType, state, assignedTo, includeFacets, skip, top }) => {
      const accessToken = await tokenProvider();
      const url = `https://almsearch.dev.azure.com/${orgName}/_apis/search/workitemsearchresults?api-version=${apiVersion}`;

      const requestBody: Record<string, unknown> = {
        searchText,
        includeFacets,
        $skip: skip,
        $top: top,
      };

      const filters: Record<string, unknown> = {};
      if (project && project.length > 0) filters["System.TeamProject"] = project;
      if (areaPath && areaPath.length > 0) filters["System.AreaPath"] = areaPath;
      if (workItemType && workItemType.length > 0) filters["System.WorkItemType"] = workItemType;
      if (state && state.length > 0) filters["System.State"] = state;
      if (assignedTo && assignedTo.length > 0) filters["System.AssignedTo"] = assignedTo;

      if (Object.keys(filters).length > 0) {
        requestBody.filters = filters;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(requestBody),
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
