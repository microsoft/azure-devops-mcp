// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { VersionControlRecursionType } from "azure-devops-node-api/interfaces/GitInterfaces.js";

/**
 * Registers the get_repository_items tool for reading file content from Azure DevOps repos.
 */
export function configureRepositoryItemsTool(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    "get_repository_items",
    "Gets a file or folder content from a repository in Azure DevOps. Exposes all API parameters.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repositoryId: z.string().describe("The ID or name of the repository."),
      path: z.string().describe("The path to the item. Example: /README.md"),
      versionDescriptor_version: z.string().optional().describe("A string identifying the version via commit hash."),
    },
    async (input) => {
      const { project, repositoryId, path, versionDescriptor_version } = input;

      try {
        const connection = await connectionProvider();
        const gitApi = await connection.getGitApi();

        const versionDescriptor = versionDescriptor_version ? { version: versionDescriptor_version, versionType: 2, versionOptions: 0 } : undefined;
        const item = await gitApi.getItem(
          repositoryId,
          path,
          project,
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
        if (item == null) {
          return { content: [{ type: "text", text: "Item not found or no content available. Try including the version." }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(item.content, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to get repository item: ${error}` }],
        };
      }
    }
  );
}
