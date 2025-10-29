// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { Alert, AlertType, AlertValidityStatus, Confidence, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces";
import { PagedList } from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { configureAdvSecTools } from "../../../src/tools/advanced-security";

type TokenProviderMock = () => Promise<string>;
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
    it("should call getAlerts API with correct parameters and return multiple alerts", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [
        {
          alertId: 1,
          state: State.Active,
          severity: Severity.High,
          alertType: AlertType.Code,
          title: "SQL Injection vulnerability",
          physicalLocations: [
            {
              filePath: "src/database.js",
              region: {
                lineStart: 15,
                lineEnd: 17,
              },
            },
          ],
        },
        {
          alertId: 2,
          state: State.Active,
          severity: Severity.Medium,
          alertType: AlertType.Code,
          title: "Cross-site scripting (XSS) vulnerability",
          physicalLocations: [
            {
              filePath: "src/ui/form.js",
              region: {
                lineStart: 42,
                lineEnd: 45,
              },
            },
          ],
        },
        {
          alertId: 3,
          state: State.Active,
          severity: Severity.Low,
          alertType: AlertType.Dependency,
          title: "Outdated dependency with known vulnerability",
          physicalLocations: [
            {
              filePath: "package.json",
              region: {
                lineStart: 25,
                lineEnd: 25,
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

      expect(result.isError).toBeUndefined();
      const returnedAlerts = JSON.parse(result.content[0].text);
      expect(result.content[0].text).toBe(JSON.stringify(returnedAlerts, null, 2));
      expect(returnedAlerts).toHaveLength(3);
      expect(returnedAlerts[0].alertId).toBe(1);
      expect(returnedAlerts[0].title).toBe("SQL Injection vulnerability");
      expect(returnedAlerts[1].alertId).toBe(2);
      expect(returnedAlerts[1].title).toBe("Cross-site scripting (XSS) vulnerability");
      expect(returnedAlerts[2].alertId).toBe(3);
      expect(returnedAlerts[2].title).toBe("Outdated dependency with known vulnerability");
    });

    it("should handle pagination with continuation token", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      // First call - returns first page (simulating PagedList without continuation token in response)
      const firstPageMockResult: PagedList<Alert> = [
        {
          alertId: 1,
          state: State.Active,
          severity: Severity.High,
          alertType: AlertType.Secret,
          title: "AWS access key in code",
          physicalLocations: [
            {
              filePath: "src/aws-client.js",
              region: {
                lineStart: 5,
                lineEnd: 5,
              },
            },
          ],
        },
        {
          alertId: 2,
          state: State.Active,
          severity: Severity.Medium,
          alertType: AlertType.Secret,
          title: "GitHub token exposed",
          physicalLocations: [
            {
              filePath: "src/github-api.js",
              region: {
                lineStart: 12,
                lineEnd: 12,
              },
            },
          ],
        },
      ];
      firstPageMockResult.continuationToken = "next-page-token-abc123";

      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValueOnce(firstPageMockResult);

      const firstParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "secret",
        states: ["active"],
        severities: ["medium", "high"],
        top: 2,
      };

      const firstResult = await handler(firstParams);

      // Verify first call
      expect(mockAlertApi.getAlerts).toHaveBeenCalledWith(
        "test-project",
        "test-repo",
        2, // top
        undefined, // orderBy
        {
          alertType: AlertType.Secret,
          states: [State.Active],
          severities: [Severity.Medium, Severity.High],
        },
        undefined, // expand
        undefined // continuationToken
      );

      // Second call
      const secondPageMockResult: PagedList<Alert> = [
        {
          alertId: 3,
          state: State.Active,
          severity: Severity.High,
          alertType: AlertType.Secret,
          title: "Database password in plaintext",
          physicalLocations: [
            {
              filePath: "src/database/connection.js",
              region: {
                lineStart: 8,
                lineEnd: 8,
              },
            },
          ],
        },
        {
          alertId: 4,
          state: State.Active,
          severity: Severity.Medium,
          alertType: AlertType.Secret,
          title: "API key in configuration file",
          physicalLocations: [
            {
              filePath: "config/production.json",
              region: {
                lineStart: 15,
                lineEnd: 15,
              },
            },
          ],
        },
      ];

      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValueOnce(secondPageMockResult);

      const secondParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "secret",
        states: ["active"],
        severities: ["medium", "high"],
        top: 2,
        continuationToken: "next-page-token-abc123",
      };

      const secondResult = await handler(secondParams);

      // Verify second call with continuation token
      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        2, // top
        undefined, // orderBy
        {
          alertType: AlertType.Secret,
          states: [State.Active],
          severities: [Severity.Medium, Severity.High],
        },
        undefined, // expand
        "next-page-token-abc123" // continuationToken
      );

      // Verify both results
      expect(firstResult.isError).toBeUndefined();
      expect(secondResult.isError).toBeUndefined();

      const firstPageAlerts = JSON.parse(firstResult.content[0].text);
      const secondPageAlerts = JSON.parse(secondResult.content[0].text);

      // Verify we get different alerts for each page
      expect(firstPageAlerts).toHaveLength(2);
      expect(firstPageAlerts[0].alertId).toBe(1);
      expect(firstPageAlerts[1].alertId).toBe(2);

      expect(secondPageAlerts).toHaveLength(2);
      expect(secondPageAlerts[0].alertId).toBe(3);
      expect(secondPageAlerts[1].alertId).toBe(4);

      // Verify both pages have secret alert types
      expect(firstPageAlerts[0].alertType).toBe(AlertType.Secret);
      expect(firstPageAlerts[1].alertType).toBe(AlertType.Secret);
      expect(secondPageAlerts[0].alertType).toBe(AlertType.Secret);
      expect(secondPageAlerts[1].alertType).toBe(AlertType.Secret);
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

    it("should conditionally include confidenceLevels and validity only for secret alerts", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [
        {
          alertId: 123,
          alertType: AlertType.Secret,
          state: State.Active,
          severity: Severity.High,
        },
      ];

      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      // Test 1: Secret alert type - should include confidenceLevels and validity
      const secretParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "secret",
        confidenceLevels: ["high"],
        validity: ["active"],
      };

      await handler(secretParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top
        undefined, // orderBy
        expect.objectContaining({
          alertType: AlertType.Secret,
          confidenceLevels: [Confidence.High],
          validity: [AlertValidityStatus.Active],
        }),
        undefined, // expand
        undefined // continuationToken
      );

      // Test 2: Code alert type - should NOT include confidenceLevels and validity
      const codeParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "code",
        confidenceLevels: ["high"],
        validity: ["active"],
      };

      await handler(codeParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top
        undefined, // orderBy
        expect.objectContaining({
          alertType: AlertType.Code,
        }),
        undefined, // expand
        undefined // continuationToken
      );

      // Verify that confidenceLevels and validity are NOT in the criteria for code alerts
      const lastCall = (mockAlertApi.getAlerts as jest.Mock).mock.calls[1];
      const criteriaForCodeAlert = lastCall[4];
      expect(criteriaForCodeAlert).not.toHaveProperty("confidenceLevels");
      expect(criteriaForCodeAlert).not.toHaveProperty("validity");

      // Test 3: No alert type specified - should include confidenceLevels and validity (allowing all types including secrets)
      const noTypeParams = {
        project: "test-project",
        repository: "test-repo",
        confidenceLevels: ["high"],
        validity: ["active"],
      };

      await handler(noTypeParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top
        undefined, // orderBy
        expect.objectContaining({
          confidenceLevels: [Confidence.High],
          validity: [AlertValidityStatus.Active],
        }),
        undefined, // expand
        undefined // continuationToken
      );
    });

    it("should handle optional parameters correctly when not provided", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [];
      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      // Test with minimal parameters - only required ones
      const minimalParams = {
        project: "test-project",
        repository: "test-repo",
      };

      await handler(minimalParams);

      // When optional parameters aren't provided, they remain undefined
      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top (optional, no default applied by handler)
        undefined, // orderBy (optional, no default applied by handler)
        {}, // empty criteria object since no optional filters provided
        undefined, // expand
        undefined // continuationToken
      );
    });

    it("should include all optional parameters when provided", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [];
      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      // Test with all optional parameters provided
      const allParamsParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "dependency",
        states: ["active", "dismissed"],
        severities: ["high", "medium"],
        ruleId: "rule123",
        ruleName: "security-rule",
        toolName: "CodeQL",
        ref: "refs/heads/main",
        onlyDefaultBranch: false,
        top: 50,
        orderBy: "id",
        continuationToken: "token123",
      };

      await handler(allParamsParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        50, // top
        "id", // orderBy
        expect.objectContaining({
          alertType: AlertType.Dependency,
          states: [State.Active, State.Dismissed],
          severities: [Severity.High, Severity.Medium],
          ruleId: "rule123",
          ruleName: "security-rule",
          toolName: "CodeQL",
          ref: "refs/heads/main",
          onlyDefaultBranch: false,
        }),
        undefined, // expand
        "token123" // continuationToken
      );

      // Verify all optional fields are included
      const lastCall = (mockAlertApi.getAlerts as jest.Mock).mock.calls[0];
      const criteria = lastCall[4];
      expect(criteria).toHaveProperty("alertType", AlertType.Dependency);
      expect(criteria).toHaveProperty("states", [State.Active, State.Dismissed]);
      expect(criteria).toHaveProperty("severities", [Severity.High, Severity.Medium]);
      expect(criteria).toHaveProperty("ruleId", "rule123");
      expect(criteria).toHaveProperty("ruleName", "security-rule");
      expect(criteria).toHaveProperty("toolName", "CodeQL");
      expect(criteria).toHaveProperty("ref", "refs/heads/main");
      expect(criteria).toHaveProperty("onlyDefaultBranch", false);
    });

    it("should handle onlyDefaultBranch parameter correctly", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [];
      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      // Test with onlyDefaultBranch explicitly set to false
      const falseParams = {
        project: "test-project",
        repository: "test-repo",
        onlyDefaultBranch: false,
      };

      await handler(falseParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top (not provided)
        undefined, // orderBy (not provided)
        expect.objectContaining({
          onlyDefaultBranch: false,
        }),
        undefined, // expand
        undefined // continuationToken
      );

      // Test with onlyDefaultBranch explicitly set to true
      const trueParams = {
        project: "test-project",
        repository: "test-repo",
        onlyDefaultBranch: true,
      };

      await handler(trueParams);

      expect(mockAlertApi.getAlerts).toHaveBeenLastCalledWith(
        "test-project",
        "test-repo",
        undefined, // top (not provided)
        undefined, // orderBy (not provided)
        expect.objectContaining({
          onlyDefaultBranch: true,
        }),
        undefined, // expand
        undefined // continuationToken
      );
    });

    it("should handle secret alerts without confidenceLevels or validity", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      const mockResult: PagedList<Alert> = [];
      (mockAlertApi.getAlerts as jest.Mock).mockResolvedValue(mockResult);

      // Test secret alert without confidenceLevels or validity explicitly provided
      const secretWithoutParams = {
        project: "test-project",
        repository: "test-repo",
        alertType: "secret",
      };

      await handler(secretWithoutParams);

      const lastCall = (mockAlertApi.getAlerts as jest.Mock).mock.calls[0];
      const criteria = lastCall[4];
      expect(criteria).toHaveProperty("alertType", AlertType.Secret);
      // confidenceLevels and validity should not be included if not explicitly provided
      expect(criteria).not.toHaveProperty("confidenceLevels");
      expect(criteria).not.toHaveProperty("validity");
    });

    it("should handle non-Error exception types", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alerts");
      if (!call) throw new Error("advsec_get_alerts tool not registered");
      const [, , , handler] = call;

      // Test with non-Error exception (string)
      (mockAlertApi.getAlerts as jest.Mock).mockRejectedValue("String error");

      const params = {
        project: "test-project",
        repository: "test-repo",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching Advanced Security alerts: Unknown error occurred");
    });
  });

  describe("advsec_get_alert_details tool", () => {
    it("should fetch specific alert details", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      const mockResult: Alert = {
        alertId: 1,
        state: State.Active,
        severity: Severity.High,
        alertType: AlertType.Code,
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

    it("should fetch specific alert details with ref parameter", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      const mockResult: Alert = {
        alertId: 1,
        state: State.Active,
        severity: Severity.High,
        alertType: AlertType.Code,
        title: "Test security alert",
      };

      (mockAlertApi.getAlert as jest.Mock).mockResolvedValue(mockResult);

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertId: 1,
        ref: "refs/heads/feature-branch",
      };

      const result = await handler(params);

      expect(mockAlertApi.getAlert).toHaveBeenCalledWith(
        "test-project",
        1,
        "test-repo",
        "refs/heads/feature-branch", // ref
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

    it("should handle non-Error exception types", async () => {
      configureAdvSecTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "advsec_get_alert_details");
      if (!call) throw new Error("advsec_get_alert_details tool not registered");
      const [, , , handler] = call;

      // Test with non-Error exception (string)
      (mockAlertApi.getAlert as jest.Mock).mockRejectedValue("String error");

      const params = {
        project: "test-project",
        repository: "test-repo",
        alertId: 999,
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching alert details: Unknown error occurred");
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
