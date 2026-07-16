// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { AlertType, AlertValidityStatus, Confidence, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces.js";
import { z } from "zod";
import { getEnumKeys, mapStringArrayToEnum, mapStringToEnum } from "../utils.js";

const ADVSEC_TOOLS = {
  get_alerts: "advsec_get_alerts",
  get_alert_details: "advsec_get_alert_details",
};

function configureAdvSecTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    ADVSEC_TOOLS.get_alerts,
    "Retrieve Advanced Security alerts for a repository. Results are scoped to the specified project and repository. Branch filters (onlyDefaultBranch, ref) apply only to code, dependency, and license alerts; they are not applicable to secret alerts and are ignored by the service, so they neither include nor exclude secrets. To narrow secret alerts by confidence, pass a single 'confidenceLevels' value ('High' or 'Other'); selecting every level is treated as no confidence filter.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      repository: z.string().describe("The name or ID of the repository to get alerts for."),
      alertType: z
        .enum(getEnumKeys(AlertType) as [string, ...string[]])
        .optional()
        .describe("Filter alerts by type. If not specified, returns all alert types."),
      states: z
        .array(z.enum(getEnumKeys(State) as [string, ...string[]]))
        .optional()
        .describe("Filter alerts by state. If not specified, returns alerts in any state."),
      severities: z
        .array(z.enum(getEnumKeys(Severity) as [string, ...string[]]))
        .optional()
        .describe("Filter alerts by severity level. If not specified, returns alerts at any severity."),
      ruleId: z.string().optional().describe("Filter alerts by rule ID."),
      ruleName: z.string().optional().describe("Filter alerts by rule name."),
      toolName: z.string().optional().describe("Filter alerts by tool name."),
      ref: z
        .string()
        .optional()
        .describe(
          "Filter non-secret alerts by git reference (branch), e.g. 'refs/heads/main'. When omitted and onlyDefaultBranch is true, only alerts on the default branch are returned. Not applicable to secret alerts and ignored by this tool when alertType is 'Secret'. When alertType is unspecified, this filter is still sent and may exclude secret alerts from the results; query alertType 'Secret' separately to retrieve all secrets."
        ),
      onlyDefaultBranch: z
        .boolean()
        .optional()
        .describe(
          "For non-secret alerts: if true (the service default when omitted) only return alerts found on the default branch; if false, return alerts from all branches. Ignored when 'ref' is provided. Not applicable to secret alerts and ignored by this tool when alertType is 'Secret'. When alertType is unspecified, this filter is still sent and may exclude secret alerts from the results; query alertType 'Secret' separately to retrieve all secrets."
        ),
      confidenceLevels: z
        .array(z.enum(getEnumKeys(Confidence) as [string, ...string[]]))
        .optional()
        .describe(
          "Only applicable to secret alerts. Accepted values are 'High' and 'Other'. Pass a single value (e.g. ['High']) to narrow secrets to that confidence level. Leave unset to return secrets without a confidence filter. Do not select both levels to widen results: the Alerts service does not accept a multi-value confidence filter and would return no alerts, so this tool treats an all-levels selection as no filter and omits it."
        ),
      validity: z
        .array(z.enum(getEnumKeys(AlertValidityStatus) as [string, ...string[]]))
        .optional()
        .describe(
          "Only applicable to secret alerts. If omitted, alerts of all validity statuses are returned (no validity filter is applied). Filtering by validity may return fewer alerts than 'top'; use the continuation token to fetch any remaining alerts."
        ),
      top: z.coerce.number().optional().default(100).describe("Maximum number of alerts to return. Defaults to 100."),
      orderBy: z.enum(["id", "firstSeen", "lastSeen", "fixedOn", "severity"]).optional().default("severity").describe("Order results by specified field. Defaults to 'severity'."),
      continuationToken: z.string().optional().describe("Continuation token for pagination."),
    },
    async ({ project, repository, alertType, states, severities, ruleId, ruleName, toolName, ref, onlyDefaultBranch, confidenceLevels, validity, top, orderBy, continuationToken }) => {
      try {
        const connection = await connectionProvider();
        const alertApi = await connection.getAlertApi();

        const normalizedAlertType = alertType?.toLowerCase();
        // "onlyDefaultBranch" and "ref" are not applicable to secret alerts (secrets are not
        // branch-scoped and carry a null gitRef). Forwarding them for a secret-only query diverges
        // from the REST API / Advanced Security UI and can incorrectly return no alerts, so only
        // include them when the query is not restricted to secret alerts.
        const isSecretOnly = normalizedAlertType === "secret";
        // "confidenceLevels" and "validity" only apply to secret alerts, so include them whenever
        // the result set can contain secrets (an explicit "secret" type or no type filter at all).
        const canIncludeSecrets = !alertType || isSecretOnly;

        // The Alerts service does not accept the multi-value (comma-serialized) confidence filter
        // that the SDK emits: selecting every level (e.g. both "High" and "Other") returns zero
        // alerts, and it is a no-op filter regardless. Only forward confidenceLevels when it
        // narrows the result to a proper subset (a single level); otherwise omit it so secrets are
        // returned without a confidence filter instead of an empty set.
        const confidenceLevelValues = confidenceLevels ? mapStringArrayToEnum(confidenceLevels, Confidence) : [];
        const narrowsByConfidence = confidenceLevelValues.length > 0 && confidenceLevelValues.length < getEnumKeys(Confidence).length;

        const criteria = {
          ...(alertType && { alertType: mapStringToEnum(alertType, AlertType) }),
          ...(states && { states: mapStringArrayToEnum(states, State) }),
          ...(severities && { severities: mapStringArrayToEnum(severities, Severity) }),
          ...(ruleId && { ruleId }),
          ...(ruleName && { ruleName }),
          ...(toolName && { toolName }),
          ...(!isSecretOnly && ref && { ref }),
          ...(!isSecretOnly && onlyDefaultBranch !== undefined && { onlyDefaultBranch }),
          ...(canIncludeSecrets && narrowsByConfidence && { confidenceLevels: confidenceLevelValues }),
          ...(canIncludeSecrets && validity && { validity: mapStringArrayToEnum(validity, AlertValidityStatus) }),
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
      alertId: z.coerce.number().min(1).describe("The ID of the alert to retrieve details for."),
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
