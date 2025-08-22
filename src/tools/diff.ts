// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import {
  GitVersionType,
  GitVersionOptions,
} from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { getEnumKeys } from "../utils.js";

export function configureDiffTools(
  server: McpServer,
  tokenProvider: () => Promise<AccessToken>,
  connectionProvider: () => Promise<WebApi>
) {
  const gitVersionTypeStrings = getEnumKeys(GitVersionType);
  const gitVersionOptionsStrings = getEnumKeys(GitVersionOptions);

  server.tool(
    "repo_get_diff",
    "Get the diff between two commits in a repository. Returns file changes and summary.",
    {
      project: z.string().describe("Project name or ID."),
      repositoryId: z.string().describe("Repository name or ID."),
      diffCommonCommit: z.boolean().describe("If true, diff between common and target commits. If false, diff between base and target commits."),
      top: z.number().optional().describe("Maximum number of changes to return. Defaults to 100."),
      skip: z.number().optional().describe("Number of changes to skip."),
      baseVersion: z.string().optional().describe("Base commit/branch/tag."),
      baseVersionType: z.enum(gitVersionTypeStrings as [string, ...string[]]).optional().describe("Type of base version (Branch, Tag, Commit)."),
      baseVersionOptions: z.enum(gitVersionOptionsStrings as [string, ...string[]]).optional().describe("Options for base version."),
      targetVersion: z.string().optional().describe("Target commit/branch/tag."),
      targetVersionType: z.enum(gitVersionTypeStrings as [string, ...string[]]).optional().describe("Type of target version (Branch, Tag, Commit)."),
      targetVersionOptions: z.enum(gitVersionOptionsStrings as [string, ...string[]]).optional().describe("Options for target version."),
    },
    async ({ project, repositoryId, diffCommonCommit, top, skip, baseVersion, baseVersionType, baseVersionOptions, targetVersion, targetVersionType, targetVersionOptions }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const baseVersionDescriptor = baseVersion
        ? {
            version: baseVersion,
            versionType: baseVersionType ? GitVersionType[baseVersionType as keyof typeof GitVersionType] : undefined,
            versionOptions: baseVersionOptions ? GitVersionOptions[baseVersionOptions as keyof typeof GitVersionOptions] : undefined,
          }
        : undefined;
      const targetVersionDescriptor = targetVersion
        ? {
            version: targetVersion,
            versionType: targetVersionType ? GitVersionType[targetVersionType as keyof typeof GitVersionType] : undefined,
            versionOptions: targetVersionOptions ? GitVersionOptions[targetVersionOptions as keyof typeof GitVersionOptions] : undefined,
          }
        : undefined;
      const result = await gitApi.getCommitDiffs(
        repositoryId,
        project,
        diffCommonCommit,
        top,
        skip,
        baseVersionDescriptor,
        targetVersionDescriptor
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
