// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Named subsets of the tool domains, served from their own URL path.
//
// The full server registers 336 tools, and their schemas cost roughly 83k
// tokens in the model's context on every request — enough to crowd out the
// work itself and to make the choice between 336 near-neighbours noisier than
// it needs to be. MCP has no notion of tool groups, so the only way to hand a
// client a smaller surface is to serve fewer tools.
//
// The HTTP transport is stateless (a fresh McpServer per request), so the
// preset can simply be a path segment: "/mcp" serves whatever --domains
// configured, "/mcp/dev" serves the developer subset. Nothing is remembered
// between requests, and a client picks its preset by registering that URL.
//
// Presets are cut by role rather than by API area: each one is meant to cover
// a whole working session for someone in that role, because a preset that
// forces a switch mid-task is worse than no preset at all.

import { Domain } from "./domains.js";

/** Carried by every preset: you cannot do anything without finding the project first. */
const BASE: Domain[] = [Domain.CORE, Domain.PROFILE, Domain.SEARCH];

export const TOOL_PRESETS: Readonly<Record<string, readonly Domain[]>> = {
  /** Writing code: repositories, pull requests, the work items they close, docs. */
  dev: [...BASE, Domain.REPOSITORIES, Domain.WORK_ITEMS, Domain.WIKI, Domain.PIPELINES, Domain.APPROVALS],

  /** Running the board: backlogs, sprints, capacity, plans, reporting. */
  plan: [...BASE, Domain.WORK, Domain.WORK_ITEMS, Domain.DASHBOARDS, Domain.ANALYTICS, Domain.PROJECT_ANALYSIS, Domain.TEST_PLANS, Domain.WIKI, Domain.APPROVALS],

  /** Delivery: pipelines, releases, agents, service connections, packages, alerts. */
  ops: [
    ...BASE,
    Domain.PIPELINES,
    Domain.RELEASE,
    Domain.TASK_AGENT,
    Domain.SERVICE_ENDPOINT,
    Domain.SERVICE_HOOKS,
    Domain.ARTIFACTS,
    Domain.ADVANCED_SECURITY,
    Domain.POLICY,
    Domain.TEST_RESULTS,
    Domain.ANALYTICS,
    Domain.APPROVALS,
    Domain.OPERATIONS,
  ],

  /** Administering the organization: process customization, identity, access, auditing. */
  admin: [
    ...BASE,
    Domain.WIT_PROCESS,
    Domain.MEMBER_ENTITLEMENT,
    Domain.GRAPH,
    Domain.PERMISSIONS,
    Domain.SECURITY_ROLES,
    Domain.AUDIT,
    Domain.NOTIFICATION,
    Domain.EXTENSIONS,
    Domain.FEATURE_MANAGEMENT,
    Domain.GALLERY,
    Domain.OPERATIONS,
  ],
};

export const PRESET_NAMES: readonly string[] = Object.keys(TOOL_PRESETS);

/**
 * Resolve a preset name to the domains it enables.
 *
 * Returns undefined for an unknown name so the caller can answer 404 rather
 * than silently serving something the client did not ask for.
 */
export function resolvePreset(name: string): Set<string> | undefined {
  // The name arrives from a URL path, so look it up as an own property:
  // a plain index would resolve "constructor" and friends off Object.prototype.
  const key = name.trim().toLowerCase();
  if (!Object.hasOwn(TOOL_PRESETS, key)) {
    return undefined;
  }
  return new Set<string>(TOOL_PRESETS[key]);
}
