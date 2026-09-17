// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { adoFetch } from "../shared/ado-rest.js";

const PERMISSIONS_TOOLS = {
  list_security_namespaces: "permissions_list_security_namespaces",
  get_access_control_lists: "permissions_get_access_control_lists",
  query_my_permissions: "permissions_query_my_permissions",
  set_access_control_entries: "permissions_set_access_control_entries",
  remove_access_control_entries: "permissions_remove_access_control_entries",
  remove_permission: "permissions_remove_permission",
  remove_access_control_lists: "permissions_remove_access_control_lists",
};

// ACEs identify people and groups by *identity* descriptor
// ("Microsoft.TeamFoundation.Identity;S-1-9-..."), which is not the Graph
// subject descriptor ("vssgp.Uy0x...") that graph_ tools return. Passing the
// latter is accepted by the API and silently matches nobody.
const IDENTITY_DESCRIPTOR_NOTE =
  "Identity descriptor as it appears in permissions_get_access_control_lists, e.g. 'Microsoft.TeamFoundation.Identity;S-1-9-...'. A Graph subject descriptor (vssgp./aad.) does not match.";

const permissionsApiVersion = "7.1";

function configurePermissionsTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  async function request(pathAndQuery: string, method = "GET", body?: unknown): Promise<Response> {
    const connection = await connectionProvider();
    const token = await tokenProvider();
    const baseUrl = connection.serverUrl.replace(/\/$/, "");
    return adoFetch({ url: `${baseUrl}/_apis/${pathAndQuery}`, method, token, userAgent: userAgentProvider(), body });
  }

  async function send(action: string, pathAndQuery: string, method = "GET", body?: unknown) {
    try {
      const response = await request(pathAndQuery, method, body);
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status}: ${text}`);
      }
      return { content: [{ type: "text" as const, text: text || JSON.stringify({ ok: true }) }] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return { content: [{ type: "text" as const, text: `Error ${action}: ${errorMessage}` }], isError: true };
    }
  }

  registerTool(
    server,
    PERMISSIONS_TOOLS.list_security_namespaces,
    "List security namespaces. Each namespace defines the set of permissions (bitmask actions) for a class of resource (e.g. Git repositories, build, project). Use a namespace ID to query its access control lists.",
    {
      namespaceId: z.string().optional().describe("If provided, return only this namespace (by ID)."),
      localOnly: z.boolean().optional().describe("If true, return only namespaces served by the local (this) service."),
    },
    async ({ namespaceId, localOnly }) => {
      try {
        const params = new URLSearchParams({ "api-version": permissionsApiVersion });
        if (localOnly !== undefined) params.append("localOnly", String(localOnly));

        const path = namespaceId ? `securitynamespaces/${encodeURIComponent(namespaceId)}` : "securitynamespaces";
        const response = await request(`${path}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to list security namespaces (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing security namespaces: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PERMISSIONS_TOOLS.get_access_control_lists,
    "Get the access control lists (ACLs) for a security namespace. Each ACL holds the access control entries (allow/deny permission bitmasks) for identities on a security token.",
    {
      namespaceId: z.string().describe("The ID of the security namespace (from list_security_namespaces)."),
      token: z.string().optional().describe("The security token (resource path) to scope to. Omit to return all ACLs in the namespace."),
      descriptors: z.string().optional().describe("Comma-separated identity descriptors to filter the ACEs by."),
      includeExtendedInfo: z.boolean().optional().describe("Include extended info (effective/inherited permissions) for each ACE."),
      recurse: z.boolean().optional().describe("If true and the token is hierarchical, also return ACLs for child tokens."),
    },
    async ({ namespaceId, token, descriptors, includeExtendedInfo, recurse }) => {
      try {
        const params = new URLSearchParams({ "api-version": permissionsApiVersion });
        if (token) params.append("token", token);
        if (descriptors) params.append("descriptors", descriptors);
        if (includeExtendedInfo !== undefined) params.append("includeExtendedInfo", String(includeExtendedInfo));
        if (recurse !== undefined) params.append("recurse", String(recurse));

        const response = await request(`accesscontrollists/${encodeURIComponent(namespaceId)}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to get access control lists (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching access control lists: ${errorMessage}` }], isError: true };
      }
    }
  );
  registerTool(
    server,
    PERMISSIONS_TOOLS.query_my_permissions,
    "Check whether the signed-in caller holds a permission on one or more security tokens. Returns one boolean per token. This evaluates the caller only; to see another identity's rights read the ACLs with includeExtendedInfo.",
    {
      namespaceId: z.string().describe("The ID of the security namespace."),
      permissions: z.number().int().positive().describe("Permission bit (or OR-ed bits) to test, from the namespace's actions."),
      tokens: z.array(z.string()).min(1).describe("Security tokens to test, e.g. 'repoV2/<projectId>/<repoId>'."),
      alwaysAllowAdministrators: z.boolean().default(false).describe("Treat project collection administrators as always allowed."),
    },
    async ({ namespaceId, permissions, tokens, alwaysAllowAdministrators }) => {
      // Tokens may contain commas, so a delimiter that cannot occur in them is declared.
      const params = new URLSearchParams({
        "api-version": permissionsApiVersion,
        "tokens": tokens.join("|"),
        "delimiter": "|",
        "alwaysAllowAdministrators": String(alwaysAllowAdministrators),
      });
      return send("checking permissions", `permissions/${encodeURIComponent(namespaceId)}/${permissions}?${params.toString()}`);
    }
  );

  registerTool(
    server,
    PERMISSIONS_TOOLS.set_access_control_entries,
    "Grant or deny permissions to identities on a security token. With merge=true (default) the bits are added to each identity's existing entry; with merge=false the entry is replaced, which also drops bits you did not pass. Can lock people out of a resource — confirm with the user first.",
    {
      namespaceId: z.string().describe("The ID of the security namespace."),
      token: z.string().describe("The security token the entries apply to."),
      entries: z
        .array(
          z.object({
            descriptor: z.string().describe(IDENTITY_DESCRIPTOR_NOTE),
            allow: z.number().int().nonnegative().default(0).describe("Permission bits to allow."),
            deny: z.number().int().nonnegative().default(0).describe("Permission bits to deny. Deny wins over allow."),
          })
        )
        .min(1)
        .describe("One entry per identity."),
      merge: z.boolean().default(true).describe("Merge with the existing entries rather than replacing them."),
    },
    async ({ namespaceId, token, entries, merge }) =>
      send("setting access control entries", `accesscontrolentries/${encodeURIComponent(namespaceId)}?api-version=${permissionsApiVersion}`, "POST", {
        token,
        merge,
        accessControlEntries: entries.map((entry) => ({ descriptor: entry.descriptor, allow: entry.allow, deny: entry.deny, extendedInfo: {} })),
      })
  );

  registerTool(
    server,
    PERMISSIONS_TOOLS.remove_permission,
    "Clear specific permission bits for one identity on one token, leaving its other bits alone. The narrowest way to take a right away.",
    {
      namespaceId: z.string().describe("The ID of the security namespace."),
      permissions: z.number().int().positive().describe("Permission bit (or OR-ed bits) to clear."),
      token: z.string().describe("The security token."),
      descriptor: z.string().describe(IDENTITY_DESCRIPTOR_NOTE),
    },
    async ({ namespaceId, permissions, token, descriptor }) => {
      const params = new URLSearchParams({ "api-version": permissionsApiVersion, token, descriptor });
      return send("removing permission", `permissions/${encodeURIComponent(namespaceId)}/${permissions}?${params.toString()}`, "DELETE");
    }
  );

  registerTool(
    server,
    PERMISSIONS_TOOLS.remove_access_control_entries,
    "Remove identities' whole entries from a token's ACL, so they fall back to inherited permissions. Confirm with the user first.",
    {
      namespaceId: z.string().describe("The ID of the security namespace."),
      token: z.string().describe("The security token."),
      descriptors: z.array(z.string()).min(1).describe(`Identities whose entries are removed. ${IDENTITY_DESCRIPTOR_NOTE}`),
    },
    async ({ namespaceId, token, descriptors }) => {
      const params = new URLSearchParams({ "api-version": permissionsApiVersion, token, "descriptors": descriptors.join(",") });
      return send("removing access control entries", `accesscontrolentries/${encodeURIComponent(namespaceId)}?${params.toString()}`, "DELETE");
    }
  );

  registerTool(
    server,
    PERMISSIONS_TOOLS.remove_access_control_lists,
    "Delete the entire ACL of one or more tokens — every explicit entry for every identity. Only inherited permissions remain, which can remove the last explicit administrator of a resource. Prefer permissions_remove_access_control_entries or permissions_remove_permission; confirm with the user before using this.",
    {
      namespaceId: z.string().describe("The ID of the security namespace."),
      tokens: z.array(z.string()).min(1).describe("Security tokens whose ACLs are deleted."),
      recurse: z.boolean().default(false).describe("Also delete the ACLs of every child token. Rarely what you want."),
    },
    async ({ namespaceId, tokens, recurse }) => {
      const params = new URLSearchParams({ "api-version": permissionsApiVersion, "tokens": tokens.join(","), "recurse": String(recurse) });
      return send("removing access control lists", `accesscontrollists/${encodeURIComponent(namespaceId)}?${params.toString()}`, "DELETE");
    }
  );
}

export { PERMISSIONS_TOOLS, configurePermissionsTools };
