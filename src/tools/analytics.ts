// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Analytics OData: the reporting store behind Azure DevOps dashboards.
//
// WIQL returns work item ids and nothing else — it cannot count, sum, group
// or look back in time. Analytics can: `$apply=groupby(...)/aggregate(...)`
// answers "how many bugs per state" in one call, and the snapshot entity sets
// answer "how did this look on each day of the sprint". Without it the model
// has to page through every work item and aggregate by hand.
//
// The service lives on the `analytics` sibling host. The query options are
// taken as separate parameters rather than one raw query string, so the model
// cannot smuggle extra path segments or parameters into the URL.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

import { adoFetch, subdomainBaseUrl } from "../shared/ado-rest.js";
import { optionalProjectWith } from "../shared/common-params.js";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { registerTool } from "../shared/tool-registration.js";

const ANALYTICS_TOOLS = {
  list_entity_sets: "analytics_list_entity_sets",
  query: "analytics_query",
};

const ODATA_VERSION = "v4.0-preview";

/** Entity set names are plain identifiers; anything else would alter the URL path. */
const ENTITY_SET_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

function configureAnalyticsTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  async function odataBase(project: string | undefined): Promise<string> {
    const connection = await connectionProvider();
    const base = subdomainBaseUrl(connection.serverUrl, "analytics");
    return project ? `${base}/${encodeURIComponent(project)}/_odata/${ODATA_VERSION}` : `${base}/_odata/${ODATA_VERSION}`;
  }

  async function get(url: string): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
    const token = await tokenProvider();
    const response = await adoFetch({ url, method: "GET", token, userAgent: userAgentProvider() });
    const body = await response.text();
    if (!response.ok) {
      // OData reports a malformed query as {"error":{"code":..,"message":..}};
      // the message names the offending property, which is what the model needs.
      let message = body;
      try {
        message = JSON.parse(body)?.error?.message ?? body;
      } catch {
        // not JSON — keep the raw body
      }
      return { ok: false, message: `${response.status}: ${message}` };
    }
    return { ok: true, body };
  }

  const projectParam = optionalProjectWith("Omit to query across every project in the organization.");

  registerTool(
    server,
    ANALYTICS_TOOLS.list_entity_sets,
    "List the Analytics entity sets that can be queried — WorkItems, WorkItemSnapshot, WorkItemRevisions, Iterations, Areas, PipelineRuns, TestResultsDaily and others.",
    {
      project: projectParam,
    },
    async ({ project }) => {
      try {
        const result = await get(`${await odataBase(project)}/`);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error listing entity sets: ${result.message}` }], isError: true };
        }
        const names = (JSON.parse(result.body).value ?? []).map((entry: { name: string }) => entry.name);
        return { content: [{ type: "text", text: JSON.stringify(names, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing entity sets: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    ANALYTICS_TOOLS.query,
    "Query Analytics with OData. Use it for what WIQL cannot do: counts, sums and averages ($apply=groupby((State),aggregate($count as Count))), trends over time (WorkItemSnapshot filtered by DateSK), cycle time, pipeline and test pass rates. Property names differ from WIQL reference names — WorkItemId, Title, State, WorkItemType, AssignedTo/UserName, Iteration/IterationPath, Area/AreaPath. To discover an entity's properties, query it with top=1 and no select.",
    {
      project: projectParam,
      entitySet: z.string().regex(ENTITY_SET_PATTERN).describe("The entity set, e.g. 'WorkItems' or 'WorkItemSnapshot'. See analytics_list_entity_sets."),
      filter: z.string().optional().describe("$filter, e.g. \"WorkItemType eq 'Bug' and State ne 'Closed'\"."),
      select: z.string().optional().describe("$select, comma-separated properties, e.g. 'WorkItemId,Title,State'."),
      apply: z
        .string()
        .optional()
        .describe("$apply for aggregation, e.g. 'groupby((State), aggregate($count as Count))'. A filter inside it goes first: 'filter(WorkItemType eq ''Bug'')/groupby(...)'."),
      expand: z.string().optional().describe("$expand for navigation properties, e.g. 'AssignedTo($select=UserName)'."),
      orderby: z.string().optional().describe("$orderby, e.g. 'ChangedDate desc'."),
      top: z.number().int().positive().max(10000).default(200).describe("$top. Keep it small for row queries; aggregations return few rows anyway."),
      skip: z.number().int().nonnegative().optional().describe("$skip, for paging."),
    },
    async ({ project, entitySet, filter, select, apply, expand, orderby, top, skip }) => {
      try {
        const params = new URLSearchParams();
        if (apply) params.append("$apply", apply);
        if (filter) params.append("$filter", filter);
        if (select) params.append("$select", select);
        if (expand) params.append("$expand", expand);
        if (orderby) params.append("$orderby", orderby);
        params.append("$top", String(top));
        if (skip !== undefined) params.append("$skip", String(skip));

        const result = await get(`${await odataBase(project)}/${entitySet}?${params.toString()}`);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error querying ${entitySet}: ${result.message}` }], isError: true };
        }

        // Rows carry titles, names and other text people typed into Azure DevOps.
        return createExternalContentResponse(JSON.parse(result.body), `analytics ${entitySet}`);
      } catch (error) {
        return { content: [{ type: "text", text: `Error querying ${entitySet}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}

export { ANALYTICS_TOOLS, configureAnalyticsTools };
