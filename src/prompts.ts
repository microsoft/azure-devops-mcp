// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CORE_TOOLS } from "./tools/core.js";
import { WORKITEM_TOOLS } from "./tools/workitems.js";

function configurePrompts(server: McpServer) {   

  server.prompt(
    "listProjects",
    "Lists all projects in the Azure DevOps organization.",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: String.raw`
# Task
Use the '${CORE_TOOLS.list_projects}' tool to retrieve all projects in the current Azure DevOps organization.
Present the results in a table with the following columns: Project ID, Name, and Description.`,
          },
        },
      ],
    })
  );

  server.prompt(
    "listTeams",
    "Retrieves all teams for a given Azure DevOps project.",
    { project: z.string() },
    ({ project }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: String.raw`
  # Task
  Use the '${CORE_TOOLS.list_project_teams}' tool to retrieve all teams for the project '${project}'.
  Present the results in a table with the following columns: Team ID, and Name`,
          },
        },
      ],
    })
  );

  server.prompt(
    "getWorkItem",
    "Retrieves details for a specific Azure DevOps work item by ID.",
    { id: z.string().describe("The ID of the work item to retrieve."),
      project: z.string().describe("The name or ID of the Azure DevOps project."),
    },
    ({ id, project }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: String.raw`
  # Task
  Use the '${WORKITEM_TOOLS.get_work_item}' tool to retrieve details for the work item with ID '${id}' in project '${project}'.
  Present the following fields: ID, Title, State, Assigned To, Work Item Type, Description or Repro Steps, and Created Date.`,
          },
        },
      ],
    })
  );

}

export { configurePrompts };
