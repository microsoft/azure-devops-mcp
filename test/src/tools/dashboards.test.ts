// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureDashboardTools } from "../../../src/tools/dashboards";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface DashboardApiMock {
  getDashboardsByProject: jest.Mock;
  getDashboard: jest.Mock;
  createDashboard: jest.Mock;
  replaceDashboard: jest.Mock;
  deleteDashboard: jest.Mock;
  getWidget: jest.Mock;
  createWidget: jest.Mock;
  updateWidget: jest.Mock;
  deleteWidget: jest.Mock;
  getWidgetTypes: jest.Mock;
  getWidgetMetadata: jest.Mock;
}

describe("configureDashboardTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getDashboardApi: jest.Mock };
  let mockDashboardApi: DashboardApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockDashboardApi = {
      getDashboardsByProject: jest.fn(),
      getDashboard: jest.fn(),
      createDashboard: jest.fn(),
      replaceDashboard: jest.fn(),
      deleteDashboard: jest.fn(),
      getWidget: jest.fn(),
      createWidget: jest.fn(),
      updateWidget: jest.fn(),
      deleteWidget: jest.fn(),
      getWidgetTypes: jest.fn(),
      getWidgetMetadata: jest.fn(),
    };
    mockConnection = {
      getDashboardApi: jest.fn().mockResolvedValue(mockDashboardApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureDashboardTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers dashboard tools on the server", () => {
      configureDashboardTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_dashboards passes the team context", async () => {
    const handler = getHandler("dashboard_list_dashboards");
    mockDashboardApi.getDashboardsByProject.mockResolvedValue([{ id: "d1", name: "Overview" }]);

    const result = await handler({ project: "Proj", team: "Team" });

    expect(mockDashboardApi.getDashboardsByProject).toHaveBeenCalledWith({ project: "Proj", team: "Team" });
    expect(result.content[0].text).toContain("Overview");
  });

  it("list_dashboards reports when none found", async () => {
    const handler = getHandler("dashboard_list_dashboards");
    mockDashboardApi.getDashboardsByProject.mockResolvedValue([]);

    const result = await handler({ project: "Proj" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No dashboards found");
  });

  it("get_dashboard passes the dashboard id", async () => {
    const handler = getHandler("dashboard_get_dashboard");
    mockDashboardApi.getDashboard.mockResolvedValue({ id: "d1" });

    const result = await handler({ project: "Proj", dashboardId: "d1" });

    expect(mockDashboardApi.getDashboard).toHaveBeenCalledWith({ project: "Proj", team: undefined }, "d1");
    expect(result.content[0].text).toContain("d1");
  });

  it("create_dashboard passes the dashboard object", async () => {
    const handler = getHandler("dashboard_create_dashboard");
    mockDashboardApi.createDashboard.mockResolvedValue({ id: "d2", name: "New" });

    const dashboard = { name: "New" };
    const result = await handler({ project: "Proj", team: "Team", dashboard });

    expect(mockDashboardApi.createDashboard).toHaveBeenCalledWith(dashboard, { project: "Proj", team: "Team" });
    expect(result.content[0].text).toContain("New");
  });

  it("replace_dashboard passes the dashboard id and object", async () => {
    const handler = getHandler("dashboard_replace_dashboard");
    mockDashboardApi.replaceDashboard.mockResolvedValue({ id: "d1", name: "Updated" });

    const dashboard = { id: "d1", name: "Updated" };
    const result = await handler({ project: "Proj", dashboardId: "d1", dashboard });

    expect(mockDashboardApi.replaceDashboard).toHaveBeenCalledWith(dashboard, { project: "Proj", team: undefined }, "d1");
    expect(result.content[0].text).toContain("Updated");
  });

  it("delete_dashboard deletes by id", async () => {
    const handler = getHandler("dashboard_delete_dashboard");
    mockDashboardApi.deleteDashboard.mockResolvedValue(undefined);

    const result = await handler({ project: "Proj", dashboardId: "d1" });

    expect(mockDashboardApi.deleteDashboard).toHaveBeenCalledWith({ project: "Proj", team: undefined }, "d1");
    expect(result.content[0].text).toContain("Dashboard d1 deleted");
  });

  it("get_widget passes dashboard and widget ids", async () => {
    const handler = getHandler("dashboard_get_widget");
    mockDashboardApi.getWidget.mockResolvedValue({ id: "w1" });

    const result = await handler({ project: "Proj", dashboardId: "d1", widgetId: "w1" });

    expect(mockDashboardApi.getWidget).toHaveBeenCalledWith({ project: "Proj", team: undefined }, "d1", "w1");
    expect(result.content[0].text).toContain("w1");
  });

  it("create_widget passes the widget object", async () => {
    const handler = getHandler("dashboard_create_widget");
    mockDashboardApi.createWidget.mockResolvedValue({ id: "w2" });

    const widget = { name: "Chart", contributionId: "ms.widget" };
    const result = await handler({ project: "Proj", dashboardId: "d1", widget });

    expect(mockDashboardApi.createWidget).toHaveBeenCalledWith(widget, { project: "Proj", team: undefined }, "d1");
    expect(result.content[0].text).toContain("w2");
  });

  it("update_widget passes ids and the widget object", async () => {
    const handler = getHandler("dashboard_update_widget");
    mockDashboardApi.updateWidget.mockResolvedValue({ id: "w1", name: "Edited" });

    const widget = { id: "w1", name: "Edited" };
    const result = await handler({ project: "Proj", dashboardId: "d1", widgetId: "w1", widget });

    expect(mockDashboardApi.updateWidget).toHaveBeenCalledWith(widget, { project: "Proj", team: undefined }, "d1", "w1");
    expect(result.content[0].text).toContain("Edited");
  });

  it("delete_widget returns the updated dashboard", async () => {
    const handler = getHandler("dashboard_delete_widget");
    mockDashboardApi.deleteWidget.mockResolvedValue({ id: "d1", widgets: [] });

    const result = await handler({ project: "Proj", dashboardId: "d1", widgetId: "w1" });

    expect(mockDashboardApi.deleteWidget).toHaveBeenCalledWith({ project: "Proj", team: undefined }, "d1", "w1");
    expect(result.content[0].text).toContain("widgets");
  });

  it("list_widget_types maps the project_team scope", async () => {
    const handler = getHandler("dashboard_list_widget_types");
    mockDashboardApi.getWidgetTypes.mockResolvedValue({ widgetTypes: [] });

    const result = await handler({ project: "Proj", scope: "project_team" });

    // WidgetScope.Project_Team === 1
    expect(mockDashboardApi.getWidgetTypes).toHaveBeenCalledWith(1, "Proj");
    expect(result.content[0].text).toContain("widgetTypes");
  });

  it("list_widget_types maps the collection_user scope", async () => {
    const handler = getHandler("dashboard_list_widget_types");
    mockDashboardApi.getWidgetTypes.mockResolvedValue({ widgetTypes: [] });

    await handler({ project: "Proj", scope: "collection_user" });

    // WidgetScope.Collection_User === 0
    expect(mockDashboardApi.getWidgetTypes).toHaveBeenCalledWith(0, "Proj");
  });

  it("get_widget_metadata passes the contribution id", async () => {
    const handler = getHandler("dashboard_get_widget_metadata");
    mockDashboardApi.getWidgetMetadata.mockResolvedValue({ widgetMetadata: {} });

    const result = await handler({ project: "Proj", contributionId: "ms.widget.scalar" });

    expect(mockDashboardApi.getWidgetMetadata).toHaveBeenCalledWith("ms.widget.scalar", "Proj");
    expect(result.content[0].text).toContain("widgetMetadata");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("dashboard_get_dashboard");
    mockDashboardApi.getDashboard.mockRejectedValue(new Error("boom"));

    const result = await handler({ project: "Proj", dashboardId: "d1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching dashboard: boom");
  });
});
