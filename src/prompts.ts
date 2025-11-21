// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CORE_TOOLS } from "./tools/core.js";

function configurePrompts(server: McpServer) {
  server.prompt("Projects", "Lists all projects in the Azure DevOps organization.", {}, () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: String.raw`
# Task
Use the '${CORE_TOOLS.list_projects}' tool to retrieve all 'wellFormed' projects in the current Azure DevOps organization.
Present the results in alphabetical order in a table with the following columns: Name and ID.`,
        },
      },
    ],
  }));
}

export { configurePrompts };
