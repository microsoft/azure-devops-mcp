// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureNotificationTools } from "../../../src/tools/notification";
import { createToolServer } from "../../mocks/tool-server";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface NotificationApiMock {
  listSubscriptions: jest.Mock;
  getSubscription: jest.Mock;
  createSubscription: jest.Mock;
  updateSubscription: jest.Mock;
  deleteSubscription: jest.Mock;
  listEventTypes: jest.Mock;
  getEventType: jest.Mock;
  getSubscriptionTemplates: jest.Mock;
}

describe("configureNotificationTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getNotificationApi: jest.Mock };
  let mockNotificationApi: NotificationApiMock;

  beforeEach(() => {
    server = createToolServer() as unknown as McpServer;
    tokenProvider = jest.fn();
    mockNotificationApi = {
      listSubscriptions: jest.fn(),
      getSubscription: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      deleteSubscription: jest.fn(),
      listEventTypes: jest.fn(),
      getEventType: jest.fn(),
      getSubscriptionTemplates: jest.fn(),
    };
    mockConnection = {
      getNotificationApi: jest.fn().mockResolvedValue(mockNotificationApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  const getHandler = (toolName: string) => {
    configureNotificationTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3] as (params: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  };

  describe("tool registration", () => {
    it("registers notification tools on the server", () => {
      configureNotificationTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  it("list_subscriptions passes target and ids", async () => {
    const handler = getHandler("notification_list_subscriptions");
    mockNotificationApi.listSubscriptions.mockResolvedValue([{ id: "s1" }]);

    const result = await handler({ targetId: "user-1", ids: ["s1", "s2"] });

    expect(mockNotificationApi.listSubscriptions).toHaveBeenCalledWith("user-1", ["s1", "s2"]);
    expect(result.content[0].text).toContain("s1");
  });

  it("list_subscriptions reports when none found", async () => {
    const handler = getHandler("notification_list_subscriptions");
    mockNotificationApi.listSubscriptions.mockResolvedValue([]);

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No notification subscriptions found");
  });

  it("get_subscription passes the id", async () => {
    const handler = getHandler("notification_get_subscription");
    mockNotificationApi.getSubscription.mockResolvedValue({ id: "s1" });

    const result = await handler({ subscriptionId: "s1" });

    expect(mockNotificationApi.getSubscription).toHaveBeenCalledWith("s1");
    expect(result.content[0].text).toContain("s1");
  });

  it("create_subscription passes the parameters", async () => {
    const handler = getHandler("notification_create_subscription");
    mockNotificationApi.createSubscription.mockResolvedValue({ id: "s2" });

    const subscription = { description: "my sub", filter: { eventType: "ms.vss-code.git-push-event" } };
    const result = await handler({ subscription });

    expect(mockNotificationApi.createSubscription).toHaveBeenCalledWith(subscription);
    expect(result.content[0].text).toContain("s2");
  });

  it("update_subscription passes parameters and id", async () => {
    const handler = getHandler("notification_update_subscription");
    mockNotificationApi.updateSubscription.mockResolvedValue({ id: "s2", description: "updated" });

    const subscription = { description: "updated" };
    const result = await handler({ subscriptionId: "s2", subscription });

    expect(mockNotificationApi.updateSubscription).toHaveBeenCalledWith(subscription, "s2");
    expect(result.content[0].text).toContain("updated");
  });

  it("delete_subscription deletes by id", async () => {
    const handler = getHandler("notification_delete_subscription");
    mockNotificationApi.deleteSubscription.mockResolvedValue(undefined);

    const result = await handler({ subscriptionId: "s2" });

    expect(mockNotificationApi.deleteSubscription).toHaveBeenCalledWith("s2");
    expect(result.content[0].text).toContain("Notification subscription s2 deleted");
  });

  it("list_event_types passes the publisher filter", async () => {
    const handler = getHandler("notification_list_event_types");
    mockNotificationApi.listEventTypes.mockResolvedValue([{ id: "ms.vss-code.git-push-event" }]);

    const result = await handler({ publisherId: "ms.vss-code" });

    expect(mockNotificationApi.listEventTypes).toHaveBeenCalledWith("ms.vss-code");
    expect(result.content[0].text).toContain("git-push-event");
  });

  it("get_event_type passes the id", async () => {
    const handler = getHandler("notification_get_event_type");
    mockNotificationApi.getEventType.mockResolvedValue({ id: "ms.vss-code.git-push-event" });

    const result = await handler({ eventType: "ms.vss-code.git-push-event" });

    expect(mockNotificationApi.getEventType).toHaveBeenCalledWith("ms.vss-code.git-push-event");
    expect(result.content[0].text).toContain("git-push-event");
  });

  it("list_subscription_templates returns templates", async () => {
    const handler = getHandler("notification_list_subscription_templates");
    mockNotificationApi.getSubscriptionTemplates.mockResolvedValue([{ id: "t1" }]);

    const result = await handler({});

    expect(mockNotificationApi.getSubscriptionTemplates).toHaveBeenCalled();
    expect(result.content[0].text).toContain("t1");
  });

  it("surfaces API errors", async () => {
    const handler = getHandler("notification_get_subscription");
    mockNotificationApi.getSubscription.mockRejectedValue(new Error("boom"));

    const result = await handler({ subscriptionId: "s1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching notification subscription: boom");
  });
});
