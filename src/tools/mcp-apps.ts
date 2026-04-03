// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { logger } from "../logger.js";
import { applyWorkItemFilters } from "../apps/shared/work-item-filters.js";
import { searchIdentities } from "./auth.js";

const MCP_APPS_TOOLS = {
  my_work_items: "mcp_app_my_work_items",
  preview_work_items: "mcp_app_preview_work_items",
  get_work_item_type_icon: "mcp_app_get_work_item_type_icon",
  get_work_item_type_fields: "mcp_app_get_work_item_type_fields",
  search_identities: "mcp_app_search_identities",
};

function configureMcpAppsTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): void {
  const distDir = path.join(import.meta.dirname, "..");

  // ========== Shared schemas for work items display tools ==========

  const workItemFilterSchema = {
    stateFilter: z.array(z.string()).optional().describe("Optional list of states to include (e.g. ['New', 'Active', 'In Progress']). If not provided, all states are returned."),
    workItemType: z.array(z.string()).optional().describe("Optional list of work item types to include (e.g. ['Bug', 'Task', 'User Story']). If not provided, all types are returned."),
    tags: z.array(z.string()).optional().describe("Optional list of tags to filter by. Returns work items that have ANY of the specified tags."),
    priorityFilter: z.array(z.number()).optional().describe("Optional list of priority values to include (1=Critical, 2=High, 3=Medium, 4=Low). If not provided, all priorities are returned."),
    areaPath: z.string().optional().describe("Optional area path prefix to filter by (e.g. 'OneITVSO\\My Area'). Matches work items whose area path starts with this value."),
    iterationPath: z.string().optional().describe("Optional iteration path prefix to filter by (e.g. 'OneITVSO\\Sprint 1'). Matches work items whose iteration path starts with this value."),
    searchText: z.string().optional().describe("Optional text to search for in work item title or description. Case-insensitive partial match."),
  };

  const columnSchema = z
    .array(
      z.object({
        field: z.string().describe("Azure DevOps field reference name (e.g., 'System.Title', 'Microsoft.VSTS.Common.Priority')."),
        label: z.string().optional().describe("Custom display label for the column header. Defaults to a human-readable name derived from the field."),
        width: z.number().optional().describe("Column width in pixels. Omit for auto-sized columns."),
      })
    )
    .optional();

  const sortSchema = z
    .object({
      field: z.string().describe("Field reference name to sort by (e.g., 'Microsoft.VSTS.Common.Priority')."),
      direction: z.enum(["asc", "desc"]).default("desc").describe("Sort direction. Defaults to 'desc'."),
    })
    .optional()
    .describe("Initial sort configuration. Users can change the sort by clicking column headers.");

  const suggestedValuesSchema = z
    .array(
      z.object({
        workItemId: z.number().describe("Work item ID to apply suggestion to."),
        field: z.string().describe("Field reference name to suggest a value for (e.g., 'Microsoft.VSTS.Common.Priority')."),
        value: z.union([z.string(), z.number()]).describe("Suggested field value."),
        reason: z.string().optional().describe("Brief explanation of why this value is suggested."),
      })
    )
    .optional()
    .describe("Agent-provided suggested field values for specific work items. These are shown with visual distinction and can be accepted or dismissed by the user.");

  const workItemDisplaySchema = {
    columns: columnSchema.describe(
      "Columns to display in the table. Do NOT populate this parameter unless the user EXPLICITLY requests specific columns. The UI defaults to ID, Title, Type, State, Assigned To when this is omitted — which is the preferred behavior for most requests. Only populate when the user explicitly names columns (e.g. 'show me ID, title, and story points'). Map common names: ID=System.Id, Title=System.Title, State=System.State, Type=System.WorkItemType, Assigned To=System.AssignedTo, Priority=Microsoft.VSTS.Common.Priority, Tags=System.Tags, Area Path=System.AreaPath, Iteration Path=System.IterationPath."
    ),
    sort: sortSchema,
    suggestedValues: suggestedValuesSchema,
    pageSize: z.number().optional().default(10).describe("Number of items per page. Defaults to 10. Use higher values (50-100) for bulk review workflows."),
  };

  // ========== Shared helpers for work items display ==========

  /** Format identity fields from objects to simple "Name <email>" strings */
  function formatIdentityFields(workItems: any[]): void {
    for (const item of workItems) {
      if (!item.fields) continue;
      for (const [fieldName, fieldValue] of Object.entries(item.fields)) {
        if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
          const obj = fieldValue as Record<string, unknown>;
          if (obj.displayName !== undefined || obj.uniqueName !== undefined) {
            const name = String(obj.displayName || "");
            const email = String(obj.uniqueName || "");
            item.fields[fieldName] = email ? `${name} <${email}>`.trim() : name;
          }
        }
      }
    }
  }

  /** Build displayConfig with only explicitly-set keys */
  function buildDisplayConfig(args: { columns?: unknown; sort?: unknown; suggestedValues?: unknown; pageSize?: number | null }): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    if (args.columns) config.columns = args.columns;
    if (args.sort) config.sort = args.sort;
    if (args.suggestedValues) config.suggestedValues = args.suggestedValues;
    if (args.pageSize != null) config.pageSize = args.pageSize;
    return config;
  }

  /** Build the standard work items response with displayConfig */
  function buildWorkItemsResponse(workItems: any[], displayConfig: Record<string, unknown>) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ workItems, displayConfig }, null, 2),
        },
      ],
    };
  }

  // ========== WORK ITEMS APP (MCP App with interactive UI) ==========
  const workItemsAppResourceUri = "ui://work-items/app.html";

  registerAppTool(
    server,
    MCP_APPS_TOOLS.my_work_items,
    {
      title: "My Work Items",
      description:
        "Opens an interactive work items table UI to view and manage the current user's own Azure DevOps work items. Always scoped to the authenticated user — results are automatically filtered to items assigned to the current user. Supports two modes: (1) Personal queries via 'type' parameter (assignedtome/myactivity) for a quick view of your own work, or (2) Team iteration queries via 'team' + 'iterationId' parameters to show your work items within a specific team sprint. When the user says 'show my work items for team X sprint Y', provide 'team' and 'iterationId' — the tool will automatically filter to only the current user's items. IMPORTANT: Do NOT populate the 'columns' parameter unless the user EXPLICITLY requests specific columns to display. The UI already provides a sensible default layout (ID, Title, Type, State, Assigned To). Only when the user says something like 'show ID, title, and state' or 'add story points column', map those to the columns parameter using field reference names: ID=System.Id, Title=System.Title, State=System.State, Type=System.WorkItemType, Assigned To=System.AssignedTo, Priority=Microsoft.VSTS.Common.Priority, Tags=System.Tags, Area Path=System.AreaPath, Iteration Path=System.IterationPath, Created Date=System.CreatedDate, Changed Date=System.ChangedDate, Description=System.Description, Reason=System.Reason, Story Points=Microsoft.VSTS.Scheduling.StoryPoints, Original Estimate=Microsoft.VSTS.Scheduling.OriginalEstimate, Remaining Work=Microsoft.VSTS.Scheduling.RemainingWork. Supports configurable sorting, filtering, and optional agent-suggested values.",
      inputSchema: {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        type: z
          .enum(["assignedtome", "myactivity"])
          .default("assignedtome")
          .describe(
            "The type of personal work items query. 'assignedtome' returns items assigned to the current user. 'myactivity' returns items recently modified by the current user. Ignored when 'team' and 'iterationId' are provided. Defaults to 'assignedtome'."
          ),
        team: z.string().optional().describe("The name or ID of the Azure DevOps team. When provided with 'iterationId', fetches the current user's work items from that team's iteration/sprint."),
        iterationId: z
          .string()
          .optional()
          .describe("The ID of the iteration (sprint) to retrieve the current user's work items for. Must be used together with 'team'. Get this via the work_list_team_iterations tool."),
        top: z.number().default(50).describe("The maximum number of work items to return. Defaults to 50."),
        includeCompleted: z.boolean().default(false).describe("Whether to include completed work items. Defaults to false."),
        ...workItemFilterSchema,
        ...workItemDisplaySchema,
      },
      _meta: { ui: { resourceUri: workItemsAppResourceUri } },
    },
    async (args) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        // Resolve the current authenticated user for filtering
        const connectionData = await connection.connect();
        const currentUserName = connectionData.authenticatedUser?.providerDisplayName ?? connectionData.authenticatedUser?.customDisplayName ?? "";

        let ids: number[];

        if (args.team && args.iterationId) {
          // Team iteration mode: fetch all work items for the team's sprint, then filter to current user
          const workApi = await connection.getWorkApi();
          const iterationWorkItems = await workApi.getIterationWorkItems({ project: args.project, team: args.team }, args.iterationId);
          const relations: { rel: string | null; source: { id: number } | null; target: { id: number } }[] = (iterationWorkItems as any)?.workItemRelations ?? [];
          const idSet = new Set<number>();
          for (const rel of relations) {
            if (rel.target?.id) idSet.add(rel.target.id);
          }
          ids = [...idSet];
        } else {
          // Personal query mode: use predefined queries
          const workApi = await connection.getWorkApi();
          const queryResult = await workApi.getPredefinedQueryResults(args.project, args.type ?? "assignedtome", args.top ?? 50, args.includeCompleted ?? false);
          const queryData = queryResult as any;
          const results: { id?: number }[] = queryData?.results ?? queryData?.workItems ?? (Array.isArray(queryData) ? queryData : []);
          ids = results.map((wi: { id?: number }) => wi.id).filter((id: number | undefined): id is number => id !== undefined);
        }

        if (ids.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify([], null, 2) }],
          };
        }

        // Apply top limit for team iteration queries (personal queries are already limited)
        if (args.team && args.iterationId && args.top) {
          ids = ids.slice(0, args.top);
        }

        // Fetch all fields for work items
        let workItems = await workItemApi.getWorkItemsBatch({ ids }, args.project);

        // Apply filters scoped to current user
        if (workItems && Array.isArray(workItems)) {
          const filterArgs: Record<string, unknown> = { ...args };
          if (currentUserName) {
            filterArgs.assignedTo = [currentUserName];
          }
          workItems = applyWorkItemFilters(workItems, filterArgs);
          formatIdentityFields(workItems);
        }

        return buildWorkItemsResponse(workItems ?? [], buildDisplayConfig(args));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // ========== PREVIEW WORK ITEMS (Generic work items preview via IDs) ==========
  registerAppTool(
    server,
    MCP_APPS_TOOLS.preview_work_items,
    {
      title: "Preview Work Items",
      description:
        "Opens an interactive work items table UI to preview any Azure DevOps work items by their IDs. Use this tool to display work items returned by other MCP tools (e.g. from queries, search results, or linked items) in a rich interactive table. Unlike 'My Work Items', this tool is NOT scoped to the current user — it displays whatever work item IDs are provided. Callers should pass work item IDs obtained from other tool responses. Supports configurable columns, sorting, filtering, and optional agent-suggested values. IMPORTANT: Do NOT populate the 'columns' parameter unless the user EXPLICITLY requests specific columns to display.",
      inputSchema: {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        ids: z.array(z.number()).min(1).max(200).describe("Array of work item IDs to preview. Obtain these from other MCP tool responses (e.g. work item queries, search results, linked items)."),
        ...workItemFilterSchema,
        ...workItemDisplaySchema,
      },
      _meta: { ui: { resourceUri: workItemsAppResourceUri } },
    },
    async (args) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();

        let workItems = await workItemApi.getWorkItemsBatch({ ids: args.ids }, args.project);

        if (workItems && Array.isArray(workItems)) {
          workItems = applyWorkItemFilters(workItems, args);
          formatIdentityFields(workItems);
        }

        return buildWorkItemsResponse(workItems ?? [], buildDisplayConfig(args));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error previewing work items: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  registerAppResource(server, workItemsAppResourceUri, workItemsAppResourceUri, { mimeType: RESOURCE_MIME_TYPE }, async () => {
    try {
      const html = await fs.readFile(path.join(distDir, "work-items-app.html"), "utf-8");
      return {
        contents: [{ uri: workItemsAppResourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    } catch (error) {
      logger.warn("Work Items App UI not found. Run 'npm run build:ui' to generate it.", { error });
      return {
        contents: [{ uri: workItemsAppResourceUri, mimeType: RESOURCE_MIME_TYPE, text: "<html><body>Work Items App UI not built. Run npm run build:ui</body></html>" }],
      };
    }
  });

  // --- Get Work Item Type Icon ---
  registerAppTool(
    server,
    MCP_APPS_TOOLS.get_work_item_type_icon,
    {
      title: "Get Work Item Type Icon",
      description: "Get the SVG icon for a work item type. Returns the raw SVG markup that can be rendered directly.",
      inputSchema: {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        workItemType: z.string().describe("The name of the work item type (e.g., 'Bug', 'Task', 'User Story')."),
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItemTypeInfo = await workItemApi.getWorkItemType(args.project, args.workItemType);
        const iconUrl = workItemTypeInfo.icon?.url;
        if (!iconUrl) {
          return { content: [{ type: "text", text: "No icon URL found for this work item type." }], isError: true };
        }
        const accessToken = await tokenProvider();
        const resp = await fetch(iconUrl, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": userAgentProvider(),
          },
        });
        if (!resp.ok) {
          return { content: [{ type: "text", text: `Failed to fetch icon: ${resp.status} ${resp.statusText}` }], isError: true };
        }
        const svgText = await resp.text();
        return {
          content: [{ type: "text", text: JSON.stringify({ workItemType: args.workItemType, svg: svgText }) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work item type icon: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- Identity Search (app-only, for people-picker typeahead) ---
  registerAppTool(
    server,
    MCP_APPS_TOOLS.get_work_item_type_fields,
    {
      title: "Get Work Item Type Fields",
      description: "Get field definitions with allowed values for a work item type. Uses the expanded field API to return proper allowed values for picklist fields like Priority and Severity.",
      inputSchema: {
        project: z.string().describe("The name or ID of the Azure DevOps project."),
        workItemType: z.string().describe("The name of the work item type (e.g., 'Bug', 'Task', 'User Story')."),
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      try {
        const connection = await connectionProvider();
        const workItemApi = await connection.getWorkItemTrackingApi();
        // expand=AllowedValues (1) returns proper allowedValues for all fields including integer picklists
        const fields = await workItemApi.getWorkItemTypeFieldsWithReferences(args.project, args.workItemType, 1);
        const result = (fields ?? []).map((f) => ({
          referenceName: f.referenceName ?? "",
          name: f.name ?? "",
          allowedValues: Array.isArray(f.allowedValues) ? f.allowedValues.map(String) : [],
        }));
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error retrieving field definitions: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- Identity Search (app-only, for people-picker typeahead) ---
  registerAppTool(
    server,
    MCP_APPS_TOOLS.search_identities,
    {
      title: "Search Identities",
      description: "Search for Azure DevOps identities by name, email, or alias. Returns matching users for people-picker typeahead.",
      inputSchema: {
        query: z.string().min(2).describe("The search string (display name, email, or alias). Minimum 2 characters."),
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ query }) => {
      try {
        // Search with the full query and individual words for better coverage
        const searchTerms = new Set<string>([query]);
        for (const word of query.split(/\s+/)) {
          if (word.length >= 2) searchTerms.add(word);
        }

        const allIdentities = new Map<string, { id: string; displayName: string; mail: string }>();

        await Promise.all(
          [...searchTerms].map(async (term) => {
            try {
              const result = await searchIdentities(term, tokenProvider, connectionProvider, userAgentProvider);
              if (result?.value) {
                for (const identity of result.value) {
                  if (identity.id && identity.providerDisplayName && !identity.properties?.SchemaClassName?.["$value"]?.includes("Group")) {
                    allIdentities.set(identity.id, {
                      id: identity.id,
                      displayName: identity.providerDisplayName,
                      mail: (identity.properties?.Mail as any)?.["$value"] ?? "",
                    });
                  }
                }
              }
            } catch {
              // Individual term search failed, continue with others
            }
          })
        );

        // Sort: prioritize results where all query words match
        const lowerWords = query.toLowerCase().split(/\s+/).filter(Boolean);
        const sorted = [...allIdentities.values()].sort((a, b) => {
          const aName = a.displayName.toLowerCase();
          const bName = b.displayName.toLowerCase();
          const aAllMatch = lowerWords.every((w) => aName.includes(w));
          const bAllMatch = lowerWords.every((w) => bName.includes(w));
          if (aAllMatch !== bAllMatch) return aAllMatch ? -1 : 1;
          return aName.localeCompare(bName);
        });

        const identities = sorted.slice(0, 10);
        return { content: [{ type: "text", text: JSON.stringify(identities) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error searching identities: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { configureMcpAppsTools, MCP_APPS_TOOLS };
