// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiVersion, getEnumKeys, safeEnumConvert } from "../utils.js";
import { WebApi } from "azure-devops-node-api";
import { BuildQueryOrder, DefinitionQueryOrder } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { z } from "zod";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { ConfigurationType, RepositoryType } from "azure-devops-node-api/interfaces/PipelinesInterfaces.js";
import { mkdirSync, createWriteStream } from "fs";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { join, posix, resolve, win32 } from "path";

const PIPELINE_TOOLS = {
  pipelines_build: "pipelines_build",
  pipelines_build_log: "pipelines_build_log",
  pipelines_definition: "pipelines_definition",
  pipelines_run: "pipelines_run",
  pipelines_artifact: "pipelines_artifact",
  pipelines_write: "pipelines_write",
};

function configurePipelineTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // ─── pipelines_build ────────────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_build,
    "Retrieve build data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list", "get_status", "get_changes"])
        .describe(
          "The action to perform. Options: list (list builds with optional filters), get_status (get status, issues, and report metadata for a build), get_changes (get commits and work items associated with a build)."
        ),
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().min(1).optional().describe("ID of the build. Required for: get_status, get_changes."),
      // list-specific
      definitions: z.array(z.coerce.number().min(1)).optional().describe("Array of build definition IDs to filter builds. Used for: list."),
      queues: z.array(z.coerce.number().min(1)).optional().describe("Array of queue IDs to filter builds. Used for: list."),
      buildNumber: z.string().optional().describe("Build number to filter builds. Used for: list."),
      minTime: z.coerce.date().optional().describe("Minimum finish time to filter builds. Used for: list."),
      maxTime: z.coerce.date().optional().describe("Maximum finish time to filter builds. Used for: list."),
      requestedFor: z.string().optional().describe("User ID or name who requested the build. Used for: list."),
      reasonFilter: z.number().optional().describe("Reason filter (see BuildReason enum). Used for: list."),
      statusFilter: z.number().optional().describe("Status filter (see BuildStatus enum). Used for: list."),
      resultFilter: z.number().optional().describe("Result filter (see BuildResult enum). Used for: list."),
      tagFilters: z.array(z.string()).optional().describe("Array of tags to filter builds. Used for: list."),
      properties: z.array(z.string()).optional().describe("Array of property names to include in results. Used for: list."),
      top: z.number().optional().describe("Maximum number of builds to return. Used for: list, get_changes."),
      continuationToken: z.string().optional().describe("Token for continuing paged results. Used for: list, get_changes."),
      maxBuildsPerDefinition: z.number().optional().describe("Maximum number of builds per definition. Used for: list."),
      deletedFilter: z.number().optional().describe("Filter for deleted builds (see QueryDeletedOption enum). Used for: list."),
      queryOrder: z.string().optional().describe("Order in which builds are returned (BuildQueryOrder values). Used for: list."),
      branchName: z.string().optional().describe("Branch name to filter builds. Used for: list."),
      buildIds: z.array(z.coerce.number().min(1)).optional().describe("Array of specific build IDs to retrieve. Used for: list."),
      repositoryId: z.string().optional().describe("Repository ID to filter builds. Used for: list."),
      repositoryType: z.enum(["TfsGit", "GitHub", "BitbucketCloud"]).optional().describe("Repository type to filter builds. Used for: list."),
      // get_changes-specific
      includeSourceChange: z.boolean().optional().describe("Whether to include source changes in results. Used for: get_changes."),
    },
    async ({
      action,
      project,
      buildId,
      definitions,
      queues,
      buildNumber,
      minTime,
      maxTime,
      requestedFor,
      reasonFilter,
      statusFilter,
      resultFilter,
      tagFilters,
      properties,
      top,
      continuationToken,
      maxBuildsPerDefinition,
      deletedFilter,
      queryOrder,
      branchName,
      buildIds,
      repositoryId,
      repositoryType,
      includeSourceChange,
    }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();

        if (action === "list") {
          const builds = await buildApi.getBuilds(
            project,
            definitions,
            queues,
            buildNumber,
            minTime,
            maxTime,
            requestedFor,
            reasonFilter,
            statusFilter,
            resultFilter,
            tagFilters,
            properties,
            top,
            continuationToken,
            maxBuildsPerDefinition,
            deletedFilter,
            safeEnumConvert(BuildQueryOrder, queryOrder),
            branchName,
            buildIds,
            repositoryId,
            repositoryType
          );
          return { content: [{ type: "text", text: JSON.stringify(builds, null, 2) }] };
        }

        if (action === "get_status") {
          if (!buildId) return { content: [{ type: "text", text: "buildId is required for get_status" }], isError: true };
          const build = await buildApi.getBuildReport(project, buildId);
          return { content: [{ type: "text", text: JSON.stringify(build, null, 2) }] };
        }

        if (action === "get_changes") {
          if (!buildId) return { content: [{ type: "text", text: "buildId is required for get_changes" }], isError: true };
          const changes = await buildApi.getBuildChanges(project, buildId, continuationToken, top, includeSourceChange);
          return { content: [{ type: "text", text: JSON.stringify(changes, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error fetching builds: ${errorMessage}`,
          get_status: `Error fetching build: ${errorMessage}`,
          get_changes: `Error fetching build changes: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // ─── pipelines_build_log ────────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_build_log,
    "Retrieve build log data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "get_content"]).describe("The action to perform. Options: list (list available logs for a build), get_content (get the text content of a specific log by ID)."),
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().min(1).describe("ID of the build. Required for all actions."),
      logId: z.coerce.number().min(1).optional().describe("ID of the log to retrieve. Required for: get_content."),
      startLine: z.coerce.number().optional().describe("Starting line number for the log content, defaults to 0. Used for: get_content."),
      endLine: z.coerce.number().optional().describe("Ending line number for the log content, defaults to end of log. Used for: get_content."),
    },
    async ({ action, project, buildId, logId, startLine, endLine }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();

        if (action === "list") {
          const logs = await buildApi.getBuildLogs(project, buildId);
          return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
        }

        if (action === "get_content") {
          if (!logId) return { content: [{ type: "text", text: "logId is required for get_content" }], isError: true };
          const logLines = await buildApi.getBuildLogLines(project, buildId, logId, startLine, endLine);
          return createExternalContentResponse(logLines, "build log");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error fetching build log: ${errorMessage}`,
          get_content: `Error fetching build log: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // ─── pipelines_definition ───────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_definition,
    "Retrieve pipeline definition data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list", "list_revisions"])
        .describe("The action to perform. Options: list (list pipeline definitions with optional filters), list_revisions (list revision history for a pipeline definition)."),
      project: z.string().describe("Project ID or name."),
      definitionId: z.coerce.number().min(1).optional().describe("ID of the build definition. Required for: list_revisions."),
      // list-specific
      repositoryId: z.string().optional().describe("Repository ID to filter definitions. Can be a GUID or name (auto-resolved for TfsGit). Used for: list."),
      repositoryType: z.enum(["TfsGit", "GitHub", "BitbucketCloud"]).optional().describe("Repository type to filter definitions. Used for: list."),
      name: z.string().optional().describe("Name filter for build definitions. Used for: list."),
      path: z.string().optional().describe("Path filter for build definitions. Used for: list."),
      queryOrder: z.string().optional().describe("Order in which definitions are returned (DefinitionQueryOrder values). Used for: list."),
      top: z.number().optional().describe("Maximum number of definitions to return. Used for: list."),
      continuationToken: z.string().optional().describe("Token for continuing paged results. Used for: list."),
      minMetricsTime: z.coerce.date().optional().describe("Minimum metrics time to filter definitions. Used for: list."),
      definitionIds: z.array(z.coerce.number().min(1)).optional().describe("Array of definition IDs to filter. Used for: list."),
      builtAfter: z.coerce.date().optional().describe("Return definitions that have builds after this date. Used for: list."),
      notBuiltAfter: z.coerce.date().optional().describe("Return definitions without builds after this date. Used for: list."),
      includeAllProperties: z.boolean().optional().describe("Whether to include all properties in results. Used for: list."),
      includeLatestBuilds: z.boolean().optional().describe("Whether to include the latest builds for each definition. Used for: list."),
      taskIdFilter: z.string().optional().describe("Task ID to filter build definitions. Used for: list."),
      processType: z.number().optional().describe("Process type to filter build definitions. Used for: list."),
      yamlFilename: z.string().optional().describe("YAML filename to filter build definitions. Used for: list."),
    },
    async ({
      action,
      project,
      definitionId,
      repositoryId,
      repositoryType,
      name,
      path,
      queryOrder,
      top,
      continuationToken,
      minMetricsTime,
      definitionIds,
      builtAfter,
      notBuiltAfter,
      includeAllProperties,
      includeLatestBuilds,
      taskIdFilter,
      processType,
      yamlFilename,
    }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();

        if (action === "list") {
          let resolvedRepositoryId = repositoryId;

          if (repositoryId) {
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(repositoryId);

            if (!isGuid && (!repositoryType || repositoryType === "TfsGit")) {
              const gitApi = await connection.getGitApi();
              const repositories = await gitApi.getRepositories(project);
              const repo = repositories?.find((r) => r.name === repositoryId);

              if (!repo?.id) {
                return { content: [{ type: "text", text: `Error: Repository '${repositoryId}' not found in project '${project}'.` }], isError: true };
              }

              resolvedRepositoryId = repo.id;
            }
          }
          const defs = await buildApi.getDefinitions(
            project,
            name,
            resolvedRepositoryId,
            repositoryType,
            safeEnumConvert(DefinitionQueryOrder, queryOrder),
            top,
            continuationToken,
            minMetricsTime,
            definitionIds,
            path,
            builtAfter,
            notBuiltAfter,
            includeAllProperties,
            includeLatestBuilds,
            taskIdFilter,
            processType,
            yamlFilename
          );
          return { content: [{ type: "text", text: JSON.stringify(defs, null, 2) }] };
        }

        if (action === "list_revisions") {
          if (!definitionId) return { content: [{ type: "text", text: "definitionId is required for list_revisions" }], isError: true };
          const revisions = await buildApi.getDefinitionRevisions(project, definitionId);
          return { content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error fetching build definitions: ${errorMessage}`,
          list_revisions: `Error fetching build definition revisions: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // ─── pipelines_run ──────────────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_run,
    "Retrieve pipeline run data for a project. Use the action parameter to specify the operation.",
    {
      action: z.enum(["get", "list"]).describe("The action to perform. Options: get (get a single pipeline run), list (list runs for a pipeline)."),
      project: z.string().describe("Project ID or name."),
      pipelineId: z.coerce.number().min(1).describe("ID of the pipeline. Required for all actions."),
      runId: z.coerce.number().min(1).optional().describe("ID of the run. Required for: get."),
    },
    async ({ action, project, pipelineId, runId }) => {
      try {
        const connection = await connectionProvider();
        const pipelinesApi = await connection.getPipelinesApi();

        if (action === "get") {
          if (!runId) return { content: [{ type: "text", text: "runId is required for get" }], isError: true };
          const run = await pipelinesApi.getRun(project, pipelineId, runId);
          return { content: [{ type: "text", text: JSON.stringify(run, null, 2) }] };
        }

        if (action === "list") {
          const runs = await pipelinesApi.listRuns(project, pipelineId);
          return { content: [{ type: "text", text: JSON.stringify(runs, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error fetching pipeline run: ${errorMessage}`,
          list: `Error fetching pipeline runs: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // ─── pipelines_artifact ─────────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_artifact,
    "Retrieve and download build artifacts. Use the action parameter to specify the operation.",
    {
      action: z.enum(["list", "download"]).describe("The action to perform. Options: list (list artifacts for a build), download (download a named build artifact)."),
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().min(1).describe("ID of the build. Required for all actions."),
      artifactName: z.string().optional().describe("Name of the artifact. Required for: download."),
      destinationPath: z.string().optional().describe("Relative local path to download the artifact to. If not provided, returns base64 content. Used for: download."),
    },
    async ({ action, project, buildId, artifactName, destinationPath }) => {
      try {
        // Validate artifact/path inputs before making any network calls
        if (action === "download") {
          if (!artifactName) return { content: [{ type: "text", text: "artifactName is required for download" }], isError: true };

          const hasUnsafePathSegment = (value: string) => value.split(/[\\/]+/).some((segment) => segment === "." || segment === "..");
          const hasPathSeparators = (value: string) => /[\\/]/.test(value);
          const hasDriveLetter = (value: string) => /^[a-zA-Z]:/.test(value);
          const isAbsolutePath = (value: string) => posix.isAbsolute(value) || win32.isAbsolute(value);

          if (hasUnsafePathSegment(artifactName) || hasPathSeparators(artifactName) || hasDriveLetter(artifactName) || isAbsolutePath(artifactName)) {
            throw new Error("Invalid artifactName: artifactName must be a file name, not a path.");
          }
          if (destinationPath && (hasUnsafePathSegment(destinationPath) || isAbsolutePath(destinationPath) || hasDriveLetter(destinationPath))) {
            throw new Error("Invalid destinationPath: use a relative path without path traversal.");
          }
        }

        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();

        if (action === "list") {
          const artifacts = await buildApi.getArtifacts(project, buildId);
          return { content: [{ type: "text", text: JSON.stringify(artifacts, null, 2) }] };
        }

        if (action === "download") {
          const resolvedArtifactName = artifactName as string; // validated in pre-flight check above
          const artifact = await buildApi.getArtifact(project, buildId, resolvedArtifactName);

          if (!artifact) {
            return { content: [{ type: "text", text: `Artifact ${resolvedArtifactName} not found in build ${buildId}.` }], isError: true };
          }

          const fileStream = await buildApi.getArtifactContentZip(project, buildId, resolvedArtifactName);

          if (destinationPath) {
            const fullDestinationPath = resolve(destinationPath);
            mkdirSync(fullDestinationPath, { recursive: true });
            const fileDestinationPath = join(fullDestinationPath, `${resolvedArtifactName}.zip`);
            const writeStream = createWriteStream(fileDestinationPath);

            await new Promise<void>((resolve, reject) => {
              fileStream.pipe(writeStream);
              fileStream.on("end", () => resolve());
              fileStream.on("error", (err) => reject(err));
            });

            return { content: [{ type: "text", text: `Artifact ${resolvedArtifactName} downloaded to ${destinationPath}.` }] };
          }

          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            fileStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            fileStream.on("end", () => resolve());
            fileStream.on("error", (err) => reject(err));
          });

          const buffer = Buffer.concat(chunks);
          const base64Data = buffer.toString("base64");

          return {
            content: [{ type: "resource", resource: { uri: `data:application/zip;base64,${base64Data}`, mimeType: "application/zip", text: base64Data } }],
          };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error fetching artifacts: ${errorMessage}`,
          download: `Error downloading artifact: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  const variableSchema = z.object({
    value: z.string().optional(),
    isSecret: z.boolean().optional(),
  });

  const resourcesSchema = z.object({
    builds: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
    containers: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
    packages: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
    pipelines: z.record(
      z.string(),
      z.object({
        runId: z.coerce.number().min(1).optional().describe("Id of the source pipeline run."),
        version: z.string().optional(),
      })
    ),
    repositories: z
      .record(
        z.string(),
        z.object({
          refName: z.string().describe("Reference name, e.g., refs/heads/main."),
          token: z.string().optional(),
          tokenType: z.string().optional(),
          version: z.string().optional(),
        })
      )
      .optional(),
  });

  // ─── pipelines_write ────────────────────────────────────────────────────────
  server.tool(
    PIPELINE_TOOLS.pipelines_write,
    "Write operations for pipelines and builds. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["run_pipeline", "create_pipeline", "update_build_stage"])
        .describe(
          "The action to perform. Options: run_pipeline (queue a new pipeline run), create_pipeline (create a new YAML pipeline definition), update_build_stage (cancel, retry, or run a stage on an in-flight build)."
        ),
      project: z.string().describe("Project ID or name."),
      // run_pipeline params
      pipelineId: z.coerce.number().min(1).optional().describe("ID of the pipeline to run. Required for: run_pipeline."),
      pipelineVersion: z.coerce.number().min(1).optional().describe("Version of the pipeline to run. Used for: run_pipeline."),
      previewRun: z.boolean().optional().describe("If true, returns the final YAML without creating a run. Used for: run_pipeline."),
      resources: resourcesSchema.optional().describe("Resources to pass to the pipeline. Used for: run_pipeline."),
      stagesToSkip: z.array(z.string()).optional().describe("Stages to skip. Used for: run_pipeline."),
      templateParameters: z.record(z.string(), z.string()).optional().describe("Custom build parameters as key-value pairs. Used for: run_pipeline."),
      variables: z.record(z.string(), variableSchema).optional().describe("Variables to pass to the pipeline. Used for: run_pipeline."),
      yamlOverride: z.string().optional().describe("YAML override (only valid with previewRun). Used for: run_pipeline."),
      // create_pipeline params
      name: z.string().optional().describe("Name of the new pipeline. Required for: create_pipeline."),
      folder: z.string().optional().describe("Folder path for the new pipeline. Used for: create_pipeline."),
      yamlPath: z.string().optional().describe("Path to the YAML file in the repository. Required for: create_pipeline."),
      repositoryType: z
        .enum(getEnumKeys(RepositoryType) as [string, ...string[]])
        .optional()
        .describe("Type of the repository. Required for: create_pipeline."),
      repositoryName: z.string().optional().describe("Name of the repository (for GitHub: owner/repo). Required for: create_pipeline."),
      repositoryId: z.string().optional().describe("ID of the repository. Used for: create_pipeline."),
      repositoryConnectionId: z.string().optional().describe("Service connection ID for GitHub repositories. Used for: create_pipeline."),
      // update_build_stage params
      buildId: z.coerce.number().min(1).optional().describe("ID of the build to update. Required for: update_build_stage."),
      stageName: z.string().optional().describe("Name of the stage to update. Required for: update_build_stage."),
      status: z
        .enum(getEnumKeys(StageUpdateType) as [string, ...string[]])
        .optional()
        .describe("New status for the stage. Required for: update_build_stage."),
      forceRetryAllJobs: z.boolean().default(false).describe("Whether to force retry all jobs in the stage. Used for: update_build_stage."),
    },
    async ({
      action,
      project,
      pipelineId,
      pipelineVersion,
      previewRun,
      resources,
      stagesToSkip,
      templateParameters,
      variables,
      yamlOverride,
      name,
      folder,
      yamlPath,
      repositoryType,
      repositoryName,
      repositoryId,
      repositoryConnectionId,
      buildId,
      stageName,
      status,
      forceRetryAllJobs,
    }) => {
      try {
        if (action === "run_pipeline") {
          if (!pipelineId) return { content: [{ type: "text", text: "pipelineId is required for run_pipeline" }], isError: true };
          if (!previewRun && yamlOverride) throw new Error("Parameter 'yamlOverride' can only be specified together with parameter 'previewRun'.");
        }

        if (action === "create_pipeline") {
          if (!name) return { content: [{ type: "text", text: "name is required for create_pipeline" }], isError: true };
          if (!yamlPath) return { content: [{ type: "text", text: "yamlPath is required for create_pipeline" }], isError: true };
          if (!repositoryType) return { content: [{ type: "text", text: "repositoryType is required for create_pipeline" }], isError: true };
          if (!repositoryName) return { content: [{ type: "text", text: "repositoryName is required for create_pipeline" }], isError: true };
        }

        if (action === "update_build_stage") {
          if (!buildId) return { content: [{ type: "text", text: "buildId is required for update_build_stage" }], isError: true };
          if (!stageName) return { content: [{ type: "text", text: "stageName is required for update_build_stage" }], isError: true };
          if (!status) return { content: [{ type: "text", text: "status is required for update_build_stage" }], isError: true };
        }

        const connection = await connectionProvider();

        if (action === "run_pipeline") {
          const pipelinesApi = await connection.getPipelinesApi();
          const runRequest = { previewRun, resources: { ...resources }, stagesToSkip, templateParameters, variables, yamlOverride };
          const pipelineRun = await pipelinesApi.runPipeline(runRequest, project, pipelineId as number, pipelineVersion);

          if (pipelineRun.id === undefined) throw new Error("Failed to get build ID from pipeline run");

          return { content: [{ type: "text", text: JSON.stringify(pipelineRun, null, 2) }] };
        }

        if (action === "create_pipeline") {
          const pipelinesApi = await connection.getPipelinesApi();
          const repositoryTypeEnumValue = safeEnumConvert(RepositoryType, repositoryType);
          const repositoryPayload: Record<string, unknown> = { type: repositoryType };

          if (repositoryTypeEnumValue === RepositoryType.AzureReposGit) {
            repositoryPayload.id = repositoryId;
            repositoryPayload.name = repositoryName;
          } else if (repositoryTypeEnumValue === RepositoryType.GitHub) {
            if (!repositoryConnectionId) throw new Error("Parameter 'repositoryConnectionId' is required for GitHub repositories.");
            repositoryPayload.connection = { id: repositoryConnectionId };
            repositoryPayload.fullname = repositoryName;
          } else {
            throw new Error("Unsupported repository type");
          }

          const yamlConfigurationType = getEnumKeys(ConfigurationType).find((k) => ConfigurationType[k as keyof typeof ConfigurationType] === ConfigurationType.Yaml);
          const createParams: Record<string, unknown> = {
            name,
            folder: folder || "\\",
            configuration: { type: yamlConfigurationType, path: yamlPath, repository: repositoryPayload, variables: undefined },
          };
          const newPipeline = await pipelinesApi.createPipeline(createParams, project);

          return { content: [{ type: "text", text: JSON.stringify(newPipeline, null, 2) }] };
        }

        if (action === "update_build_stage") {
          const orgUrl = connection.serverUrl;
          const endpoint = `${orgUrl}/${encodeURIComponent(project)}/_apis/build/builds/${buildId as number}/stages/${encodeURIComponent(stageName as string)}?api-version=${apiVersion}`;
          const token = await tokenProvider();
          const body = { forceRetryAllJobs, state: safeEnumConvert(StageUpdateType, status as string) };
          const response = await fetch(endpoint, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "User-Agent": userAgentProvider() },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update build stage: ${response.status} ${errorText}`);
          }

          const updatedBuild = await response.text();

          return { content: [{ type: "text", text: JSON.stringify(updatedBuild, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          run_pipeline: `Error running pipeline: ${errorMessage}`,
          create_pipeline: `Error creating pipeline: ${errorMessage}`,
          update_build_stage: `Error updating build stage: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { PIPELINE_TOOLS, configurePipelineTools };
