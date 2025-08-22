// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";

export function configureGitCommitTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    "git_get_commit",
    "Get information about a specific commit in a repository.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repositoryId: z.string().describe("The ID or name of the repository."),
      commitId: z.string().describe("The ID (SHA) of the commit to retrieve."),
      changeCount: z.number().optional().describe("The number of changes to include in the response. Optional."),
    },
    async ({ project, repositoryId, commitId, changeCount }) => {
      const connection = await connectionProvider();
      const gitApi = await connection.getGitApi();
      const commit = await gitApi.getCommit(commitId, repositoryId, project, changeCount);
      return {
        content: [{ type: "text", text: JSON.stringify(commit, null, 2) }],
      };
    }
  );
}
