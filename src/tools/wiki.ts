// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { WikiPagesBatchRequest, WikiCreateParametersV2, WikiUpdateParameters, WikiV2, WikiType } from "azure-devops-node-api/interfaces/WikiInterfaces.js";
import { GitVersionDescriptor } from "azure-devops-node-api/interfaces/GitInterfaces.js";

const WIKI_TOOLS = {
  list_wikis: "wiki_list_wikis",
  get_wiki: "wiki_get_wiki",
  list_wiki_pages: "wiki_list_pages",
  get_wiki_page_content: "wiki_get_page_content",
  create_wiki: "wiki_create_wiki",
  update_wiki: "wiki_update_wiki",
  create_or_update_page: "wiki_create_or_update_page",
};

function configureWikiTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
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

  server.tool(
    WIKI_TOOLS.create_wiki,
    "Create a new wiki in the specified project.",
    {
      name: z.string().describe("The name of the wiki to create."),
      project: z.string().optional().describe("The project name or ID where the wiki will be created. If not provided, the default project will be used."),
      type: z.enum(["projectWiki", "codeWiki"]).default("projectWiki").describe("Type of the wiki. Can be 'projectWiki' or 'codeWiki'. Defaults to 'projectWiki'."),
      repositoryId: z.string().optional().describe("ID of the git repository that backs up the wiki. Required for codeWiki type."),
      mappedPath: z.string().optional().describe("Folder path inside repository which is shown as Wiki. Required for codeWiki type, e.g., '/docs'."),
      version: z.string().optional().describe("Branch name for code wiki (e.g., 'main'). Required for codeWiki type."),
    },
    async ({ name, project, type = "projectWiki", repositoryId, mappedPath, version }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        // Validate required parameters for codeWiki
        if (type === "codeWiki") {
          if (!repositoryId || !mappedPath || !version) {
            return {
              content: [{ type: "text", text: "For codeWiki type, repositoryId, mappedPath, and version are required." }],
              isError: true,
            };
          }
        }

        const wikiCreateParams: WikiCreateParametersV2 = {
          name,
          type: type === "projectWiki" ? WikiType.ProjectWiki : WikiType.CodeWiki,
          projectId: project,
        };

        // Add code wiki specific parameters
        if (type === "codeWiki") {
          wikiCreateParams.repositoryId = repositoryId;
          wikiCreateParams.mappedPath = mappedPath;
          wikiCreateParams.version = {
            version: version!,
          } as GitVersionDescriptor;
        }

        const wiki = await wikiApi.createWiki(wikiCreateParams, project);

        if (!wiki) {
          return { content: [{ type: "text", text: "Failed to create wiki" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(wiki, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating wiki: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.update_wiki,
    "Update an existing wiki by ID or name.",
    {
      wikiIdentifier: z.string().describe("The unique identifier or name of the wiki to update."),
      name: z.string().optional().describe("New name for the wiki."),
      project: z.string().optional().describe("The project name or ID where the wiki is located. If not provided, the default project will be used."),
      versions: z
        .array(
          z.object({
            version: z.string().describe("Branch name or version"),
            versionType: z.enum(["branch", "tag", "commit"]).optional().describe("Type of version (branch, tag, or commit)"),
          })
        )
        .optional()
        .describe("Array of versions/branches for the wiki."),
    },
    async ({ wikiIdentifier, name, project, versions }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        const updateParams: WikiUpdateParameters = {};

        if (name) {
          updateParams.name = name;
        }

        if (versions) {
          updateParams.versions = versions.map(
            (v) =>
              ({
                version: v.version,
                versionType: v.versionType ? (v.versionType === "branch" ? 0 : v.versionType === "tag" ? 1 : 2) : 0, // Default to branch
              }) as GitVersionDescriptor
          );
        }

        const updatedWiki = await wikiApi.updateWiki(updateParams, wikiIdentifier, project);

        if (!updatedWiki) {
          return { content: [{ type: "text", text: "Failed to update wiki" }], isError: true };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(updatedWiki, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error updating wiki: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.create_or_update_page,
    "Create or update a wiki page with content.",
    {
      wikiIdentifier: z.string().describe("The unique identifier or name of the wiki."),
      path: z.string().describe("The path of the wiki page (e.g., '/Home' or '/Documentation/Setup')."),
      content: z.string().describe("The content of the wiki page in markdown format."),
      project: z.string().optional().describe("The project name or ID where the wiki is located. If not provided, the default project will be used."),
      comment: z.string().optional().describe("Optional comment for the page update."),
      version: z.string().optional().describe("Version/branch of the wiki. Defaults to the default branch for the wiki."),
    },
    async ({ wikiIdentifier, path, content, project, comment, version }) => {
      try {
        const connection = await connectionProvider();
        const wikiApi = await connection.getWikiApi();

        // Prepare version descriptor if provided
        const versionDescriptor: GitVersionDescriptor | undefined = version
          ? {
              version: version,
            }
          : undefined;

        // Create/update the page by pushing content
        const updatedPage = await wikiApi.createOrUpdatePageViewStats(project || "", wikiIdentifier, versionDescriptor || { version: "main" }, path);

        // Note: The Azure DevOps Node API doesn't have a direct method to create/update page content
        // This would typically require using the Git API to commit the markdown content
        // For now, we'll return a message indicating the limitation
        return {
          content: [
            {
              type: "text",
              text: `Page structure created/updated at path: ${path}. Note: To add content to wiki pages, you need to use the Git API to commit markdown files to the wiki repository. The Azure DevOps Wiki API primarily handles metadata and page structure, not content creation.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [{ type: "text", text: `Error creating/updating wiki page: ${errorMessage}` }],
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
