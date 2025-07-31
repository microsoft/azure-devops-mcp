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
};

function configureWikiTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching wiki: ${errorMessage}` }],
          isError: true,
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching wikis: ${errorMessage}` }],
          isError: true,
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
    async ({ wikiIdentifier, project, top = 20, continuationToken, pageViewsForDays }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        const pagesBatchRequest: WikiPagesBatchRequest = {
          top,
          continuationToken,
          pageViewsForDays,
        };

        const pages = await wikiApi.getPagesBatch(pagesBatchRequest, project, wikiIdentifier);

        if (!pages) {
          return { content: [{ type: "text", text: "No wiki pages found" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(pages, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching wiki pages: ${errorMessage}` }],
          isError: true,
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

        const stream = await wikiApi.getPageText(project, wikiIdentifier, path, undefined, undefined, true);

        if (!stream) {
          return { content: [{ type: "text", text: "No wiki page content found" }], isError: true };
        }

        const content = await streamToString(stream);

        return {
          content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error fetching wiki page content: ${errorMessage}` }],
          isError: true,
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

export { WIKI_TOOLS, configureWikiTools };
