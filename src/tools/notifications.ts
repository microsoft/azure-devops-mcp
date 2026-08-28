// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { elicitProject } from "../shared/elicitations.js";

const NOTIFICATIONS_TOOLS = {
  notifications: "notifications",
};

function configureNotificationsTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    NOTIFICATIONS_TOOLS.notifications,
    "Retrieve notification-related data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list_events"]).describe("The action to perform. Options: list_events (list notification events for a project)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      pageSize: z
        .coerce.number()
        .optional()
        .default(100)
        .describe("The number of events to retrieve per page. Defaults to 100."),
      includedProperties: z
        .array(z.string())
        .optional()
        .describe("Optional array of properties to include in the response (e.g., ['eventType', 'timestamp', 'projectName'])."),
    },
    async ({ action, project, pageSize, includedProperties }) => {
      try {
        const connection = await connectionProvider();
        let resolvedProject = project;

        if (action === "list_events") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list notification events for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }

          try {
            const notificationApi = await connection.getNotificationApi();
            const eventTypes = await notificationApi.listEventTypes();

            if (!eventTypes || eventTypes.length === 0) {
              return { content: [{ type: "text", text: "No notification event types found." }] };
            }

            const filteredEvents = includedProperties && includedProperties.length > 0 ? eventTypes.map((et) => filterProperties(et, includedProperties)) : eventTypes;

            return {
              content: [
                { type: "text", text: `Project: ${resolvedProject}` },
                { type: "text", text: `Retrieved ${filteredEvents.length} notification event types` },
                { type: "text", text: JSON.stringify(filteredEvents, null, 2) },
              ],
            };
          } catch (apiError) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to retrieve notification events: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
                },
              ],
              isError: true,
            };
          }
        }

        return {
          content: [{ type: "text", text: `Unknown action: ${action}` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving notification data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

function filterProperties(obj: Record<string, unknown>, properties: string[]): Record<string, unknown> {
  return properties.reduce(
    (acc, prop) => {
      if (prop in obj) {
        acc[prop] = obj[prop];
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );
}

export { configureNotificationsTools };
