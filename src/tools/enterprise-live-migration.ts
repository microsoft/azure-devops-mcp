// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { apiVersion } from "../utils.js";

const ELM_TOOLS = {
  list: "enterprise-live-migration_list",
  status: "enterprise-live-migration_status",
  create: "enterprise-live-migration_create",
  pause: "enterprise-live-migration_pause",
  resume: "enterprise-live-migration_resume",
  cutover_set: "enterprise-live-migration_cutover_set",
  cutover_cancel: "enterprise-live-migration_cutover_cancel",
  abandon: "enterprise-live-migration_abandon",
  get_cutover_review: "enterprise-live-migration_get_cutover_review",
  approve_cutover: "enterprise-live-migration_approve_cutover",
  device_flow_config: "enterprise-live-migration_device_flow_config",
  pipelines_list: "enterprise-live-migration_pipelines_list",
  pipelines_submit: "enterprise-live-migration_pipelines_submit",
  pipelines_update: "enterprise-live-migration_pipelines_update",
  pipelines_delete: "enterprise-live-migration_pipelines_delete",
};

/**
 * Bitmask values for skipping specific validation checks when creating a migration.
 */
const SKIP_VALIDATION_FLAGS: Record<string, number> = {
  ActivePullRequestCount: 1,
  PullRequestDeltaSize: 2,
  AgentPoolExists: 4,
  MaxFileSize: 8,
  MaxPullRequestSize: 16,
  MaxPushPackSize: 32,
  MaxReferenceNameLength: 64,
  TargetRepositoryDoesNotExist: 256,
  SourceRepositoryContainsLfsObjects: 512,
  SourceRepositoryNotReadOnly: 1024,
  BoardsGitHubConnectionProvisioning: 2048,
  All: 2147483647,
};

const skipValidationFlagNames = Object.keys(SKIP_VALIDATION_FLAGS) as [string, ...string[]];

/**
 * Convert an array of skip-validation flag names to the combined bitmask value.
 */
function toSkipValidationBitmask(flags: string[]): number {
  let mask = 0;
  for (const flag of flags) {
    const value = SKIP_VALIDATION_FLAGS[flag];
    if (value !== undefined) {
      mask |= value;
    }
  }
  return mask;
}

/**
 * Make an authenticated fetch request to the ELM REST API.
 */
async function elmFetch(orgUrl: string, path: string, token: string, userAgent: string, options: { method?: string; body?: unknown } = {}): Promise<Response> {
  const url = `${orgUrl}/_apis/elm/migrations${path}?api-version=${apiVersion}`;
  return fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": userAgent,
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });
}

/**
 * Handle the fetch response: throw on error, return JSON text on success.
 */
