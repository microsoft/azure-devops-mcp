import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { AlertType, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces";
import { configureAdvSecTools } from "../../../src/tools/advsec";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface AlertApiMock {
  getAlerts: jest.Mock;
  getAlert: jest.Mock;
}

describe("configureAdvSecTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getAlertApi: jest.Mock };
  let mockAlertApi: AlertApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockAlertApi = {
      getAlerts: jest.fn(),
      getAlert: jest.fn(),
    };

    mockConnection = {
      getAlertApi: jest.fn().mockResolvedValue(mockAlertApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers Advanced Security tools on the server", () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("advsec_get_alerts tool", () => {
    it("should call getAlerts API with correct parameters and return alerts", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult = [
        {
          alertId: 1,
          state: "active",
          severity: "high",
          alertType: "code",
          title: "Test security alert",
          physicalLocations: [
            {
              filePath: "src/test.js",
              region: {
                lineStart: 10,
                lineEnd: 12,
              },
            },
          ],
        },
      ];

      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertType: "code",
        states: ["active"],
        severities: ["high"],
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlerts).toHaveBeenCalledWith(
        "test-project",
        "test-repo",
        undefined, // top
        undefined, // orderBy
        {
          alertType: AlertType.Code,
          states: [State.Active],
          severities: [Severity.High],
        },
        undefined, // expand
        undefined // continuationToken
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Failed to retrieve alerts");
      (mockAlertApi.getAlerts as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "test-project",
        repository: "test-repo",
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlerts).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching Advanced Security alerts: Failed to retrieve alerts");
    });

    it("should handle null API results correctly", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "test-project",
        repository: "test-repo",
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlerts).toHaveBeenCalled();
      expect(result.content[0].text).toBe("null");
    });
  });

  describe("advsec_get_alert_details tool", () => {
    it("should fetch specific alert details", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      const mockResult = {
        alertId: 1,
        state: "active",
        severity: "high",
        alertType: "code",
        title: "Test security alert",
        physicalLocations: [
          {
            filePath: "src/test.js",
            region: {
              lineStart: 10,
              lineEnd: 12,
            },
          },
        ],
      };

      (mockAlertApi.getAlert as jest.Mock).mockResolvedValue(mockResult);

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertId: 1,
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlert).toHaveBeenCalledWith(
        "test-project",
        1,
        "test-repo",
        undefined, // ref
        undefined // expand
      );

      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors correctly", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      const testError = new Error("Alert not found");
      (mockAlertApi.getAlert as jest.Mock).mockRejectedValue(testError);

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertId: 999,
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlert).toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching alert details: Alert not found");
    });

    it("should handle null API results correctly", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      (mockAlertApi.getAlert as jest.Mock).mockResolvedValue(null);

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertId: 1,
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlert).toHaveBeenCalled();
      expect(result.content[0].text).toBe("null");
    });
  });
});
