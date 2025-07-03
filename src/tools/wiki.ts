// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { WikiPagesBatchRequest } from "azure-devops-node-api/interfaces/WikiInterfaces.js";

const WIKI_TOOLS = {
  list_wikis: "wiki_list_wikis",
  get_wiki: "wiki_get_wiki",
  list_wiki_pages: "wiki_list_pages",
  get_wiki_page_content: "wiki_get_page_content",
  get_wiki_page_content_by_url: "wiki_get_page_content_by_url",
};

function configureWikiTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  server.tool(
    WIKI_TOOLS.get_wiki,
    "Get the wiki by wikiIdentifier",
    {
      wikiIdentifier: z.string().describe("The unique identifier of the wiki."),
      project: z.string().optional().describe("The project name or ID where the wiki is located. If not provided, the default project will be used."),
    },
    async ({ wikiIdentifier, project }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();
        const wiki = await wikiApi.getWiki(wikiIdentifier, project);

        if (!wiki) {
          return { content: [{ type: "text", text: "No wiki found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(wiki, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching wiki: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.list_wikis,
    "Retrieve a list of wikis for an organization or project.",
    {
      project: z.string().optional().describe("The project name or ID to filter wikis. If not provided, all wikis in the organization will be returned."),
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();
        const wikis = await wikiApi.getAllWikis(project);

        if (!wikis) {
          return { content: [{ type: "text", text: "No wikis found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(wikis, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching wikis: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.list_wiki_pages,
    "Retrieve a list of wiki pages for a specific wiki and project.",
    {
      wikiIdentifier: z.string().describe("The unique identifier of the wiki."),
      project: z.string().describe("The project name or ID where the wiki is located."),
      top: z.number().default(20).describe("The maximum number of pages to return. Defaults to 20."),
      continuationToken: z.string().optional().describe("Token for pagination to retrieve the next set of pages."),
      pageViewsForDays: z.number().optional().describe("Number of days to retrieve page views for. If not specified, page views are not included."),
    },
    async ({
      wikiIdentifier,
      project,
      top = 20,
      continuationToken,
      pageViewsForDays,
    }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        const pagesBatchRequest: WikiPagesBatchRequest = {
          top,
          continuationToken,
          pageViewsForDays,
        };

        const pages = await wikiApi.getPagesBatch(
          pagesBatchRequest,
          project,
          wikiIdentifier
        );

        if (!pages) {
          return { content: [{ type: "text", text: "No wiki pages found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(pages, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching wiki pages: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.get_wiki_page_content,
    "Retrieve wiki page content by wikiIdentifier and path.",
    {
      wikiIdentifier: z.string().describe("The unique identifier of the wiki."),
      project: z.string().describe("The project name or ID where the wiki is located."),
      path: z.string().describe("The path of the wiki page to retrieve content for."),
    },
    async ({ wikiIdentifier, project, path }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        const stream = await wikiApi.getPageText(
          project,
          wikiIdentifier,
          path,
          undefined,
          undefined,
          true
        );

        if (!stream) {
          return { content: [{ type: "text", text: "No wiki page content found" }], isError: true };
        }

        const content = await streamToString(stream);

        return {
          content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching wiki page content: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.get_wiki_page_content_by_url,
    "Retrieve wiki page content by URL.",
    {
      url: z.string().describe("The full URL of the wiki page to retrieve content for."),
    },
    async ({ url }) => {
      try {
        const parsedUrl = parseWikiUrl(url);
        
        if (!parsedUrl) {
          return { 
            content: [{ type: "text", text: "Invalid wiki URL format. Expected format: https://{organization}.visualstudio.com/{project}/_wiki/wikis/{wikiName}/{wikiId}?pagePath={pagePath} (pagePath is optional, defaults to root page)" }], 
            isError: true 
          };
        }

        const { project, wikiIdentifier, path, pageId } = parsedUrl;
        
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        // If wikiIdentifier is a wiki name (not a GUID), resolve it to the actual wiki GUID
        let actualWikiId = wikiIdentifier;
        if (!isGuid(wikiIdentifier)) {
          // Get all wikis and find the one with matching name
          const wikis = await wikiApi.getAllWikis(project);
          const matchingWiki = wikis?.find(wiki => wiki.name === wikiIdentifier);
          if (!matchingWiki) {
            return { 
              content: [{ type: "text", text: `No wiki found with name '${wikiIdentifier}' in project '${project}'` }], 
              isError: true 
            };
          }
          actualWikiId = matchingWiki.id!;
        }

        let stream: NodeJS.ReadableStream;
        
        // Use page ID if available, otherwise use path
        if (pageId) {
          stream = await wikiApi.getPageByIdText(
            project,
            actualWikiId,
            pageId,
            undefined, // recursionLevel
            true       // includeContent
          );
        } else {
          stream = await wikiApi.getPageText(
            project,
            actualWikiId,
            path || '/',
            undefined,
            undefined,
            true
          );
        }

        if (!stream) {
          return { content: [{ type: "text", text: "No wiki page content found" }], isError: true };
        }

        const content = await streamToString(stream);

        return {
          content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return { 
          content: [{ type: "text", text: `Error fetching wiki page content by URL: ${errorMessage}` }], 
          isError: true
        };
      }
    }
  );
}

function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (data += chunk));
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

/**
 * Parses an Azure DevOps wiki URL to extract the required parameters.
 * Supports dev.azure.com, visualstudio.com, and on-premises URL formats.
 * The pagePath can be provided as a query parameter (?pagePath=/page) or directly in the URL path.
 * The pagePath parameter is optional - if not provided, defaults to root page.
 */
function parseWikiUrl(url: string): { project: string; wikiIdentifier: string; path?: string; pageId?: number } | null {
  try {
    const urlObj = new URL(url);
    
    // Handle dev.azure.com format: https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiName}/{wikiId}[/pagePath]?[pagePath=...]
    if (urlObj.hostname === 'dev.azure.com') {
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length >= 6 && pathSegments[2] === '_wiki' && pathSegments[3] === 'wikis') {
        const project = pathSegments[1];
        const wikiIdentifier = pathSegments[5]; // This is the wikiId
        
        // Check for page path in query parameter first, then in URL path
        let pagePath = urlObj.searchParams.get('pagePath');
        if (!pagePath && pathSegments.length > 6) {
          // Page path is in the URL after the wikiId
          pagePath = '/' + pathSegments.slice(6).join('/');
        }
        
        return {
          project,
          wikiIdentifier,
          path: normalizePath(pagePath)
        };
      }
    }
    
    // Handle visualstudio.com format: https://{org}.visualstudio.com/{project}/_wiki/wikis/{wikiName}/{pageId}[/pagePath]?[pagePath=...]
    else if (urlObj.hostname.endsWith('.visualstudio.com')) {
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length >= 4 && pathSegments[1] === '_wiki' && pathSegments[2] === 'wikis') {
        const project = pathSegments[0];
        const wikiName = pathSegments[3]; // This is the wiki name
        
        // Check for page path in query parameter first, then in URL path
        let pagePath = urlObj.searchParams.get('pagePath');
        let pageId: number | undefined;
        
        if (!pagePath && pathSegments.length > 4) {
          // Check if the next segment is a page ID (numeric) or part of the path
          const nextSegment = pathSegments[4];
          if (/^\d+$/.test(nextSegment)) {
            // It's a page ID
            pageId = parseInt(nextSegment, 10);
            if (pathSegments.length > 5) {
              pagePath = '/' + pathSegments.slice(5).join('/');
            }
          } else {
            // It's part of the path
            pagePath = '/' + pathSegments.slice(4).join('/');
          }
        }
        
        return {
          project,
          wikiIdentifier: wikiName, // Use wiki name, will need to resolve to GUID later
          path: pagePath ? normalizePath(pagePath) : undefined,
          pageId
        };
      }
    }
    
    // Handle on-premises format: https://{server}/{collection}/{project}/_wiki/wikis/{wikiName}/{wikiId}[/pagePath]?[pagePath=...]
    // Or: https://{server}/{project}/_wiki/wikis/{wikiName}/{wikiId}[/pagePath]?[pagePath=...] (default collection)
    else {
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // Look for the _wiki pattern in the path
      const wikiIndex = pathSegments.findIndex(segment => segment === '_wiki');
      if (wikiIndex >= 0 && wikiIndex + 4 < pathSegments.length && pathSegments[wikiIndex + 1] === 'wikis') {
        // Project is the segment before _wiki
        const project = pathSegments[wikiIndex - 1];
        const wikiIdentifier = pathSegments[wikiIndex + 3]; // This is the wikiId
        
        if (!project) {
          return null; // Unable to determine project name
        }
        
        // Check for page path in query parameter first, then in URL path
        let pagePath = urlObj.searchParams.get('pagePath');
        if (!pagePath && pathSegments.length > wikiIndex + 4) {
          // Page path is in the URL after the wikiId
          pagePath = '/' + pathSegments.slice(wikiIndex + 4).join('/');
        }
        
        return {
          project,
          wikiIdentifier,
          path: normalizePath(pagePath)
        };
      }
    }
    
    return null; // Unable to parse URL
  } catch (error) {
    return null; // Invalid URL format
  }
}

/**
 * Normalizes the page path from a wiki URL.
 * If no path is provided, returns '/' for the root page.
 * Removes leading slash if present for API compatibility.
 */
function normalizePath(pagePath: string | null): string {
  if (!pagePath || pagePath === '/') {
    return '/'; // Root page
  }
  
  // Remove leading slash for API compatibility (except for root)
  return pagePath.startsWith('/') ? pagePath.substring(1) : pagePath;
}

/**
 * Checks if a string is a valid GUID format.
 */
function isGuid(str: string): boolean {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(str);
}

export { WIKI_TOOLS, configureWikiTools };