async function handleResponse(response: Response, action: string): Promise<{ content: { type: "text"; text: string }[] }> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to ${action}: ${response.status} ${errorText}`);
  }
  const text = await response.text();
  // Try to pretty-print JSON, fall back to raw text
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    formatted = text;
  }
  return { content: [{ type: "text", text: formatted }] };
}

function configureEnterpriseLiveMigrationTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // Helper to get org URL, token, and user agent for every tool
  async function getContext() {
    const [token, connection] = await Promise.all([tokenProvider(), connectionProvider()]);
    return { orgUrl: connection.serverUrl, token, userAgent: userAgentProvider() };
  }

  // ── 1. List migrations ──────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.list,
    "List all Enterprise Live Migration (ELM) migrations for the organization. ELM migrates Azure DevOps Git repositories to GitHub. By default returns only the latest migration per repository.",
    {
      includeAllMigrations: z.boolean().optional().describe("If true, returns all migration records including historical entries. Defaults to false (latest per repository only)."),
      project: z.string().optional().describe("Optional project name or ID to filter migrations to a specific project."),
    },
    async ({ includeAllMigrations, project }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const params = new URLSearchParams();
        if (includeAllMigrations) params.set("includeAllMigrations", "true");
        if (project) params.set("project", project);
        const query = params.toString();
        const suffix = query ? `&${query}` : "";
        const url = `${orgUrl}/_apis/elm/migrations?api-version=${apiVersion}${suffix}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": userAgent,
          },
        });
        return await handleResponse(response, "list migrations");
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing migrations: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 2. Get migration status ─────────────────────────────────────────
  server.tool(
    ELM_TOOLS.status,
    "Get the status of an Enterprise Live Migration (ELM) for a specific repository.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the Azure DevOps repository."),
    },
    async ({ repositoryId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent);
        return await handleResponse(response, "get migration status");
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting migration status: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 3. Create migration ─────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.create,
    "Create a new Enterprise Live Migration (ELM) to migrate an Azure DevOps Git repository to GitHub. Starts validation and synchronization.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the Azure DevOps repository to migrate."),
      targetRepository: z.string().describe("The full target GitHub repository URL (e.g. https://example.ghe.com/orgname/reponame)."),
      targetOwnerUserId: z.string().optional().describe("The GitHub login of the migration owner. Required when GitHubUserToken is not provided."),
      gitHubUserToken: z
        .string()
        .optional()
        .describe("A GitHub token (Device Flow or PAT with read:org scope) to verify the migration owner's identity. When provided, targetOwnerUserId is set automatically by the server."),
      validateOnly: z.boolean().optional().describe("If true, only validate the migration without starting synchronization."),
      scheduledCutoverDate: z.string().optional().describe("ISO 8601 date-time for the scheduled cutover (must be in the future)."),
      skipValidation: z
        .array(z.enum(skipValidationFlagNames))
        .optional()
        .describe(
          "Validation checks to skip. Options: ActivePullRequestCount, PullRequestDeltaSize, AgentPoolExists, MaxFileSize, MaxPullRequestSize, MaxPushPackSize, MaxReferenceNameLength, TargetRepositoryDoesNotExist, SourceRepositoryContainsLfsObjects, SourceRepositoryNotReadOnly, BoardsGitHubConnectionProvisioning, All."
        ),
      agentPool: z.string().optional().describe("The agent pool name to use for the migration pipeline."),
      serviceEndpointId: z.string().optional().describe("The ID (GUID) of a GitHub Enterprise Server service connection for GHES migrations."),
      pipelineServiceConnectionId: z.string().optional().describe("The ID (GUID) of a GitHub service connection for pipeline rewiring."),
      configOptions: z
        .object({
          enableAutoDiscoverPipelines: z.boolean().optional().describe("Enable automatic pipeline discovery for rewiring."),
          skipSourceRepoLockdown: z.boolean().optional().describe("Skip setting the source ADO repo to read-only during cutover."),
          skipBranchPolicyMigration: z.boolean().optional().describe("Skip migrating branch policies to GitHub rulesets."),
          enableBoardsGitHubConnection: z.boolean().optional().describe("Enable automatic Azure Boards GitHub connection on cutover."),
        })
        .optional()
        .describe("Optional configuration options for the migration."),
    },
    async ({
      repositoryId,
      targetRepository,
      targetOwnerUserId,
      gitHubUserToken,
      validateOnly,
      scheduledCutoverDate,
      skipValidation,
      agentPool,
      serviceEndpointId,
      pipelineServiceConnectionId,
      configOptions,
    }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body: Record<string, unknown> = { targetRepository };
        if (targetOwnerUserId !== undefined) body.targetOwnerUserId = targetOwnerUserId;
        if (gitHubUserToken !== undefined) body.gitHubUserToken = gitHubUserToken;
        if (validateOnly !== undefined) body.validateOnly = validateOnly;
        if (scheduledCutoverDate !== undefined) body.scheduledCutoverDate = scheduledCutoverDate;
        if (skipValidation !== undefined) body.skipValidation = toSkipValidationBitmask(skipValidation);
        if (agentPool !== undefined) body.agentPoolName = agentPool;
        if (serviceEndpointId !== undefined) body.serviceEndpointId = serviceEndpointId;
        if (pipelineServiceConnectionId !== undefined) body.pipelineServiceConnectionId = pipelineServiceConnectionId;
        if (configOptions !== undefined) body.configOptions = configOptions;

        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "POST", body });
        return await handleResponse(response, "create migration");
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating migration: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 4. Pause migration ──────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.pause,
    "Pause (suspend) an active Enterprise Live Migration. The migration can be resumed later.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose migration to pause."),
    },
    async ({ repositoryId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body = { statusRequested: "Paused" };
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "pause migration");
      } catch (error) {
        return { content: [{ type: "text", text: `Error pausing migration: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 5. Resume migration ─────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.resume,
    "Resume a paused Enterprise Live Migration.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose migration to resume."),
      validateOnly: z.boolean().optional().describe("If true, resume in validate-only mode instead of full migration mode."),
    },
    async ({ repositoryId, validateOnly }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body: Record<string, unknown> = { statusRequested: "Active" };
        if (validateOnly !== undefined) body.validateOnly = validateOnly;
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "resume migration");
      } catch (error) {
        return { content: [{ type: "text", text: `Error resuming migration: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 6. Set cutover date ─────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.cutover_set,
    "Schedule the cutover date for an Enterprise Live Migration. The cutover date must be in the future.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose migration cutover to schedule."),
      scheduledCutoverDate: z.string().describe("ISO 8601 date-time for the scheduled cutover (must be in the future)."),
    },
    async ({ repositoryId, scheduledCutoverDate }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body = { scheduledCutoverDate };
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "set cutover date");
      } catch (error) {
        return { content: [{ type: "text", text: `Error setting cutover date: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 7. Cancel cutover ───────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.cutover_cancel,
    "Cancel a previously scheduled cutover for an Enterprise Live Migration.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose cutover to cancel."),
    },
    async ({ repositoryId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        // DateTimeOffset.MinValue ("0001-01-01T00:00:00+00:00") is the server sentinel for "clear cutover date"
        const body = { scheduledCutoverDate: "0001-01-01T00:00:00+00:00" };
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "cancel cutover");
      } catch (error) {
        return { content: [{ type: "text", text: `Error canceling cutover: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 8. Abandon migration ────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.abandon,
    "Abandon (delete) an Enterprise Live Migration. This cannot be undone.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose migration to abandon."),
      removeReadOnly: z.boolean().optional().describe("If true and the migration has reached the Migrated stage, takes the source ADO repository out of read-only mode."),
    },
    async ({ repositoryId, removeReadOnly }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const params = removeReadOnly ? `&removeReadOnly=true` : "";
        const url = `${orgUrl}/_apis/elm/migrations/${repositoryId}?api-version=${apiVersion}${params}`;
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": userAgent,
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to abandon migration: ${response.status} ${errorText}`);
        }
        return { content: [{ type: "text", text: "Migration abandoned successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error abandoning migration: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 9. Get cutover review ───────────────────────────────────────────
  server.tool(
    ELM_TOOLS.get_cutover_review,
    "Get the cutover review for an Enterprise Live Migration. Shows failed, blocked, and pending items that may need approval before cutover can proceed.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository to get the cutover review for."),
    },
    async ({ repositoryId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const response = await elmFetch(orgUrl, `/${repositoryId}/cutoverReview`, token, userAgent);
        return await handleResponse(response, "get cutover review");
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting cutover review: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 10. Approve cutover ─────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.approve_cutover,
    "Approve cutover for an Enterprise Live Migration by accepting the specified number of failures. The count must be >= the total unprocessed items from the cutover review.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository whose cutover to approve."),
      cutoverFailureAcceptedCount: z.number().int().min(0).describe("The number of cutover failures to accept. Must be >= totalUnprocessedCount from the cutover review."),
    },
    async ({ repositoryId, cutoverFailureAcceptedCount }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body = { cutoverFailureAcceptedCount };
        const response = await elmFetch(orgUrl, `/${repositoryId}`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "approve cutover");
      } catch (error) {
        return { content: [{ type: "text", text: `Error approving cutover: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 11. Get device flow config ──────────────────────────────────────
  server.tool(
    ELM_TOOLS.device_flow_config,
    "Get the GitHub App device flow configuration (client ID and enterprise URL) needed to authenticate for a migration.",
    {
      targetRepository: z.string().describe("The full target repository URL (e.g. https://example.ghe.com/orgname/reponame)."),
    },
    async ({ targetRepository }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const url = `${orgUrl}/_apis/elm/migrations/deviceFlowConfig?api-version=${apiVersion}&targetRepository=${encodeURIComponent(targetRepository)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": userAgent,
          },
        });
        return await handleResponse(response, "get device flow config");
      } catch (error) {
        return { content: [{ type: "text", text: `Error getting device flow config: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 12. List pipelines ──────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.pipelines_list,
    "List pipelines and their rewiring status for an Enterprise Live Migration.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository."),
    },
    async ({ repositoryId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const response = await elmFetch(orgUrl, `/${repositoryId}/pipelines`, token, userAgent);
        return await handleResponse(response, "list pipelines");
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing pipelines: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 13. Submit pipelines ────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.pipelines_submit,
    "Submit pipelines for rewiring as part of an Enterprise Live Migration. Triggers classification and pre-checks.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository."),
      pipelineIds: z.array(z.number().int()).describe("The build definition IDs of the pipelines to rewire."),
      serviceConnectionId: z.string().describe("The ID (GUID) of the GitHub service connection for the rewired pipelines."),
      repositoryMappings: z
        .array(
          z.object({
            sourceRepositoryId: z.string().describe("The AzDO repository GUID of the source repository."),
            targetRepository: z.string().describe("The GitHub target repository in 'owner/repo' format."),
          })
        )
        .optional()
        .describe("Cross-repo mappings for pipelines that reference other AzDO repositories."),
    },
    async ({ repositoryId, pipelineIds, serviceConnectionId, repositoryMappings }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body: Record<string, unknown> = { pipelineIds, serviceConnectionId };
        if (repositoryMappings !== undefined) body.repositoryMappings = repositoryMappings;
        const response = await elmFetch(orgUrl, `/${repositoryId}/pipelines`, token, userAgent, { method: "POST", body });
        return await handleResponse(response, "submit pipelines");
      } catch (error) {
        return { content: [{ type: "text", text: `Error submitting pipelines: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 14. Update pipelines ────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.pipelines_update,
    "Update the pipeline rewiring configuration for an Enterprise Live Migration.",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository."),
      addPipelineIds: z.array(z.number().int()).optional().describe("Pipeline definition IDs to add to the rewiring selection."),
      removePipelineIds: z.array(z.number().int()).optional().describe("Pipeline definition IDs to remove. Clones will be deleted."),
      serviceConnectionId: z.string().optional().describe("Updated GitHub service connection ID."),
      repositoryMappings: z
        .array(
          z.object({
            sourceRepositoryId: z.string().describe("The AzDO repository GUID."),
            targetRepository: z.string().describe("The GitHub target repository in 'owner/repo' format."),
          })
        )
        .optional()
        .describe("Repository mappings to add or update."),
      retryFailedPipelineIds: z.array(z.number().int()).optional().describe("Pipeline IDs in Failed status to retry on the next sync cycle."),
      acknowledgePipelineIds: z.array(z.number().int()).optional().describe("Pipeline IDs to acknowledge so they do not block cutover."),
    },
    async ({ repositoryId, addPipelineIds, removePipelineIds, serviceConnectionId, repositoryMappings, retryFailedPipelineIds, acknowledgePipelineIds }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const body: Record<string, unknown> = {};
        if (addPipelineIds !== undefined) body.addPipelineIds = addPipelineIds;
        if (removePipelineIds !== undefined) body.removePipelineIds = removePipelineIds;
        if (serviceConnectionId !== undefined) body.serviceConnectionId = serviceConnectionId;
        if (repositoryMappings !== undefined) body.repositoryMappings = repositoryMappings;
        if (retryFailedPipelineIds !== undefined) body.retryFailedPipelineIds = retryFailedPipelineIds;
        if (acknowledgePipelineIds !== undefined) body.acknowledgePipelineIds = acknowledgePipelineIds;
        const response = await elmFetch(orgUrl, `/${repositoryId}/pipelines`, token, userAgent, { method: "PUT", body });
        return await handleResponse(response, "update pipelines");
      } catch (error) {
        return { content: [{ type: "text", text: `Error updating pipelines: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── 15. Delete pipelines ────────────────────────────────────────────
  server.tool(
    ELM_TOOLS.pipelines_delete,
    "Delete all pipeline clone definitions and config for an Enterprise Live Migration. Only allowed for terminal migrations (Failed or Completed).",
    {
      repositoryId: z.string().describe("The ID (GUID) of the repository."),
      migrationId: z.number().int().describe("The migration ID to delete pipelines for."),
    },
    async ({ repositoryId, migrationId }) => {
      try {
        const { orgUrl, token, userAgent } = await getContext();
        const url = `${orgUrl}/_apis/elm/migrations/${repositoryId}/pipelines?api-version=${apiVersion}&migrationId=${migrationId}`;
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": userAgent,
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete pipelines: ${response.status} ${errorText}`);
        }
        return { content: [{ type: "text", text: "Pipeline configurations deleted successfully." }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error deleting pipelines: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}

export { configureEnterpriseLiveMigrationTools };
