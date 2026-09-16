// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// MCP resources: reference material the model can pull in, as opposed to tools
// it calls to act.
//
// Two kinds are served here. The WIQL reference is static text that no Azure
// DevOps call can produce — the query syntax, its macros, and the conventions
// that the model otherwise has to guess at. The rest are thin views over
// metadata that a tool already exposes (projects, teams, work item types,
// fields); as resources they can be attached to a conversation once instead of
// being fetched again on every turn.
//
// Clients do not load resources automatically — the user attaches one, or the
// model reads it deliberately. So nothing here may be load-bearing: every fact
// a resource carries must also be reachable through a tool.

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

import { Domain } from "./shared/domains.js";

const RESOURCE_URIS = {
  wiql: "ado://wiql-reference",
  projects: "ado://projects",
  teams: "ado://project/{project}/teams",
  workItemTypes: "ado://project/{project}/work-item-types",
  fields: "ado://project/{project}/fields",
};

// Written out rather than fetched: WIQL has no metadata endpoint, and getting
// the syntax wrong is the most common way a work item query fails.
const WIQL_REFERENCE = `# WIQL quick reference

Work Item Query Language is SQL-shaped but not SQL. Pass a query to
\`wit_query_by_wiql\`; it returns work item ids, so follow up with
\`wit_get_work_items_batch_by_ids\` to read fields.

## Shape

    SELECT [System.Id], [System.Title], [System.State]
    FROM WorkItems
    WHERE [System.TeamProject] = @Project
      AND [System.WorkItemType] = 'Bug'
      AND [System.State] <> 'Closed'
    ORDER BY [System.ChangedDate] DESC

- Field names go in square brackets and are **reference names**, never the
  label shown in the UI. \`wit_list_fields\` resolves one from the other.
- String literals use single quotes. Doubling a quote escapes it.
- \`FROM WorkItems\` returns items. \`FROM WorkItemLinks\` returns links, and
  needs \`MODE (Recursive)\` or \`MODE (MustContain)\`; its SELECT addresses
  \`[Source]\`, \`[Target]\` and \`[System.Links.LinkType]\`.
- There is no JOIN, no GROUP BY, no aggregate function, and no sub-select.
  Aggregate in your own code after fetching the items.

## Macros

| Macro | Meaning |
| --- | --- |
| \`@Me\` | the authenticated user, for identity fields |
| \`@Today\` | midnight today; \`@Today - 7\` is a week ago |
| \`@Project\` | the project the query runs in |
| \`@CurrentIteration\` | the team's current sprint; needs a team context |
| \`@StartOfDay\`, \`@StartOfWeek\`, \`@StartOfMonth\`, \`@StartOfYear\` | period boundaries, each accepting an offset like \`@StartOfMonth - 1\` |

## Operators

\`=\`, \`<>\`, \`>\`, \`<\`, \`>=\`, \`<=\`, \`IN\`, \`NOT IN\`, \`CONTAINS\`,
\`NOT CONTAINS\`, \`CONTAINS WORDS\` (full-text fields only), \`UNDER\` and
\`NOT UNDER\` (tree paths), \`EVER\` (was ever set to), \`IS EMPTY\` /
\`IS NOT EMPTY\` (for HTML and history fields).

## Commonly used reference names

| Reference name | Holds |
| --- | --- |
| \`System.Id\` | work item id |
| \`System.Title\` | title |
| \`System.State\`, \`System.Reason\` | state and why it got there |
| \`System.WorkItemType\` | Bug, Task, User Story, … |
| \`System.AssignedTo\`, \`System.CreatedBy\`, \`System.ChangedBy\` | identities |
| \`System.CreatedDate\`, \`System.ChangedDate\` | timestamps |
| \`System.AreaPath\`, \`System.IterationPath\` | tree paths — use \`UNDER\` |
| \`System.Tags\` | semicolon-separated; match with \`CONTAINS\` |
| \`System.Parent\` | parent id |
| \`Microsoft.VSTS.Common.Priority\`, \`.Severity\` | triage fields |
| \`Microsoft.VSTS.Scheduling.StoryPoints\`, \`.RemainingWork\`, \`.OriginalEstimate\` | estimates |
| \`Microsoft.VSTS.Common.ClosedDate\`, \`.ActivatedDate\`, \`.ResolvedDate\` | lifecycle dates |

Custom processes add their own fields under their own namespace; list them with
\`wit_list_fields\`.

## Patterns

Assigned to me and still open:

    SELECT [System.Id] FROM WorkItems
    WHERE [System.AssignedTo] = @Me AND [System.State] NOT IN ('Closed', 'Removed')

Everything under an area, changed in the last week:

    SELECT [System.Id] FROM WorkItems
    WHERE [System.AreaPath] UNDER 'Contoso\\\\Web' AND [System.ChangedDate] >= @Today - 7

Bugs in the current sprint, worst first:

    SELECT [System.Id] FROM WorkItems
    WHERE [System.WorkItemType] = 'Bug' AND [System.IterationPath] = @CurrentIteration
    ORDER BY [Microsoft.VSTS.Common.Severity] ASC

Children of one item:

    SELECT [System.Id] FROM WorkItemLinks
    WHERE [Source].[System.Id] = 1234
      AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
    MODE (Recursive)

## Failure modes

- A field that does not exist in the project's process is an error, not an
  empty result — check with \`wit_list_fields\` first.
- \`@CurrentIteration\` without a team context resolves to nothing; pass the
  team, or resolve the sprint with \`work_list_team_iterations\`.
- Queries are capped (about 20 000 items). Narrow by date or area rather than
  paging blindly.
`;

