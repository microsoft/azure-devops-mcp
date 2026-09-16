// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const MEMBER_ENTITLEMENT_TOOLS = {
  list_users: "memberentitlement_list_users",
  get_user: "memberentitlement_get_user",
  add_user: "memberentitlement_add_user",
  update_user_license: "memberentitlement_update_user_license",
  delete_user: "memberentitlement_delete_user",
  get_summary: "memberentitlement_get_summary",
  list_group_entitlements: "memberentitlement_list_group_entitlements",
  get_group_entitlement: "memberentitlement_get_group_entitlement",
  update_group_license: "memberentitlement_update_group_license",
  list_group_members: "memberentitlement_list_group_members",
  add_group_member: "memberentitlement_add_group_member",
  remove_group_member: "memberentitlement_remove_group_member",
};

// Member Entitlement Management lives on a separate host from the core REST APIs.
// Cloud: https://dev.azure.com/{org}        -> https://vsaex.dev.azure.com/{org}
// Legacy: https://{org}.visualstudio.com    -> https://{org}.vsaex.visualstudio.com
// On-prem Azure DevOps Server serves it from the same collection host (fallback).
function memberEntitlementBaseUrl(serverUrl: string): string {
  const trimmed = serverUrl.replace(/\/$/, "");
  if (trimmed.includes("://dev.azure.com/")) {
    return trimmed.replace("://dev.azure.com/", "://vsaex.dev.azure.com/");
  }
  const legacy = trimmed.match(/^(https?:\/\/)([^./]+)\.visualstudio\.com(\/.*)?$/);
  if (legacy) {
    return `${legacy[1]}${legacy[2]}.vsaex.visualstudio.com${legacy[3] ?? ""}`;
  }
  return trimmed;
}

const memberEntitlementApiVersion = "7.1";
// Group entitlements and their members are preview-only, on their own revisions.
const groupEntitlementApiVersion = "7.2-preview.1";
const groupMembersApiVersion = "7.2-preview.2";

// AccountLicenseType values map to the access levels shown in the web UI:
//   express -> Basic, advanced -> Basic + Test Plans, stakeholder -> Stakeholder,
//   none -> Visual Studio Subscriber, professional -> (legacy) Basic.
const ACCOUNT_LICENSE_TYPES = ["stakeholder", "express", "advanced", "professional", "none"] as const;
const accountLicenseTypeField = z
  .enum(ACCOUNT_LICENSE_TYPES)
  .describe(
    "The account license type (access level): 'express' = Basic, 'advanced' = Basic + Test Plans, 'stakeholder' = Stakeholder, 'none' = Visual Studio Subscriber, 'professional' = legacy Basic."
  );

function configureMemberEntitlementTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  async function memberEntitlementFetch(method: string, pathAndQuery: string, body?: unknown, contentType = "application/json"): Promise<Response> {
    const connection = await connectionProvider();
    const accessToken = await tokenProvider();
    const baseUrl = memberEntitlementBaseUrl(connection.serverUrl);
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": userAgentProvider(),
    };
    if (body !== undefined) {
      headers["Content-Type"] = `${contentType}; charset=utf-8`;
    }
    return fetch(`${baseUrl}/_apis/${pathAndQuery}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.list_users,
    "List user entitlements (members and their access levels / licenses) in the organization. Supports OData-style filtering and field selection.",
    {
      filter: z.string().optional().describe("OData $filter expression, e.g. \"name eq 'jdoe@contoso.com'\" or \"licenseId eq 'Account-Express'\"."),
      select: z.string().optional().describe("Comma-separated extra properties to include, e.g. 'Projects,Extensions,Grouprules'."),
      orderBy: z.string().optional().describe("OData $orderBy expression, e.g. 'name ascending'."),
      continuationToken: z.string().optional().describe("Continuation token from a previous response to fetch the next page."),
    },
    async ({ filter, select, orderBy, continuationToken }) => {
      try {
        const params = new URLSearchParams({ "api-version": memberEntitlementApiVersion });
        if (filter) params.append("$filter", filter);
        if (select) params.append("select", select);
        if (orderBy) params.append("$orderBy", orderBy);
        if (continuationToken) params.append("continuationToken", continuationToken);

        const response = await memberEntitlementFetch("GET", `userentitlements?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to list user entitlements (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing user entitlements: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.get_user,
    "Get a single user entitlement by its user entitlement ID (the user's descriptor/GUID), including access level, project memberships and extensions.",
    {
      userId: z.string().describe("The user entitlement ID (the user's descriptor/GUID)."),
    },
    async ({ userId }) => {
      try {
        const response = await memberEntitlementFetch("GET", `userentitlements/${encodeURIComponent(userId)}?api-version=${memberEntitlementApiVersion}`);
        if (response.status === 404) {
          return { content: [{ type: "text", text: `User entitlement '${userId}' not found` }], isError: true };
        }
        if (!response.ok) {
          throw new Error(`Failed to get user entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching user entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.add_user,
    "Add a user to the organization with a given access level (license). Use accountLicenseType 'advanced' to grant Basic + Test Plans.",
    {
      principalName: z.string().describe("The user's principal name / email (UPN), e.g. 'jdoe@contoso.com'."),
      accountLicenseType: accountLicenseTypeField,
    },
    async ({ principalName, accountLicenseType }) => {
      try {
        const body = {
          accessLevel: { accountLicenseType },
          user: { principalName, subjectKind: "user" },
        };

        const response = await memberEntitlementFetch("POST", `userentitlements?api-version=${memberEntitlementApiVersion}`, body);
        if (!response.ok) {
          throw new Error(`Failed to add user entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error adding user entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.update_user_license,
    "Change an existing user's access level (license). Use accountLicenseType 'advanced' to grant Basic + Test Plans.",
    {
      userId: z.string().describe("The user entitlement ID (the user's descriptor/GUID)."),
      accountLicenseType: accountLicenseTypeField,
    },
    async ({ userId, accountLicenseType }) => {
      try {
        const patchDocument = [{ op: "replace", path: "/accessLevel", value: { accountLicenseType } }];

        const response = await memberEntitlementFetch(
          "PATCH",
          `userentitlements/${encodeURIComponent(userId)}?api-version=${memberEntitlementApiVersion}`,
          patchDocument,
          "application/json-patch+json"
        );
        if (!response.ok) {
          throw new Error(`Failed to update user entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating user entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.delete_user,
    "Remove a user from the organization, freeing the licence they held. Their work items, commits and history stay; only the membership and access go.",
    {
      userId: z.string().describe("The user entitlement ID (the user's descriptor/GUID)."),
    },
    async ({ userId }) => {
      try {
        const response = await memberEntitlementFetch("DELETE", `userentitlements/${encodeURIComponent(userId)}?api-version=${memberEntitlementApiVersion}`);
        if (response.status === 404) {
          return { content: [{ type: "text", text: `User entitlement '${userId}' not found` }], isError: true };
        }
        if (!response.ok) {
          throw new Error(`Failed to delete user entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: `User '${userId}' was removed from the organization.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting user entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.get_summary,
    "Get the organization's licence summary: how many of each access level are assigned and how many are left. Use it before adding users to check there is a free licence.",
    {
      select: z.string().optional().describe("Comma-separated sections to include, e.g. 'AccessLevels,Licenses,Extensions,Projects'. Passed through to the API."),
    },
    async ({ select }) => {
      try {
        const params = new URLSearchParams({ "api-version": memberEntitlementApiVersion });
        if (select) params.append("select", select);

        const response = await memberEntitlementFetch("GET", `userentitlementsummary?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to get entitlement summary (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching entitlement summary: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.list_group_entitlements,
    "List the group entitlements (group licensing rules) of the organization. A group rule gives every member of an Entra/Azure DevOps group the same access level and project memberships, which is how access is managed at scale instead of per user.",
    {},
    async () => {
      try {
        const response = await memberEntitlementFetch("GET", `groupentitlements?api-version=${groupEntitlementApiVersion}`);
        if (!response.ok) {
          throw new Error(`Failed to list group entitlements (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing group entitlements: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.get_group_entitlement,
    "Get a single group entitlement by its ID, with the licence rule and project memberships it grants.",
    {
      groupId: z.string().describe("The ID (GUID) of the group entitlement."),
    },
    async ({ groupId }) => {
      try {
        const response = await memberEntitlementFetch("GET", `groupentitlements/${encodeURIComponent(groupId)}?api-version=${groupEntitlementApiVersion}`);
        if (response.status === 404) {
          return { content: [{ type: "text", text: `Group entitlement '${groupId}' not found` }], isError: true };
        }
        if (!response.ok) {
          throw new Error(`Failed to get group entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching group entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.update_group_license,
    "Change the access level a group rule grants. The change is applied to every member of the group, so it can move a lot of licences at once — use testOnly first to see what would happen.",
    {
      groupId: z.string().describe("The ID (GUID) of the group entitlement."),
      accountLicenseType: accountLicenseTypeField,
      testOnly: z.boolean().default(false).describe("Evaluate the rule without applying it to the group's members."),
    },
    async ({ groupId, accountLicenseType, testOnly }) => {
      try {
        const params = new URLSearchParams({ "api-version": groupEntitlementApiVersion, "ruleOption": testOnly ? "testApplyGroupRule" : "applyGroupRule" });
        const patch = [{ op: "replace", path: "/licenseRule", from: "", value: { accountLicenseType, licensingSource: "account" } }];

        const response = await memberEntitlementFetch("PATCH", `groupentitlements/${encodeURIComponent(groupId)}?${params.toString()}`, patch, "application/json-patch+json");
        if (!response.ok) {
          throw new Error(`Failed to update group entitlement (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating group entitlement: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.list_group_members,
    "List the members covered by a group entitlement, with the access level each one ended up with.",
    {
      groupId: z.string().describe("The ID (GUID) of the group entitlement."),
      maxResults: z.coerce.number().optional().describe("Maximum number of members to return."),
      continuationToken: z.string().optional().describe("Continuation token from a previous response to fetch the next page."),
    },
    async ({ groupId, maxResults, continuationToken }) => {
      try {
        const params = new URLSearchParams({ "api-version": groupMembersApiVersion });
        if (maxResults !== undefined) params.append("maxResults", String(maxResults));
        if (continuationToken) params.append("continuationToken", continuationToken);

        const response = await memberEntitlementFetch("GET", `groupentitlements/${encodeURIComponent(groupId)}/members?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to list group members (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing group entitlement members: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.add_group_member,
    "Add a user to a group entitlement, which applies that group's licence rule and project memberships to them.",
    {
      groupId: z.string().describe("The ID (GUID) of the group entitlement."),
      memberId: z.string().describe("The ID (GUID) of the user to add."),
    },
    async ({ groupId, memberId }) => {
      try {
        const response = await memberEntitlementFetch("PUT", `groupentitlements/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}?api-version=${groupMembersApiVersion}`);
        if (!response.ok) {
          throw new Error(`Failed to add group member (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: `User '${memberId}' was added to group entitlement '${groupId}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error adding group entitlement member: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    MEMBER_ENTITLEMENT_TOOLS.remove_group_member,
    "Remove a user from a group entitlement. They keep their organization membership; only what this group rule granted is withdrawn.",
    {
      groupId: z.string().describe("The ID (GUID) of the group entitlement."),
      memberId: z.string().describe("The ID (GUID) of the user to remove."),
    },
    async ({ groupId, memberId }) => {
      try {
        const response = await memberEntitlementFetch("DELETE", `groupentitlements/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}?api-version=${groupMembersApiVersion}`);
        if (!response.ok) {
          throw new Error(`Failed to remove group member (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: `User '${memberId}' was removed from group entitlement '${groupId}'.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error removing group entitlement member: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { MEMBER_ENTITLEMENT_TOOLS, configureMemberEntitlementTools, memberEntitlementBaseUrl };
