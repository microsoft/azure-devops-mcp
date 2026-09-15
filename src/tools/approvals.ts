// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { adoFetch } from "../shared/ado-rest.js";

const APPROVALS_TOOLS = {
  list: "approvals_list",
  get: "approvals_get",
  update: "approvals_update",
};

// The Approvals and Checks area is preview-only; 7.2-preview.2 is the current
// revision for both the query and the update operations.
const approvalsApiVersion = "7.2-preview.2";

const approvalStatuses = ["pending", "approved", "rejected", "skipped", "canceled", "timedOut", "deferred", "uninitiated", "all"] as const;

function configureApprovalsTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  async function request(project: string, pathAndQuery: string, method: string, body?: unknown): Promise<Response> {
    const connection = await connectionProvider();
    const token = await tokenProvider();
    const baseUrl = connection.serverUrl.replace(/\/$/, "");
    return adoFetch({
      url: `${baseUrl}/${encodeURIComponent(project)}/_apis/pipelines/${pathAndQuery}`,
      method,
      token,
      userAgent: userAgentProvider(),
      body,
    });
  }

  registerTool(
    server,
    APPROVALS_TOOLS.list,
    "List approvals of YAML pipeline stages, e.g. the pending approvals waiting on a user or on a protected resource. These are the approvals of multi-stage YAML pipelines; classic release approvals are handled by the release tools instead.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      approvalIds: z.array(z.string()).optional().describe("Only return these approval IDs (GUIDs)."),
      assignedTo: z.array(z.string()).optional().describe("Only return approvals assigned to these users. Accepts user IDs, descriptors or emails."),
      state: z.enum(approvalStatuses).optional().describe("Only return approvals in this state. Returns approvals of any status when omitted."),
      top: z.coerce.number().optional().describe("Maximum number of approvals to return."),
      expand: z.enum(["none", "steps", "permissions"]).optional().describe("Include extra details: 'steps' adds the individual approval steps, 'permissions' adds the current user's permissions."),
    },
    async ({ project, approvalIds, assignedTo, state, top, expand }) => {
      try {
        const params = new URLSearchParams({ "api-version": approvalsApiVersion });
        if (approvalIds?.length) params.append("approvalIds", approvalIds.join(","));
        if (assignedTo?.length) params.append("assignedTo", assignedTo.join(","));
        if (state) params.append("state", state);
        if (top !== undefined) params.append("top", String(top));
        if (expand) params.append("$expand", expand);

        const response = await request(project, `approvals?${params.toString()}`, "GET");
        if (!response.ok) {
          throw new Error(`Failed to list approvals (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing approvals: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    APPROVALS_TOOLS.get,
    "Get a single pipeline approval by its ID, including who it is assigned to and the instructions shown to the approvers.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      approvalId: z.string().describe("The ID (GUID) of the approval."),
      expand: z.enum(["none", "steps", "permissions"]).optional().describe("Include extra details: 'steps' adds the individual approval steps, 'permissions' adds the current user's permissions."),
    },
    async ({ project, approvalId, expand }) => {
      try {
        const params = new URLSearchParams({ "api-version": approvalsApiVersion });
        if (expand) params.append("$expand", expand);

        const response = await request(project, `approvals/${encodeURIComponent(approvalId)}?${params.toString()}`, "GET");
        if (response.status === 404) {
          return { content: [{ type: "text", text: `Approval '${approvalId}' not found` }], isError: true };
        }
        if (!response.ok) {
          throw new Error(`Failed to get approval (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching approval: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    APPROVALS_TOOLS.update,
    "Act on a pipeline approval: approve, reject, defer or reassign it. The caller must be an assigned approver; the API answers with the updated approval, whose status stays 'pending' while other approvers are still required.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      approvalId: z.string().describe("The ID (GUID) of the approval to act on."),
      status: z.enum(["approved", "rejected", "deferred", "pending"]).describe("The new status of the approval."),
      comment: z.string().optional().describe("Comment recorded with the decision."),
      deferredTo: z.string().optional().describe("Date (ISO 8601, UTC) the approval is deferred to. Only meaningful when status is 'deferred'."),
      reassignTo: z.string().optional().describe("Identity ID of the user to reassign the approval to."),
    },
    async ({ project, approvalId, status, comment, deferredTo, reassignTo }) => {
      try {
        const update: Record<string, unknown> = { approvalId, status };
        if (comment !== undefined) update.comment = comment;
        if (deferredTo !== undefined) update.deferredTo = deferredTo;
        if (reassignTo !== undefined) update.reassignTo = { id: reassignTo };

        const response = await request(project, `approvals?api-version=${approvalsApiVersion}`, "PATCH", [update]);
        if (!response.ok) {
          throw new Error(`Failed to update approval (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating approval: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { APPROVALS_TOOLS, configureApprovalsTools };
