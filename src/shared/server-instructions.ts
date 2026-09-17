// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// The `instructions` string returned with the MCP `initialize` response.
//
// MCP has no way to group tools, so a client is handed a flat list of a few
// hundred names. Clients pass this text to the model alongside that list, which
// makes it by far the cheapest place to explain the shape of the server: what
// each name prefix covers, which tool answers which kind of question, and which
// writes reach beyond a single project. At roughly 1.1k tokens for the full
// domain set it costs about 1.4% of what the tool schemas do (~83k).
//
// Only the enabled domains are described, so a preset endpoint (see presets.ts)
// does not advertise tools it does not serve.

import { Domain } from "./domains.js";

/** One line per domain: the name prefix and what it covers. */
const DOMAIN_GUIDE: readonly (readonly [Domain, string])[] = [
  [Domain.CORE, "core_ — projects, teams, processes, identity lookup. Start here when the project or team is not known."],
  [Domain.WORK_ITEMS, "wit_ — work items: read, create, update, link, query (WIQL), comments, attachments, tags, templates, saved queries, field and type metadata."],
  [Domain.WORK, "work_ — the board: backlogs, sprints/iterations, area paths, capacity, delivery plans, taskboards, board columns and rules."],
  [Domain.REPOSITORIES, "repo_ — Git: repositories, branches, tags, file contents, commits and their statuses, pull requests, reviewers, labels, comment threads."],
  [Domain.PIPELINES, "pipelines_ — builds and YAML pipelines: definitions, runs, logs, timelines, artifacts, tags."],
  [Domain.RELEASE, "release_ — classic release pipelines: definitions, releases, environments, approvals."],
  [Domain.SEARCH, "search_ — full-text search across code, wikis and work items."],
  [Domain.WIKI, "wiki_ — wikis and their pages."],
  [Domain.TEST_PLANS, "testplan_ — test plans, suites, test cases, and test points (tester assignment and manual outcomes)."],
  [Domain.TEST_RESULTS, "testresults_ — test runs, their results and attachments, and code coverage."],
  [Domain.DASHBOARDS, "dashboard_ — dashboards and widgets."],
  [Domain.POLICY, "policy_ — branch policies: configurations, types, evaluations on a pull request."],
  [Domain.TASK_AGENT, "taskagent_ — variable groups, agent pools, queues and agents, environments, task groups, secure file metadata."],
  [Domain.SERVICE_ENDPOINT, "serviceendpoint_ — service connections."],
  [Domain.SERVICE_HOOKS, "servicehook_ — service hook subscriptions (outgoing webhooks)."],
  [Domain.ARTIFACTS, "artifacts_ — package feeds and their packages."],
  [Domain.ADVANCED_SECURITY, "advsec_ — Advanced Security alerts (secrets, dependencies, code scanning)."],
  [Domain.APPROVALS, "approvals_ — pipeline approval checks awaiting a decision."],
  [Domain.ANALYTICS, "analytics_ — OData reporting: counts, sums and groupings over work items, history snapshots and trends, pipeline and test pass rates."],
  [Domain.PROJECT_ANALYSIS, "projectanalysis_ — language breakdown and repository/project activity."],
  [Domain.WIT_PROCESS, "witprocess_ — process customization: inherited processes, work item types, fields, states, behaviors, rules, picklists."],
  [Domain.MEMBER_ENTITLEMENT, "memberentitlement_ — user licenses, group entitlements, organization membership."],
  [Domain.GRAPH, "graph_ — identities: users, groups, memberships."],
  [Domain.PERMISSIONS, "permissions_ — security namespaces and access control lists: read, check your own rights, grant, deny and remove."],
  [Domain.SECURITY_ROLES, "securityrole_ — role assignments on resources such as pools and environments."],
  [Domain.AUDIT, "audit_ — the organization audit log."],
  [Domain.NOTIFICATION, "notification_ — notification subscriptions and event types."],
  [Domain.EXTENSIONS, "extension_ — extensions installed in the organization."],
  [Domain.GALLERY, "gallery_ — the public Visual Studio Marketplace."],
  [Domain.FEATURE_MANAGEMENT, "featuremanagement_ — enabling or disabling product features per project."],
  [Domain.OPERATIONS, "operations_ — status of a long-running async operation returned by another tool."],
  [Domain.PROFILE, "profile_ — the authenticated caller's own identity."],
  [Domain.MCP_APPS, "mcp_apps_ — connectivity probe."],
];

