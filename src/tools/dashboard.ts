// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { orgName } from "../index.js";

const DASHBOARD_TOOLS = {
  create_dashboard: "create_dashboard",
};

interface DashboardWidget {
  id?: string;
  name: string;
  position: {
    row: number;
    column: number;
  };
  size: {
    rowSpan: number;
    columnSpan: number;
  };
  settings?: string;
  settingsVersion?: {
    major: number;
    minor: number;
    patch: number;
  };
  contributionId?: string;
  areSettingsBlockedForUser?: boolean;
  isEnabled?: boolean;
}

interface CreateDashboardRequest {
  name: string;
  description?: string;
  dashboardScope?: "project_scope" | "team_scope";
  refreshInterval?: number;
  widgets?: DashboardWidget[];
  position?: number;
}

function configureDashboardTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    DASHBOARD_TOOLS.create_dashboard,
    "Create a new dashboard in Azure DevOps project or team",
    {
      project: z.string().describe("Project ID or project name"),
      team: z.string().optional().describe("Team ID or team name (optional for project-scoped dashboards)"),
      name: z.string().describe("Name of the dashboard"),
      description: z.string().optional().describe("Description of the dashboard"),
      dashboardScope: z.enum(["project_scope", "team_scope"]).default("project_scope").describe("Scope of the dashboard - project or team level"),
      refreshInterval: z.number().optional().describe("Auto-refresh interval in minutes"),
      position: z.number().optional().describe("Position of the dashboard within the group"),
      widgets: z.array(z.object({
        name: z.string().describe("Widget name"),
        contributionId: z.string().optional().describe("Widget contribution ID"),
        position: z.object({
          row: z.number().describe("Row position"),
          column: z.number().describe("Column position"),
        }).describe("Widget position on dashboard"),
        size: z.object({
          rowSpan: z.number().describe("Number of rows the widget spans"),
          columnSpan: z.number().describe("Number of columns the widget spans"),
        }).describe("Widget size"),
        settings: z.string().nullable().optional().describe("Widget settings as JSON string"),
        settingsVersion: z.object({
          major: z.number(),
          minor: z.number(),
          patch: z.number(),
        }).optional().describe("Widget settings version"),
        areSettingsBlockedForUser: z.boolean().optional().describe("Whether widget settings are blocked for the user"),
        isEnabled: z.boolean().optional().describe("Whether the widget is enabled"),
      })).optional().describe("Array of widgets to add to the dashboard"),
    },
    async ({ project, team, name, description, dashboardScope, refreshInterval, position, widgets }) => {
      try {
        const accessToken = await tokenProvider();
        
        // Build the URL based on whether team is specified
        let url: string;
        if (team && dashboardScope === "team_scope") {
          url = `https://dev.azure.com/${orgName}/${project}/${team}/_apis/dashboard/dashboards?api-version=7.2-preview.3`;
        } else {
          url = `https://dev.azure.com/${orgName}/${project}/_apis/dashboard/dashboards?api-version=7.2-preview.3`;
        }

        // Build the request body
        const requestBody: CreateDashboardRequest = {
          name,
          dashboardScope,
        };

        if (description) {
          requestBody.description = description;
        }

        if (refreshInterval) {
          requestBody.refreshInterval = refreshInterval;
        }

        if (position !== undefined) {
          requestBody.position = position;
        }

        if (widgets && widgets.length > 0) {
          requestBody.widgets = widgets.map(widget => ({
            name: widget.name,
            position: widget.position,
            size: widget.size,
            ...(widget.contributionId && { contributionId: widget.contributionId }),
            ...(widget.settings && { settings: widget.settings }),
          }));
        }

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [{ 
              type: "text", 
              text: `Error creating dashboard: ${response.status} ${response.statusText} - ${errorText}` 
            }],
            isError: true,
          };
        }

        const createdDashboard = await response.json();
        
        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                success: true,
                message: `Dashboard "${name}" created successfully`,
                dashboard: {
                  id: createdDashboard.id,
                  name: createdDashboard.name,
                  description: createdDashboard.description,
                  dashboardScope: createdDashboard.dashboardScope,
                  url: createdDashboard.url,
                  position: createdDashboard.position,
                  refreshInterval: createdDashboard.refreshInterval,
                  widgetCount: createdDashboard.widgets ? createdDashboard.widgets.length : 0,
                  modifiedDate: createdDashboard.modifiedDate,
                  ownerId: createdDashboard.ownerId,
                  groupId: createdDashboard.groupId,
                },
                fullResponse: createdDashboard
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating dashboard: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { DASHBOARD_TOOLS, configureDashboardTools };
