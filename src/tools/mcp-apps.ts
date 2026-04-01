// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { markdownCommentsApiVersion } from "../utils.js";
import { toCommentHtml, uploadInlineImages } from "../apps/shared/comment-helpers.js";

const MCP_APPS_TOOLS = {
  post_work_item_comment: "wit_post_work_item_comment",
};

function configureMcpAppsTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): void {
  registerAppTool(
    server,
    MCP_APPS_TOOLS.post_work_item_comment,
    {
      title: "Post Work Item Comment",
      description: "Posts a comment to an Azure DevOps work item. This tool is only callable by MCP apps (e.g., the Comment Review App) and is not visible to LLMs.",
      inputSchema: {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        workItemId: z.coerce.number().describe("The ID of the work item to add a comment to."),
        comment: z.string().describe("The text of the comment to add to the work item."),
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      const { project, workItemId, comment } = args;
      try {
        const connection = await connectionProvider();
        const orgUrl = connection.serverUrl;
        const accessToken = await tokenProvider();

        let commentHtml = toCommentHtml(comment);
        commentHtml = await uploadInlineImages(commentHtml, orgUrl, project, accessToken, userAgentProvider());

        const response = await fetch(`${orgUrl}/${project}/_apis/wit/workItems/${workItemId}/comments?format=1&api-version=${markdownCommentsApiVersion}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify({ text: commentHtml }),
        });

        if (!response.ok) {
          throw new Error(`Failed to add a work item comment: ${response.statusText}`);
        }

        const comments = await response.text();

        return {
          content: [{ type: "text", text: comments }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error adding work item comment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

export { configureMcpAppsTools, MCP_APPS_TOOLS };
