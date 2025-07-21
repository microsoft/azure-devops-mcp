// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { ReleaseDefinitionExpands, ReleaseDefinitionQueryOrder, ReleaseExpands, ReleaseStatus, ReleaseQueryOrder } from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";
import { z } from "zod";
import { getEnumKeys, safeEnumConvert } from "../utils.js";

const RELEASE_TOOLS = {
  get_release_definitions: "release_get_definitions",
  get_releases: "release_get_releases",
};

function configureReleaseTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    RELEASE_TOOLS.get_release_definitions,
    "Retrieves list of release definitions for a given project.",
    {
      project: z.string().describe("Project ID or name to get release definitions for"),
      searchText: z.string().optional().describe("Search text to filter release definitions"),
      expand: z
        .enum(getEnumKeys(ReleaseDefinitionExpands) as [string, ...string[]])
        .default("None")
        .describe("Expand options for release definitions"),
      artifactType: z.string().optional().describe("Filter by artifact type"),
      artifactSourceId: z.string().optional().describe("Filter by artifact source ID"),
      top: z.number().optional().describe("Number of results to return (for pagination)"),
      continuationToken: z.string().optional().describe("Continuation token for pagination"),
      queryOrder: z
        .enum(getEnumKeys(ReleaseDefinitionQueryOrder) as [string, ...string[]])
        .default("NameAscending")
        .describe("Order of the results"),
      path: z.string().optional().describe("Path to filter release definitions"),
      isExactNameMatch: z.boolean().optional().default(false).describe("Whether to match the exact name of the release definition. Default is false."),
      tagFilter: z.array(z.string()).optional().describe("Filter by tags associated with the release definitions"),
      propertyFilters: z.array(z.string()).optional().describe("Filter by properties associated with the release definitions"),
      definitionIdFilter: z.array(z.string()).optional().describe("Filter by specific release definition IDs"),
      isDeleted: z.boolean().default(false).describe("Whether to include deleted release definitions. Default is false."),
      searchTextContainsFolderName: z.boolean().optional().describe("Whether to include folder names in the search text"),
    },
    async ({
      project,
      searchText,
      expand,
      artifactType,
      artifactSourceId,
      top,
      continuationToken,
      queryOrder,
      path,
      isExactNameMatch,
      tagFilter,
      propertyFilters,
      definitionIdFilter,
      isDeleted,
      searchTextContainsFolderName,
    }) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releaseDefinitions = await releaseApi.getReleaseDefinitions(
        project,
        searchText,
        safeEnumConvert(ReleaseDefinitionExpands, expand),
        artifactType,
        artifactSourceId,
        top,
        continuationToken,
        safeEnumConvert(ReleaseDefinitionQueryOrder, queryOrder),
        path,
        isExactNameMatch,
        tagFilter,
        propertyFilters,
        definitionIdFilter,
        isDeleted,
        searchTextContainsFolderName
      );

      return {
        content: [{ type: "text", text: JSON.stringify(releaseDefinitions, null, 2) }],
      };
    }
  );

  server.tool(
    RELEASE_TOOLS.get_releases,
    "Retrieves a list of releases for a given project.",
    {
      project: z.string().optional().describe("Project ID or name to get releases for"),
      definitionId: z.number().optional().describe("ID of the release definition to filter releases"),
      definitionEnvironmentId: z.number().optional().describe("ID of the definition environment to filter releases"),
      searchText: z.string().optional().describe("Search text to filter releases"),
      createdBy: z.string().optional().describe("User ID or name who created the release"),
      statusFilter: z
        .enum(getEnumKeys(ReleaseStatus) as [string, ...string[]])
        .optional()
        .default("Active")
        .describe("Status of the releases to filter (default: Active)"),
      environmentStatusFilter: z.number().optional().describe("Environment status to filter releases"),
      minCreatedTime: z.coerce
        .date()
        .optional()
        .default(() => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return sevenDaysAgo;
        })
        .describe("Minimum created time for releases (default: 7 days ago)"),
      maxCreatedTime: z.coerce
        .date()
        .optional()
        .default(() => new Date())
        .describe("Maximum created time for releases (default: now)"),
      queryOrder: z
        .enum(getEnumKeys(ReleaseQueryOrder) as [string, ...string[]])
        .optional()
        .default("Ascending")
        .describe("Order in which to return releases (default: Ascending)"),
      top: z.number().optional().describe("Number of releases to return"),
      continuationToken: z.number().optional().describe("Continuation token for pagination"),
      expand: z
        .enum(getEnumKeys(ReleaseExpands) as [string, ...string[]])
        .optional()
        .default("None")
        .describe("Expand options for releases"),
      artifactTypeId: z.string().optional().describe("Filter releases by artifact type ID"),
      sourceId: z.string().optional().describe("Filter releases by artifact source ID"),
      artifactVersionId: z.string().optional().describe("Filter releases by artifact version ID"),
      sourceBranchFilter: z.string().optional().describe("Filter releases by source branch"),
      isDeleted: z.boolean().optional().default(false).describe("Whether to include deleted releases (default: false)"),
      tagFilter: z.array(z.string()).optional().describe("Filter releases by tags"),
      propertyFilters: z.array(z.string()).optional().describe("Filter releases by properties"),
      releaseIdFilter: z.array(z.number()).optional().describe("Filter by specific release IDs"),
      path: z.string().optional().describe("Path to filter releases"),
    },
    async ({
      project,
      definitionId,
      definitionEnvironmentId,
      searchText,
      createdBy,
      statusFilter,
      environmentStatusFilter,
      minCreatedTime,
      maxCreatedTime,
      queryOrder,
      top,
      continuationToken,
      expand,
      artifactTypeId,
      sourceId,
      artifactVersionId,
      sourceBranchFilter,
      isDeleted,
      tagFilter,
      propertyFilters,
      releaseIdFilter,
      path,
    }) => {
      const connection = await connectionProvider();
      const releaseApi = await connection.getReleaseApi();
      const releases = await releaseApi.getReleases(
        project,
        definitionId,
        definitionEnvironmentId,
        searchText,
        createdBy,
        safeEnumConvert(ReleaseStatus, statusFilter),
        environmentStatusFilter,
        minCreatedTime,
        maxCreatedTime,
        safeEnumConvert(ReleaseQueryOrder, queryOrder),
        top,
        continuationToken,
        safeEnumConvert(ReleaseExpands, expand),
        artifactTypeId,
        sourceId,
        artifactVersionId,
        sourceBranchFilter,
        isDeleted,
        tagFilter,
        propertyFilters,
        releaseIdFilter,
        path
      );

      return {
        content: [{ type: "text", text: JSON.stringify(releases, null, 2) }],
      };
    }
  );
}

export { RELEASE_TOOLS, configureReleaseTools };
