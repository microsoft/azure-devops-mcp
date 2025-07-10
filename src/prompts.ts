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
  server.prompt(
  "listUserStories",
  "Retrieves a list of User Story work items from a specified Azure DevOps project.",
  {
    project: z.string().describe("The name or ID of the Azure DevOps project."),
    team: z.string().optional().describe("The name or ID of the Azure DevOps team. If not provided, will search across all teams."),
    state: z.enum(["Active", "New", "Resolved", "Closed", "Removed"]).optional().describe("Filter by work item state."),
    assignedTo: z.string().optional().describe("Filter by assignee display name or email."),
    areaPath: z.string().optional().describe("Filter by area path."),
    iterationPath: z.string().optional().describe("Filter by iteration path."),
    top: z.string().optional().describe("Maximum number of User Stories to return."),
    orderBy: z.enum(["System.Id", "System.Title", "System.CreatedDate", "System.ChangedDate", "System.State"]).optional().describe("Field to order results by."),
    orderDirection: z.enum(["asc", "desc"]).optional().describe("Order direction."),
  },
  ({ project, team, state, assignedTo, areaPath, iterationPath, top, orderBy, orderDirection }) => {
    let filterText = "";
    
    if (state) filterText += `\n- State: ${state}`;
    if (assignedTo) filterText += `\n- Assigned To: ${assignedTo}`;
    if (areaPath) filterText += `\n- Area Path: ${areaPath}`;
    if (iterationPath) filterText += `\n- Iteration Path: ${iterationPath}`;
    if (team) filterText += `\n- Team: ${team}`;
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: String.raw`
# Task
Use the '${WORKITEM_TOOLS.list_user_stories}' tool to retrieve User Story work items from the project '${project}'.

## Parameters
- Project: ${project}
- Maximum Results: ${top}
- Order By: ${orderBy} (${orderDirection})${filterText}

## Required Output Format
Present the results in a well-formatted table with the following columns:
- ID
- Title
- State
- Assigned To
- Story Points
- Priority
- Area Path
- Iteration Path
- Created Date

If no User Stories are found, display a message indicating that no User Stories match the specified criteria.

Additionally, provide a summary showing:
- Total number of User Stories found
- Distribution by state (if multiple states are present)
- Distribution by assignee (if multiple assignees are present)`,
          },
        },
      ],
    };
  }
);

}

export { configurePrompts };
