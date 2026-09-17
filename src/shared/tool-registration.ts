// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ZodRawShape } from "zod";
import { McpServer, RegisteredTool, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// Categories that map to MCP tool annotations. Clients (e.g. the Claude tool
// permissions UI) bucket tools using these hints:
//   read        -> readOnlyHint: true                      ("Read-only tools")
//   write        -> readOnlyHint: false, destructiveHint: false ("Other tools")
//   destructive  -> readOnlyHint: false, destructiveHint: true  ("Write/delete tools")
export type ToolCategory = "read" | "write" | "destructive";

const CATEGORY_ANNOTATIONS: Record<ToolCategory, ToolAnnotations> = {
  read: { readOnlyHint: true, destructiveHint: false },
  write: { readOnlyHint: false, destructiveHint: false },
  destructive: { readOnlyHint: false, destructiveHint: true },
};

// Verb segments (matched against the underscore-delimited tool name) used to
// infer a category. Order of evaluation in categorizeTool: destructive first,
// then read, otherwise write.
const DESTRUCTIVE_VERBS = new Set(["delete", "remove", "unlink", "destroy"]);
const READ_VERBS = new Set(["list", "get", "show", "search", "find", "query", "my", "read"]);

// Explicit overrides for tools whose name does not imply the correct category.
const CATEGORY_OVERRIDES: Record<string, ToolCategory> = {
  // A connectivity check with no side effects.
  mcp_apps_ping: "read",
  // "set" reads as an ordinary write, but a deny bit or a merge=false replace
  // can lock every user out of a resource, so clients should confirm it.
  permissions_set_access_control_entries: "destructive",
};

export function categorizeTool(name: string): ToolCategory {
  if (name in CATEGORY_OVERRIDES) {
    return CATEGORY_OVERRIDES[name];
  }
  const segments = name.split("_");
  if (segments.some((segment) => DESTRUCTIVE_VERBS.has(segment))) {
    return "destructive";
  }
  if (segments.some((segment) => READ_VERBS.has(segment))) {
    return "read";
  }
  return "write";
}

// Registers a tool and attaches the MCP annotations for its inferred category.
//
// This is a drop-in replacement for `server.tool(name, description, schema, cb)`:
// the underlying registration call is unchanged (handler stays the last
// argument), and the annotations are applied afterwards via RegisteredTool.update.
// update() is a no-op on a disconnected server, so it is safe to call during setup.
export function registerTool<Args extends ZodRawShape>(server: McpServer, name: string, description: string, paramsSchema: Args, cb: ToolCallback<Args>): RegisteredTool {
  const registered = server.tool(name, description, paramsSchema, cb);
  registered?.update?.({ annotations: CATEGORY_ANNOTATIONS[categorizeTool(name)] });
  return registered;
}
