// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { AlertType, AlertValidityStatus, Confidence, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces.js";
import { z } from "zod";
import { createEnumMapping, mapStringToEnum } from "../utils.js";

const ADVSEC_TOOLS = {
  get_alerts: "advsec_get_alerts",
  get_alert_details: "advsec_get_alert_details",
};

function configureAdvSecTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    ADVSEC_TOOLS.get_alerts,
    "Retrieve Advanced Security alerts for a repository.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repository: z.string().describe("The name or ID of the repository to get alerts for."),
      alertType: z.enum(["code", "dependency", "secret", "unknown"]).optional().describe("Filter alerts by type. If not specified, returns all alert types."),
      states: z
        .array(z.enum(["active", "dismissed", "fixed", "autoDismissed", "unknown"]))
        .optional()
        .describe("Filter alerts by state. If not specified, returns alerts in any state."),
      severities: z
        .array(z.enum(["critical", "high", "medium", "low", "note", "error", "warning", "undefined"]))
        .optional()
        .describe("Filter alerts by severity level. If not specified, returns alerts at any severity."),
      ruleId: z.string().optional().describe("Filter alerts by rule ID."),
      ruleName: z.string().optional().describe("Filter alerts by rule name."),
      toolName: z.string().optional().describe("Filter alerts by tool name."),
      ref: z.string().optional().describe("Filter alerts by git reference (branch). If not provided and onlyDefaultBranch is true, only includes alerts from default branch."),
      onlyDefaultBranch: z.boolean().optional().default(true).describe("If true, only return alerts found on the default branch. Defaults to true."),
      confidenceLevels: z
        .array(z.enum(["high", "other"]))
        .optional()
        .default(["high", "other"])
        .describe("Filter alerts by confidence levels. Only applicable for secret alerts. Defaults to both 'high' and 'other'."),
      validity: z
        .array(z.enum(["active", "inactive", "none", "unknown"]))
        .optional()
        .describe("Filter alerts by validity status. Only applicable for secret alerts."),
      top: z.number().optional().default(100).describe("Maximum number of alerts to return. Defaults to 100."),
      orderBy: z.enum(["id", "firstSeen", "lastSeen", "fixedOn", "severity"]).optional().default("severity").describe("Order results by specified field. Defaults to 'severity'."),
      continuationToken: z.string().optional().describe("Continuation token for pagination."),
    },
    async ({ project, repository, alertType, states, severities, ruleId, ruleName, toolName, ref, onlyDefaultBranch, confidenceLevels, validity, top, orderBy, continuationToken }) => {
      try {
        const connection = await connectionProvider();
        const alertApi = await connection.getAlertApi();

        const criteria = {
          ...(alertType && { alertType: mapStringToEnum(alertType, createEnumMapping(AlertType)) }),
          ...(states && { states: states.map((state) => mapStringToEnum(state, createEnumMapping(State))).filter((s): s is State => s !== undefined) }),
          ...(severities && { severities: severities.map((severity) => mapStringToEnum(severity, createEnumMapping(Severity))).filter((s): s is Severity => s !== undefined) }),
          ...(ruleId && { ruleId }),
          ...(ruleName && { ruleName }),
          ...(toolName && { toolName }),
          ...(ref && { ref }),
          ...(onlyDefaultBranch !== undefined && { onlyDefaultBranch }),
          ...(confidenceLevels && { confidenceLevels: confidenceLevels.map((level) => mapStringToEnum(level, createEnumMapping(Confidence))).filter((c): c is Confidence => c !== undefined) }),
          ...(validity && { validity: validity.map((v) => mapStringToEnum(v, createEnumMapping(AlertValidityStatus))).filter((v): v is AlertValidityStatus => v !== undefined) }),
        };

        const result = await alertApi.getAlerts(
          project,
          repository,
          top,
          orderBy,
          criteria,
          undefined, // expand parameter
          continuationToken
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [
            {
              type: "text",
              text: `Error fetching Advanced Security alerts: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    ADVSEC_TOOLS.get_alert_details,
    "Get detailed information about a specific Advanced Security alert.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repository: z.string().describe("The name or ID of the repository containing the alert."),
      alertId: z.number().describe("The ID of the alert to retrieve details for."),
      ref: z.string().optional().describe("Git reference (branch) to filter the alert."),
    },
    async ({ project, repository, alertId, ref }) => {
      try {
        const connection = await connectionProvider();
        const alertApi = await connection.getAlertApi();

        const result = await alertApi.getAlert(
          project,
          alertId,
          repository,
          ref,
          undefined // expand parameter
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return {
          content: [
            {
              type: "text",
              text: `Error fetching alert details: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { ADVSEC_TOOLS, configureAdvSecTools };
