// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { WikiPagesBatchRequest } from "azure-devops-node-api/interfaces/WikiInterfaces.js";
import { apiVersion, extractAdoStreamError, getOrgFromUrl } from "../utils.js";
import { createExternalContentResponse } from "../shared/content-safety.js";

const WIKI_TOOLS = {
  wiki: "wiki",
  wiki_upsert_page: "wiki_upsert_page",
};

function configureWikiTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    WIKI_TOOLS.wiki,
    "Retrieve wiki data for an organization or project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list_wikis", "get_wiki", "list_pages", "get_page", "get_page_content"])
        .describe(
          "The action to perform. Options: list_wikis (list all wikis in an organization or project), get_wiki (get details of a specific wiki), list_pages (list pages in a wiki), get_page (get wiki page metadata without content), get_page_content (retrieve wiki page content)."
        ),
      wikiIdentifier: z.string().optional().describe("The unique identifier of the wiki. Required for get_wiki, list_pages, get_page, and get_page_content (unless url is provided)."),
      project: z.string().optional().describe("The project name or ID. Required for list_pages and get_page. Optional for list_wikis, get_wiki, and get_page_content."),
      path: z.string().optional().describe("The path of the wiki page (e.g., '/Home' or '/Documentation/Setup'). Required for get_page. Optional for get_page_content."),
      url: z
        .string()
        .optional()
        .describe(
          "The full URL of the wiki page. Used for get_page_content. If provided, wikiIdentifier, project, and path are ignored. Supported patterns: https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiIdentifier}?pagePath=%2FMy%20Page and https://dev.azure.com/{org}/{project}/_wiki/wikis/{wikiIdentifier}/{pageId}/Page-Title"
        ),
      top: z.coerce.number().default(20).describe("The maximum number of pages to return. Used for list_pages. Defaults to 20."),
      continuationToken: z.string().optional().describe("Token for pagination to retrieve the next set of pages. Used for list_pages."),
      pageViewsForDays: z.coerce.number().optional().describe("Number of days to retrieve page views for. Used for list_pages. If not specified, page views are not included."),
      recursionLevel: z
        .enum(["None", "OneLevel", "OneLevelPlusNestedEmptyFolders", "Full"])
        .optional()
        .describe("Recursion level for subpages. Used for get_page. 'None' returns only the specified page. 'OneLevel' includes direct children. 'Full' includes all descendants."),
    },
    async ({ action, wikiIdentifier, project, path, url, top = 20, continuationToken, pageViewsForDays, recursionLevel }) => {
      try {
        const connection = await connectionProvider();

        if (action === "list_wikis") {
          const wikiApi = await connection.getWikiApi();
          const wikis = await wikiApi.getAllWikis(project);

          if (!wikis) {
            return { content: [{ type: "text", text: "No wikis found" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(wikis, null, 2) }],
          };
        }

        if (action === "get_wiki") {
          if (!wikiIdentifier) {
            return { content: [{ type: "text", text: "wikiIdentifier is required for get_wiki" }], isError: true };
          }

          const wikiApi = await connection.getWikiApi();
          const wiki = await wikiApi.getWiki(wikiIdentifier, project);

          if (!wiki) {
            return { content: [{ type: "text", text: "No wiki found" }], isError: true };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(wiki, null, 2) }],
          };
        }

        if (action === "list_pages") {
          if (!wikiIdentifier) {
            return { content: [{ type: "text", text: "wikiIdentifier is required for list_pages" }], isError: true };
          }
          if (!project) {
            return { content: [{ type: "text", text: "project is required for list_pages" }], isError: true };
          }

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
        }

        if (action === "get_page") {
          if (!wikiIdentifier) {
            return { content: [{ type: "text", text: "wikiIdentifier is required for get_page" }], isError: true };
          }
          if (!project) {
            return { content: [{ type: "text", text: "project is required for get_page" }], isError: true };
          }
          if (!path) {
            return { content: [{ type: "text", text: "path is required for get_page" }], isError: true };
          }

          const accessToken = await tokenProvider();

          // Normalize the path
          const normalizedPath = path.startsWith("/") ? path : `/${path}`;

          // Build the URL for the wiki page API
          const baseUrl = connection.serverUrl.replace(/\/$/, "");
          const params = new URLSearchParams({
            "path": normalizedPath,
            "api-version": apiVersion,
          });

          if (recursionLevel) {
            params.append("recursionLevel", recursionLevel);
          }

          const fetchUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?${params.toString()}`;

          const response = await fetch(fetchUrl, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "User-Agent": userAgentProvider(),
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get wiki page (${response.status}): ${errorText}`);
          }

          const pageData = await response.json();

          return {
            content: [{ type: "text", text: JSON.stringify(pageData, null, 2) }],
          };
        }

        if (action === "get_page_content") {
          const hasUrl = !!url;
          const hasPair = !!wikiIdentifier && !!project;

          if (hasUrl && hasPair) {
            return { content: [{ type: "text", text: "Error fetching wiki page content: Provide either 'url' OR 'wikiIdentifier' with 'project', not both." }], isError: true };
          }
          if (!hasUrl && !hasPair) {
            return { content: [{ type: "text", text: "Error fetching wiki page content: You must provide either 'url' OR both 'wikiIdentifier' and 'project'." }], isError: true };
          }

          const wikiApi = await connection.getWikiApi();
          let resolvedProject = project;
          let resolvedWiki = wikiIdentifier;
          let resolvedPath: string | undefined = path;
          let pageContent: string | undefined;

          if (url) {
            const parsed = parseWikiUrl(url);

            if ("error" in parsed) {
              return { content: [{ type: "text", text: `Error fetching wiki page content: ${parsed.error}` }], isError: true };
            }

            // Guard against cross-organization requests: a user-supplied URL must target the
            // same organization the server is connected to. Otherwise the org segment in the
            // URL would be silently ignored and content fetched from the configured org instead.
            const configuredOrg = getOrgFromUrl(connection.serverUrl);
            const urlOrg = getOrgFromUrl(url);
            if (configuredOrg && urlOrg !== configuredOrg) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Error fetching wiki page content: The provided URL targets organization '${urlOrg ?? "unknown"}', which does not match the configured organization '${configuredOrg}'. Cross-organization requests are not allowed.`,
                  },
                ],
                isError: true,
              };
            }

            resolvedProject = parsed.project;
            resolvedWiki = parsed.wikiIdentifier;

            if (parsed.pagePath) {
              resolvedPath = parsed.pagePath;
            }

            if (parsed.pageId) {
              try {
                const accessToken = await tokenProvider();
                const baseUrl = connection.serverUrl.replace(/\/$/, "");
                const restUrl = `${baseUrl}/${encodeURIComponent(resolvedProject)}/_apis/wiki/wikis/${encodeURIComponent(resolvedWiki)}/pages/${parsed.pageId}?includeContent=true&api-version=7.1`;
                const resp = await fetch(restUrl, {
                  headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "User-Agent": userAgentProvider(),
                  },
                });
                if (resp.ok) {
                  const json = await resp.json();
                  if (json && typeof json.content === "string") {
                    pageContent = json.content;
                  } else if (json && json.path) {
                    resolvedPath = json.path;
                  }
                } else if (resp.status === 404) {
                  return { content: [{ type: "text", text: `Error fetching wiki page content: Page with id ${parsed.pageId} not found` }], isError: true };
                }
              } catch {}
            }
          }

          if (!pageContent) {
            if (!resolvedPath) {
              resolvedPath = "/";
            }
            // resolvedProject and resolvedWiki are guaranteed to be defined here:
            // - the url branch errors out in parseWikiUrl when project/wikiIdentifier are missing
            // - the pair branch enforces both via the hasPair check above
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const stream = await wikiApi.getPageText(resolvedProject!, resolvedWiki!, resolvedPath, undefined, undefined, true);
            if (!stream) {
              return { content: [{ type: "text", text: "No wiki page content found" }], isError: true };
            }
            pageContent = await streamToString(stream);

            const streamError = extractAdoStreamError(pageContent);
            if (streamError) {
              return {
                content: [{ type: "text", text: `Error fetching wiki page content: ${streamError}` }],
                isError: true,
              };
            }
          }

          return createExternalContentResponse(pageContent, "wiki page");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        const actionErrorMessages: Record<string, string> = {
          list_wikis: `Error fetching wikis: ${errorMessage}`,
          get_wiki: `Error fetching wiki: ${errorMessage}`,
          list_pages: `Error fetching wiki pages: ${errorMessage}`,
          get_page: `Error fetching wiki page metadata: ${errorMessage}`,
          get_page_content: `Error fetching wiki page content: ${errorMessage}`,
        };

        return {
          content: [{ type: "text", text: actionErrorMessages[action] ?? `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    WIKI_TOOLS.wiki_upsert_page,
    "Create or update a wiki page with content.",
    {
      wikiIdentifier: z.string().describe("The unique identifier or name of the wiki."),
      path: z.string().describe("The path of the wiki page (e.g., '/Home' or '/Documentation/Setup')."),
      content: z.string().describe("The content of the wiki page in markdown format."),
      project: z.string().optional().describe("The project name or ID where the wiki is located. If not provided, the default project will be used."),
      etag: z.string().optional().describe("ETag for editing existing pages (optional, will be fetched if not provided)."),
      branch: z.string().default("wikiMaster").describe("The branch name for the wiki repository. Defaults to 'wikiMaster' which is the default branch for Azure DevOps wikis."),
    },
    async ({ wikiIdentifier, path, content, project, etag, branch = "wikiMaster" }) => {
      try {
        const connection = await connectionProvider();
        const accessToken = await tokenProvider();

        // Normalize the path
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const encodedPath = encodeURIComponent(normalizedPath);

        // Build the URL for the wiki page API with version descriptor
        const baseUrl = connection.serverUrl;
        const projectParam = project || "";
        const url = `${baseUrl}/${encodeURIComponent(projectParam)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?path=${encodedPath}&versionDescriptor.versionType=branch&versionDescriptor.version=${encodeURIComponent(branch)}&api-version=7.1`;

        // First, try to create a new page (PUT without ETag)
        const createResponse = await fetch(url, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify({ content: content }),
        });

        if (createResponse.ok) {
          const result = await createResponse.json();
          return {
            content: [
              {
                type: "text",
                text: `Successfully created wiki page at path: ${normalizedPath}. Response: ${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }

        // If creation failed with 409 (Conflict) or 500 (Page exists), try to update it
        if (createResponse.status === 409 || createResponse.status === 500) {
          // Page exists, we need to get the ETag and update it
          let currentEtag = etag;

          if (!currentEtag) {
            // Fetch current page to get ETag
            const getResponse = await fetch(url, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": userAgentProvider(),
              },
            });

            if (getResponse.ok) {
              currentEtag = getResponse.headers.get("etag") || getResponse.headers.get("ETag") || undefined;
              if (!currentEtag) {
                const pageData = await getResponse.json();
                currentEtag = pageData.eTag;
              }
            }

            if (!currentEtag) {
              throw new Error("Could not retrieve ETag for existing page");
            }
          }

          // Now update the existing page with ETag
          const updateResponse = await fetch(url, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": userAgentProvider(),
              "If-Match": currentEtag,
            },
            body: JSON.stringify({ content: content }),
          });

          if (updateResponse.ok) {
            const result = await updateResponse.json();
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully updated wiki page at path: ${normalizedPath}. Response: ${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } else {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update page (${updateResponse.status}): ${errorText}`);
          }
        } else {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create page (${createResponse.status}): ${errorText}`);
        }
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

// Helper to parse Azure DevOps wiki page URLs.
// Supported examples:
//  - https://dev.azure.com/org/project/_wiki/wikis/wikiIdentifier?wikiVersion=GBmain&pagePath=%2FHome
//  - https://dev.azure.com/org/project/_wiki/wikis/wikiIdentifier/123/Title-Of-Page
// Returns either a structured object OR an error message inside { error }.
function parseWikiUrl(url: string): { project: string; wikiIdentifier: string; pagePath?: string; pageId?: number; error?: undefined } | { error: string } {
  try {
    const u = new URL(url);
    // Path segments after host
    // Expect pattern: /{project}/_wiki/wikis/{wikiIdentifier}[/{pageId}/...]
    const segments = u.pathname.split("/").filter(Boolean); // remove empty
    const idx = segments.findIndex((s) => s === "_wiki");
    if (idx < 1 || segments[idx + 1] !== "wikis") {
      return { error: "URL does not match expected wiki pattern (missing /_wiki/wikis/ segment)." };
    }
    const project = segments[idx - 1];
    const wikiIdentifier = segments[idx + 2];
    if (!project || !wikiIdentifier) {
      return { error: "Could not extract project or wikiIdentifier from URL." };
    }

    // Query form with pagePath
    const pagePathParam = u.searchParams.get("pagePath");
    if (pagePathParam) {
      let decoded = decodeURIComponent(pagePathParam);
      if (!decoded.startsWith("/")) decoded = "/" + decoded;
      return { project, wikiIdentifier, pagePath: decoded };
    }

    // Path ID form: .../wikis/{wikiIdentifier}/{pageId}/...
    const afterWiki = segments.slice(idx + 3); // elements after wikiIdentifier
    if (afterWiki.length >= 1) {
      const maybeId = parseInt(afterWiki[0], 10);
      if (!isNaN(maybeId)) {
        return { project, wikiIdentifier, pageId: maybeId };
      }
    }

    // If nothing else specified, treat as root page
    return { project, wikiIdentifier, pagePath: "/" };
  } catch {
    return { error: "Invalid URL format." };
  }
}

export { WIKI_TOOLS, configureWikiTools };
