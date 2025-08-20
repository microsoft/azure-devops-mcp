// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { GitRecursionType, GitVersionOptions, GitVersionType } from "azure-devops-node-api/interfaces/GitInterfaces.js";

/**
 * Registers the get_repository_items tool for reading file/folder content from Azure DevOps repos.
 * Exposes all API parameters.
 */
export function configureRepositoryItemsTool(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    "get_repository_items",
    "Gets a file or folder content from a repository in Azure DevOps. Exposes all API parameters.",
    {
      organization: z.string().describe("The name of the Azure DevOps organization."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repositoryId: z.string().describe("The ID or name of the repository."),
      path: z.string().optional().describe("The path to the item. Example: /README.md"),
      scopePath: z.string().optional().describe("The path scope. Used to limit the items returned."),
      recursionLevel: z.enum(["none", "oneLevel", "full"]).optional().describe("The recursion level of the search."),
      includeContentMetadata: z.boolean().optional().describe("Include content metadata."),
      latestProcessedChange: z.boolean().optional().describe("Return only the latest change."),
      download: z.boolean().optional().describe("Set to true to download the file."),
      $format: z.string().optional().describe("The format of the response."),
      versionDescriptor_version: z.string().optional().describe("A string identifying the version."),
      versionDescriptor_versionOptions: z.string().optional().describe("Version options."),
      versionDescriptor_versionType: z.string().optional().describe("Version type."),
      includeContent: z.boolean().optional().describe("Include file content in the response."),
      resolveLfs: z.boolean().optional().describe("Resolve LFS objects."),
      sanitize: z.boolean().optional().describe("Sanitize the response."),
      apiVersion: z.string().optional().describe("The API version to use. Default: 7.2-preview.1"),
    },
    async (input) => {
      const {
        organization,
        project,
        repositoryId,
        path,
        scopePath,
        recursionLevel,
        includeContentMetadata,
        latestProcessedChange,
        download,
        $format,
        versionDescriptor_version,
        versionDescriptor_versionOptions,
        versionDescriptor_versionType,
        includeContent,
        resolveLfs,
        sanitize,
        apiVersion,
      } = input;
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const versionDescriptor =
        versionDescriptor_version || versionDescriptor_versionOptions || versionDescriptor_versionType
          ? {
              version: versionDescriptor_version,
              versionOptions: versionDescriptor_versionOptions as GitVersionOptions,
              versionType: versionDescriptor_versionType as GitVersionType,
            }
          : undefined;
      const items = await gitApi.getItems(
        repositoryId,
        path,
        project,
        recursionLevel as GitRecursionType,
        includeContentMetadata,
        latestProcessedChange,
        download,
        $format,
        versionDescriptor,
        scopePath,
        includeContent,
        resolveLfs,
        sanitize,
        apiVersion || "7.2-preview.1"
      );
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
    }
  );
}
