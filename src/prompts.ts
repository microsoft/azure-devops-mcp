// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { REPO_TOOLS } from "./tools/repos.js";

function configurePrompts(server: McpServer) {
  server.prompt(
    "relevant_pull_requests",
    "Presents the list of relevant pull requests for a given repository.",
    { repositoryId: z.string() },
    ({ repositoryId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: String.raw`
# Prerequisites
1. Unless already provided, ask user for the project name
2. Unless already provided, use '${REPO_TOOLS.list_all_repos_by_project}' tool to get a summarized response of the repositories in this project and ask user to select one

# Task
Find all pull requests for repository ${repositoryId} using '${REPO_TOOLS.list_pull_requests_by_repo}' tool and summarize them in a table.
Include the following columns: ID, Title, Status, Created Date, Author and Reviewers.`,
          },
        },
      ],
    })
  );
}

export { configurePrompts };