function json(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

/**
 * Register the server's resources, skipping any whose domain is disabled so a
 * preset endpoint does not advertise reference data it cannot serve.
 */
export function configureResources(server: McpServer, connectionProvider: () => Promise<WebApi>, enabledDomains: Set<string>): void {
  if (enabledDomains.has(Domain.WORK_ITEMS)) {
    server.registerResource(
      "wiql-reference",
      RESOURCE_URIS.wiql,
      {
        title: "WIQL query reference",
        description: "Work Item Query Language: syntax, macros, operators, common field reference names and worked examples.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: WIQL_REFERENCE }],
      })
    );
  }

  if (enabledDomains.has(Domain.CORE)) {
    server.registerResource(
      "projects",
      RESOURCE_URIS.projects,
      {
        title: "Projects",
        description: "Every project in the organization, with its id and state.",
        mimeType: "application/json",
      },
      async (uri) => {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();
        const projects = await coreApi.getProjects();
        return json(
          uri.href,
          projects.map((p) => ({ id: p.id, name: p.name, state: p.state, visibility: p.visibility, description: p.description }))
        );
      }
    );

    server.registerResource(
      "teams",
      new ResourceTemplate(RESOURCE_URIS.teams, { list: undefined }),
      {
        title: "Teams in a project",
        description: "The teams defined in one project, with their ids.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const connection = await connectionProvider();
        const coreApi = await connection.getCoreApi();
        const teams = await coreApi.getTeams(String(variables.project));
        return json(
          uri.href,
          teams.map((t) => ({ id: t.id, name: t.name, description: t.description }))
        );
      }
    );
  }

  if (enabledDomains.has(Domain.WORK_ITEMS)) {
    server.registerResource(
      "work-item-types",
      new ResourceTemplate(RESOURCE_URIS.workItemTypes, { list: undefined }),
      {
        title: "Work item types in a project",
        description: "The work item types the project's process defines, with their states.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const connection = await connectionProvider();
        const witApi = await connection.getWorkItemTrackingApi();
        const types = await witApi.getWorkItemTypes(String(variables.project));
        return json(
          uri.href,
          types.map((t) => ({
            name: t.name,
            referenceName: t.referenceName,
            description: t.description,
            states: t.states?.map((s) => ({ name: s.name, category: s.category })),
          }))
        );
      }
    );

    server.registerResource(
      "fields",
      new ResourceTemplate(RESOURCE_URIS.fields, { list: undefined }),
      {
        title: "Work item fields in a project",
        description: "Every work item field in the project, mapping its display name to the reference name that queries and updates must use.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const connection = await connectionProvider();
        const witApi = await connection.getWorkItemTrackingApi();
        const fields = await witApi.getFields(String(variables.project));
        return json(
          uri.href,
          fields.map((f) => ({ name: f.name, referenceName: f.referenceName, type: f.type, readOnly: f.readOnly }))
        );
      }
    );
  }
}

export { RESOURCE_URIS, WIQL_REFERENCE };
