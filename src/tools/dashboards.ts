// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { Dashboard, Widget, WidgetScope } from "azure-devops-node-api/interfaces/DashboardInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { optionalProject, optionalTeamWith } from "../shared/common-params.js";

const DASHBOARD_TOOLS = {
  list_dashboards: "dashboard_list_dashboards",
  get_dashboard: "dashboard_get_dashboard",
  create_dashboard: "dashboard_create_dashboard",
  replace_dashboard: "dashboard_replace_dashboard",
  delete_dashboard: "dashboard_delete_dashboard",
  get_widget: "dashboard_get_widget",
  create_widget: "dashboard_create_widget",
  update_widget: "dashboard_update_widget",
  delete_widget: "dashboard_delete_widget",
  list_widget_types: "dashboard_list_widget_types",
  get_widget_metadata: "dashboard_get_widget_metadata",
};

function configureDashboardTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // Resolve the project (eliciting if not supplied) and assemble a team context for the dashboard APIs.
  const resolveContext = async (connection: WebApi, project: string | undefined, team: string | undefined) => {
    let resolvedProject = project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
      if ("response" in result) return result;
      resolvedProject = result.resolved;
    }
    return { teamContext: { project: resolvedProject, team } };
  };

  const projectField = optionalProject;
  const teamField = optionalTeamWith("Omit for project-scoped dashboards.");

  registerTool(
    server,
    DASHBOARD_TOOLS.list_dashboards,
    "List the dashboards in a project (or team). If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
    },
    async ({ project, team }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const dashboards = await dashboardApi.getDashboardsByProject(ctx.teamContext);

        if (!dashboards || dashboards.length === 0) {
          return { content: [{ type: "text", text: "No dashboards found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(dashboards, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching dashboards: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.get_dashboard,
    "Get a specific dashboard (including its widgets) by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard."),
    },
    async ({ project, team, dashboardId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const dashboard = await dashboardApi.getDashboard(ctx.teamContext, dashboardId);

        return { content: [{ type: "text", text: JSON.stringify(dashboard, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching dashboard: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.create_dashboard,
    "Create a new dashboard in a project (or team). If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
      dashboard: z.record(z.unknown()).describe("The dashboard object to create (e.g. { name, description, widgets }). At minimum a name is required."),
    },
    async ({ project, team, dashboard }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const result = await dashboardApi.createDashboard(dashboard as unknown as Dashboard, ctx.teamContext);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating dashboard: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.replace_dashboard,
    "Replace (fully update) an existing dashboard. Obtain the current dashboard via dashboard_get_dashboard, modify it, and pass back the full object.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard to replace."),
      dashboard: z.record(z.unknown()).describe("The full dashboard object (as returned by dashboard_get_dashboard, with edits applied)."),
    },
    async ({ project, team, dashboardId, dashboard }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const result = await dashboardApi.replaceDashboard(dashboard as unknown as Dashboard, ctx.teamContext, dashboardId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error replacing dashboard: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.delete_dashboard,
    "Delete a dashboard by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard to delete."),
    },
    async ({ project, team, dashboardId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        await dashboardApi.deleteDashboard(ctx.teamContext, dashboardId);

        return { content: [{ type: "text", text: `Dashboard ${dashboardId} deleted` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting dashboard: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.get_widget,
    "Get a specific widget on a dashboard. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard containing the widget."),
      widgetId: z.string().describe("The ID of the widget."),
    },
    async ({ project, team, dashboardId, widgetId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const widget = await dashboardApi.getWidget(ctx.teamContext, dashboardId, widgetId);

        return { content: [{ type: "text", text: JSON.stringify(widget, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching widget: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.create_widget,
    "Add a widget to a dashboard. Use dashboard_list_widget_types to discover the contributionId and default sizing for available widgets.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard to add the widget to."),
      widget: z.record(z.unknown()).describe("The widget object to create (e.g. { name, contributionId, size: { rowSpan, columnSpan }, position: { row, column }, settings })."),
    },
    async ({ project, team, dashboardId, widget }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const result = await dashboardApi.createWidget(widget as unknown as Widget, ctx.teamContext, dashboardId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating widget: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.update_widget,
    "Update a widget on a dashboard. Obtain the current widget via dashboard_get_widget, modify it, and pass back the full object.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard containing the widget."),
      widgetId: z.string().describe("The ID of the widget to update."),
      widget: z.record(z.unknown()).describe("The full widget object (as returned by dashboard_get_widget, with edits applied)."),
    },
    async ({ project, team, dashboardId, widgetId, widget }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const result = await dashboardApi.updateWidget(widget as unknown as Widget, ctx.teamContext, dashboardId, widgetId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating widget: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.delete_widget,
    "Remove a widget from a dashboard. Returns the updated dashboard. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      team: teamField,
      dashboardId: z.string().describe("The ID of the dashboard containing the widget."),
      widgetId: z.string().describe("The ID of the widget to remove."),
    },
    async ({ project, team, dashboardId, widgetId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveContext(connection, project, team);
        if ("response" in ctx) return ctx.response;

        const dashboardApi = await connection.getDashboardApi();
        const result = await dashboardApi.deleteWidget(ctx.teamContext, dashboardId, widgetId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting widget: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.list_widget_types,
    "List the widget types available to add to dashboards, including their contributionId and default sizing.",
    {
      project: projectField,
      scope: z
        .enum(["project_team", "collection_user"])
        .default("project_team")
        .describe("The scope of the widget types: 'project_team' for dashboard widgets or 'collection_user' for the user's personal scope."),
    },
    async ({ project, scope }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to list widget types for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const widgetScope = scope === "collection_user" ? WidgetScope.Collection_User : WidgetScope.Project_Team;
        const dashboardApi = await connection.getDashboardApi();
        const types = await dashboardApi.getWidgetTypes(widgetScope, resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(types, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching widget types: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    DASHBOARD_TOOLS.get_widget_metadata,
    "Get the metadata for a widget type by its contribution ID. Use dashboard_list_widget_types to discover contribution IDs.",
    {
      project: projectField,
      contributionId: z.string().describe("The contribution ID of the widget type (e.g. 'ms.vss-dashboards-web.Microsoft.VisualStudioServices.Dashboards.QueryScalarWidget')."),
    },
    async ({ project, contributionId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to get widget metadata for.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const dashboardApi = await connection.getDashboardApi();
        const metadata = await dashboardApi.getWidgetMetadata(contributionId, resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching widget metadata: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { DASHBOARD_TOOLS, configureDashboardTools };
