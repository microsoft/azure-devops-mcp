// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { ReleaseStartMetadata, ReleaseApproval, ReleaseEnvironmentUpdateMetadata, ApprovalStatus, ReleaseStatus } from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { optionalProject } from "../shared/common-params.js";

const RELEASE_TOOLS = {
  list_definitions: "release_list_definitions",
  get_definition: "release_get_definition",
  list_releases: "release_list_releases",
  get_release: "release_get_release",
  create_release: "release_create_release",
  get_environment: "release_get_environment",
  update_environment: "release_update_environment",
  list_approvals: "release_list_approvals",
  update_approval: "release_update_approval",
};

const RELEASE_STATUS_MAP: Record<string, ReleaseStatus> = {
  draft: ReleaseStatus.Draft,
  active: ReleaseStatus.Active,
  abandoned: ReleaseStatus.Abandoned,
};

const APPROVAL_STATUS_MAP: Record<string, ApprovalStatus> = {
  pending: ApprovalStatus.Pending,
  approved: ApprovalStatus.Approved,
  rejected: ApprovalStatus.Rejected,
};

function configureReleaseTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // Resolve the project (eliciting if not supplied).
  const resolveProject = async (connection: WebApi, project: string | undefined) => {
    if (project) return { project };
    const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
    if ("response" in result) return result;
    return { project: result.resolved };
  };

  const projectField = optionalProject;

  registerTool(
    server,
    RELEASE_TOOLS.list_definitions,
    "List the release definitions in a project. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      searchText: z.string().optional().describe("Optional text to search release definition names for."),
      top: z.coerce.number().optional().describe("Optional maximum number of release definitions to return."),
    },
    async ({ project, searchText, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const releaseApi = await connection.getReleaseApi();
        const definitions = await releaseApi.getReleaseDefinitions(ctx.project, searchText, undefined, undefined, undefined, top);

        if (!definitions || definitions.length === 0) {
          return { content: [{ type: "text", text: "No release definitions found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(definitions, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching release definitions: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.get_definition,
    "Get a specific release definition by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      definitionId: z.number().describe("The ID of the release definition."),
    },
    async ({ project, definitionId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const releaseApi = await connection.getReleaseApi();
        const definition = await releaseApi.getReleaseDefinition(ctx.project, definitionId);

        return { content: [{ type: "text", text: JSON.stringify(definition, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching release definition: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.list_releases,
    "List the releases in a project, optionally filtered by definition or status. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      definitionId: z.number().optional().describe("Optional release definition ID to filter releases by."),
      status: z.enum(["active", "draft", "abandoned"]).optional().describe("Optional release status filter."),
      top: z.coerce.number().optional().describe("Optional maximum number of releases to return."),
    },
    async ({ project, definitionId, status, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const statusFilter = status ? RELEASE_STATUS_MAP[status] : undefined;
        const releaseApi = await connection.getReleaseApi();
        const releases = await releaseApi.getReleases(ctx.project, definitionId, undefined, undefined, undefined, statusFilter, undefined, undefined, undefined, undefined, top);

        if (!releases || releases.length === 0) {
          return { content: [{ type: "text", text: "No releases found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(releases, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching releases: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.get_release,
    "Get a specific release by ID. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      releaseId: z.number().describe("The ID of the release."),
    },
    async ({ project, releaseId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const releaseApi = await connection.getReleaseApi();
        const release = await releaseApi.getRelease(ctx.project, releaseId);

        return { content: [{ type: "text", text: JSON.stringify(release, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching release: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.create_release,
    "Create (start) a new release from a release definition. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      definitionId: z.number().describe("The ID of the release definition to create a release from."),
      description: z.string().optional().describe("An optional description for the release."),
      isDraft: z.boolean().optional().describe("Whether to create the release as a draft. Defaults to false."),
      artifacts: z
        .array(z.record(z.unknown()))
        .optional()
        .describe("Optional artifact metadata overrides (e.g. [{ alias, instanceReference: { id, name } }]). If omitted, the latest artifacts are used."),
    },
    async ({ project, definitionId, description, isDraft, artifacts }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const metadata: ReleaseStartMetadata = {
          definitionId,
          description,
          isDraft,
          artifacts: artifacts as ReleaseStartMetadata["artifacts"],
        };
        const releaseApi = await connection.getReleaseApi();
        const release = await releaseApi.createRelease(metadata, ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(release, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating release: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.get_environment,
    "Get a specific environment (stage) of a release. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      releaseId: z.number().describe("The ID of the release."),
      environmentId: z.number().describe("The ID of the release environment (stage)."),
    },
    async ({ project, releaseId, environmentId }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const releaseApi = await connection.getReleaseApi();
        const environment = await releaseApi.getReleaseEnvironment(ctx.project, releaseId, environmentId);

        return { content: [{ type: "text", text: JSON.stringify(environment, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching release environment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.update_environment,
    "Update a release environment (stage), e.g. to start a deployment by setting its status to 'inProgress'. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      releaseId: z.number().describe("The ID of the release."),
      environmentId: z.number().describe("The ID of the release environment (stage)."),
      updateData: z.record(z.unknown()).describe("The environment update metadata (e.g. { status: 'inProgress', comment, scheduledDeploymentTime, variables })."),
    },
    async ({ project, releaseId, environmentId, updateData }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const releaseApi = await connection.getReleaseApi();
        const environment = await releaseApi.updateReleaseEnvironment(updateData as unknown as ReleaseEnvironmentUpdateMetadata, ctx.project, releaseId, environmentId);

        return { content: [{ type: "text", text: JSON.stringify(environment, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating release environment: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.list_approvals,
    "List the release approvals in a project, optionally filtered by status or assignee. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      status: z.enum(["pending", "approved", "rejected"]).optional().describe("Optional approval status filter."),
      assignedToFilter: z.string().optional().describe("Optional filter for approvals assigned to a specific user."),
      top: z.coerce.number().optional().describe("Optional maximum number of approvals to return."),
    },
    async ({ project, status, assignedToFilter, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const statusFilter = status ? APPROVAL_STATUS_MAP[status] : undefined;
        const releaseApi = await connection.getReleaseApi();
        const approvals = await releaseApi.getApprovals(ctx.project, assignedToFilter, statusFilter, undefined, undefined, top);

        if (!approvals || approvals.length === 0) {
          return { content: [{ type: "text", text: "No release approvals found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(approvals, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching release approvals: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    RELEASE_TOOLS.update_approval,
    "Approve or reject a release approval. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      approvalId: z.number().describe("The ID of the approval to update."),
      status: z.enum(["approved", "rejected", "pending"]).describe("The new approval status."),
      comments: z.string().optional().describe("Optional comments for the approval decision."),
    },
    async ({ project, approvalId, status, comments }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const approval: ReleaseApproval = { status: APPROVAL_STATUS_MAP[status], comments };
        const releaseApi = await connection.getReleaseApi();
        const result = await releaseApi.updateReleaseApproval(approval, ctx.project, approvalId);

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error updating release approval: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { RELEASE_TOOLS, configureReleaseTools };