/** Guidance that only makes sense when the tools it names are actually served. */
const HINTS: readonly { readonly needs: readonly Domain[]; readonly text: string }[] = [
  {
    needs: [Domain.SEARCH],
    text: "To find something by its text, use search_code, search_wiki or search_workitem. Never enumerate repositories, pages or work items to look for a string.",
  },
  {
    needs: [Domain.WORK_ITEMS],
    text: "Work item ids you already know: wit_get_work_items_batch_by_ids fetches many in one call — prefer it over repeated wit_get_work_item.",
  },
  {
    needs: [Domain.WORK_ITEMS],
    text: "Work items matching a condition: wit_query_by_wiql for an ad-hoc query, wit_get_query_results_by_id for a saved one. Both return ids and relations only, so follow up with wit_get_work_items_batch_by_ids for the fields.",
  },
  {
    needs: [Domain.WORK_ITEMS],
    text: 'Fields are addressed by reference name ("System.Title", "System.AssignedTo", "Microsoft.VSTS.Scheduling.StoryPoints"), not by the label shown in the UI. wit_list_fields resolves one from the other. WIQL supports the macros @Me, @Today and @CurrentIteration.',
  },
  {
    needs: [Domain.ANALYTICS],
    text: "Numbers rather than items — how many, how much, per state, over time — come from analytics_query with $apply=groupby/aggregate. WIQL cannot aggregate, so never page through work items to count them.",
  },
  {
    needs: [Domain.REPOSITORIES],
    text: "Reading source: repo_get_file_content for a file, repo_list_directory for a folder. Do not reconstruct a file from commits.",
  },
  {
    needs: [Domain.WORK],
    text: "work_ acts on a team's configuration; wit_ acts on individual work items. Moving an item between sprints is a wit_update_work_item on System.IterationPath, not a work_ tool.",
  },
];

/** The resources registered in resources.ts, and the domain each one needs. */
const RESOURCE_GUIDE: readonly { readonly needs: Domain; readonly text: string }[] = [
  { needs: Domain.WORK_ITEMS, text: "ado://wiql-reference — WIQL syntax, macros, operators and field reference names. Read it before writing a non-trivial query." },
  { needs: Domain.CORE, text: "ado://projects and ado://project/{project}/teams — the organization's projects and a project's teams." },
  {
    needs: Domain.WORK_ITEMS,
    text: "ado://project/{project}/work-item-types and ado://project/{project}/fields — the process's types and states, and the display-name-to-reference-name mapping for fields.",
  },
];

/** Writes whose blast radius is the whole organization rather than one project. */
const ORG_WIDE = [Domain.WIT_PROCESS, Domain.MEMBER_ENTITLEMENT, Domain.GRAPH, Domain.PERMISSIONS, Domain.SECURITY_ROLES, Domain.FEATURE_MANAGEMENT, Domain.NOTIFICATION];

export interface ServerInstructionsOptions {
  /** The Azure DevOps organization this server is bound to. */
  organization?: string;
  /** Name of the preset being served, when the endpoint serves a subset. */
  preset?: string;
}

/**
 * Build the `instructions` text for the given set of enabled domains.
 *
 * Kept deterministic and free of per-request data: the HTTP transport builds a
 * server per request, so this runs on every call.
 */
export function buildServerInstructions(enabledDomains: Set<string>, options: ServerInstructionsOptions = {}): string {
  const enabled = (domain: Domain): boolean => enabledDomains.has(domain);

  const scope = options.organization ? `the Azure DevOps organization "${options.organization}"` : "an Azure DevOps organization";
  const lines: string[] = [
    `Tools for ${scope}.`,
    "",
    "Each tool wraps a single Azure DevOps REST endpoint and nothing more — there are no workflow tools, so compose several calls yourself. The prefix of a tool name tells you its area:",
    "",
  ];

  for (const [domain, description] of DOMAIN_GUIDE) {
    if (enabled(domain)) {
      lines.push(`- ${description}`);
    }
  }

  const hints = HINTS.filter((hint) => hint.needs.every(enabled));
  if (hints.length > 0) {
    lines.push("", "Choosing a tool:", "");
    for (const hint of hints) {
      lines.push(`- ${hint.text}`);
    }
  }

  lines.push(
    "",
    "Conventions:",
    "",
    '- Most tools take an optional "project" (and sometimes "team"). Omit it and the server falls back to its configured default or asks the user — do not invent a project name.',
    "- A tool that fails returns an error result with the Azure DevOps message; read it before retrying, as most failures are permission or api-version problems that a retry will not fix."
  );

  const orgWide = ORG_WIDE.filter(enabled);
  if (orgWide.length > 0) {
    lines.push(
      `- Writes through ${orgWide.map((d) => DOMAIN_GUIDE.find(([domain]) => domain === d)?.[1].split(" ")[0]).join(", ")} affect the whole organization, not one project. Confirm with the user before making one.`
    );
  }

  // Clients do not load resources on their own, so the model has to be told
  // they exist before it can decide to read one.
  const resources = RESOURCE_GUIDE.filter((entry) => enabled(entry.needs));
  if (resources.length > 0) {
    lines.push("", "Reference material, readable as MCP resources:", "");
    for (const resource of resources) {
      lines.push(`- ${resource.text}`);
    }
  }

  if (options.preset) {
    lines.push("", `This endpoint serves the "${options.preset}" subset of the server's tools. If a needed area is missing, say so — another endpoint of the same server exposes it.`);
  }

  return lines.join("\n");
}
