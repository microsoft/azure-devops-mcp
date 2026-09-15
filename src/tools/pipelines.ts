// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { apiVersion, getEnumKeys, safeEnumConvert } from "../utils.js";
import { WebApi } from "azure-devops-node-api";
import { BuildQueryOrder, DefinitionQueryOrder, Build, BuildStatus, TaskResult } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { z } from "zod";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { ConfigurationType, RepositoryType } from "azure-devops-node-api/interfaces/PipelinesInterfaces.js";
import { mkdirSync, createWriteStream } from "fs";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { join, posix, resolve, win32 } from "path";

const PIPELINE_TOOLS = {
  pipelines_get_builds: "pipelines_get_builds",
  pipelines_get_build_changes: "pipelines_get_build_changes",
  pipelines_get_build_definitions: "pipelines_get_build_definitions",
  pipelines_get_build_definition_revisions: "pipelines_get_build_definition_revisions",
  pipelines_get_build_log: "pipelines_get_build_log",
  pipelines_get_build_log_by_id: "pipelines_get_build_log_by_id",
  pipelines_get_build_status: "pipelines_get_build_status",
  pipelines_update_build_stage: "pipelines_update_build_stage",
  pipelines_create_pipeline: "pipelines_create_pipeline",
  pipelines_get_run: "pipelines_get_run",
  pipelines_list_runs: "pipelines_list_runs",
  pipelines_run_pipeline: "pipelines_run_pipeline",
  pipelines_list_artifacts: "pipelines_list_artifacts",
  pipelines_download_artifact: "pipelines_download_artifact",
  pipelines_get_build: "pipelines_get_build",
  pipelines_get_build_definition: "pipelines_get_build_definition",
  pipelines_queue_build: "pipelines_queue_build",
  pipelines_cancel_build: "pipelines_cancel_build",
  pipelines_get_build_timeline: "pipelines_get_build_timeline",
  pipelines_get_build_tags: "pipelines_get_build_tags",
  pipelines_add_build_tag: "pipelines_add_build_tag",
  pipelines_delete_build_tag: "pipelines_delete_build_tag",
};

function configurePipelineTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_definitions,
    "Retrieves a list of build definitions for a given project.",
    {
      project: z.string().describe("Project ID or name to get build definitions for"),
      repositoryId: z
        .string()
        .optional()
        .describe(
          "Repository ID to filter build definitions. Can be a GUID or a repository name; when a name is provided, it is auto-resolved to the repository GUID using the project parameter (Azure Repos / TfsGit only)."
        ),
      repositoryType: z.enum(["TfsGit", "GitHub", "BitbucketCloud"]).optional().describe("Type of repository to filter build definitions"),
      name: z.string().optional().describe("Name of the build definition to filter"),
      path: z.string().optional().describe("Path of the build definition to filter"),
      queryOrder: z
        .enum(getEnumKeys(DefinitionQueryOrder) as [string, ...string[]])
        .optional()
        .describe("Order in which build definitions are returned"),
      top: z.number().optional().describe("Maximum number of build definitions to return"),
      continuationToken: z.string().optional().describe("Token for continuing paged results"),
      minMetricsTime: z.coerce.date().optional().describe("Minimum metrics time to filter build definitions"),
      definitionIds: z.array(z.coerce.number().min(1)).optional().describe("Array of build definition IDs to filter"),
      builtAfter: z.coerce.date().optional().describe("Return definitions that have builds after this date"),
      notBuiltAfter: z.coerce.date().optional().describe("Return definitions that do not have builds after this date"),
      includeAllProperties: z.boolean().optional().describe("Whether to include all properties in the results"),
      includeLatestBuilds: z.boolean().optional().describe("Whether to include the latest builds for each definition"),
      taskIdFilter: z.string().optional().describe("Task ID to filter build definitions"),
      processType: z.number().optional().describe("Process type to filter build definitions"),
      yamlFilename: z.string().optional().describe("YAML filename to filter build definitions"),
    },
    async ({
      project,
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
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();

      // Auto-resolve repositoryId from name to GUID for Azure Repos
      let resolvedRepositoryId = repositoryId;
      if (repositoryId) {
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(repositoryId);
        if (!isGuid && (!repositoryType || repositoryType === "TfsGit")) {
          const gitApi = await connection.getGitApi();
          const repositories = await gitApi.getRepositories(project);
          const repo = repositories?.find((r) => r.name === repositoryId);
          if (!repo?.id) {
            return {
              content: [{ type: "text", text: `Error: Repository '${repositoryId}' not found in project '${project}'.` }],
              isError: true,
            };
          }
          resolvedRepositoryId = repo.id;
        }
      }

      const buildDefinitions = await buildApi.getDefinitions(
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

      return {
        content: [{ type: "text", text: JSON.stringify(buildDefinitions, null, 2) }],
      };
    }
  );

  const variableSchema = z.object({
    value: z.string().optional(),
    isSecret: z.boolean().optional(),
  });

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_create_pipeline,
    "Creates a pipeline definition with YAML configuration for a given project.",
    {
      project: z.string().describe("Project ID or name to run the build in."),
      name: z.string().describe("Name of the new pipeline."),
      folder: z.string().optional().describe("Folder path for the new pipeline. Defaults to '\\' if not specified."),
      yamlPath: z.string().describe("The path to the pipeline's YAML file in the repository"),
      repositoryType: z.enum(getEnumKeys(RepositoryType) as [string, ...string[]]).describe("The type of repository where the pipeline's YAML file is located."),
      repositoryName: z.string().describe("The name of the repository. In case of GitHub repository, this is the full name (:owner/:repo) - e.g. octocat/Hello-World."),
      repositoryId: z.string().optional().describe("The ID of the repository."),
      repositoryConnectionId: z.string().optional().describe("The service connection ID for GitHub repositories. Not required for Azure Repos Git."),
    },
    async ({ project, name, folder, yamlPath, repositoryType, repositoryName, repositoryId, repositoryConnectionId }) => {
      const connection = await connectionProvider();
      const pipelinesApi = await connection.getPipelinesApi();

      const repositoryTypeEnumValue = safeEnumConvert(RepositoryType, repositoryType);
      const repositoryPayload: any = {
        type: repositoryType,
      };
      if (repositoryTypeEnumValue === RepositoryType.AzureReposGit) {
        repositoryPayload.id = repositoryId;
        repositoryPayload.name = repositoryName;
      } else if (repositoryTypeEnumValue === RepositoryType.GitHub) {
        if (!repositoryConnectionId) {
          throw new Error("Parameter 'repositoryConnectionId' is required for GitHub repositories.");
        }
        repositoryPayload.connection = { id: repositoryConnectionId };
        repositoryPayload.fullname = repositoryName;
      } else {
        throw new Error("Unsupported repository type");
      }

      const yamlConfigurationType = getEnumKeys(ConfigurationType).find((k) => ConfigurationType[k as keyof typeof ConfigurationType] === ConfigurationType.Yaml);

      const createPipelineParams: any = {
        name: name,
        folder: folder || "\\",
        configuration: {
          type: yamlConfigurationType,
          path: yamlPath,
          repository: repositoryPayload,
          variables: undefined,
        },
      };

      const newPipeline = await pipelinesApi.createPipeline(createPipelineParams, project);
      return {
        content: [{ type: "text", text: JSON.stringify(newPipeline, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_definition_revisions,
    "Retrieves a list of revisions for a specific build definition.",
    {
      project: z.string().describe("Project ID or name to get the build definition revisions for"),
      definitionId: z.coerce.number().min(1).describe("ID of the build definition to get revisions for"),
    },
    async ({ project, definitionId }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const revisions = await buildApi.getDefinitionRevisions(project, definitionId);

      return {
        content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_builds,
    "Retrieves a list of builds for a given project.",
    {
      project: z.string().describe("Project ID or name to get builds for"),
      definitions: z.array(z.coerce.number().min(1)).optional().describe("Array of build definition IDs to filter builds"),
      queues: z.array(z.coerce.number().min(1)).optional().describe("Array of queue IDs to filter builds"),
      buildNumber: z.string().optional().describe("Build number to filter builds"),
      minTime: z.coerce.date().optional().describe("Minimum finish time to filter builds"),
      maxTime: z.coerce.date().optional().describe("Maximum finish time to filter builds"),
      requestedFor: z.string().optional().describe("User ID or name who requested the build"),
      reasonFilter: z.number().optional().describe("Reason filter for the build (see BuildReason enum)"),
      statusFilter: z.number().optional().describe("Status filter for the build (see BuildStatus enum)"),
      resultFilter: z.number().optional().describe("Result filter for the build (see BuildResult enum)"),
      tagFilters: z.array(z.string()).optional().describe("Array of tags to filter builds"),
      properties: z.array(z.string()).optional().describe("Array of property names to include in the results"),
      top: z.number().optional().describe("Maximum number of builds to return"),
      continuationToken: z.string().optional().describe("Token for continuing paged results"),
      maxBuildsPerDefinition: z.number().optional().describe("Maximum number of builds per definition"),
      deletedFilter: z.number().optional().describe("Filter for deleted builds (see QueryDeletedOption enum)"),
      queryOrder: z
        .enum(getEnumKeys(BuildQueryOrder) as [string, ...string[]])
        .default("QueueTimeDescending")
        .optional()
        .describe("Order in which builds are returned"),
      branchName: z.string().optional().describe("Branch name to filter builds"),
      buildIds: z.array(z.coerce.number().min(1)).optional().describe("Array of build IDs to retrieve"),
      repositoryId: z.string().optional().describe("Repository ID to filter builds"),
      repositoryType: z.enum(["TfsGit", "GitHub", "BitbucketCloud"]).optional().describe("Type of repository to filter builds"),
    },
    async ({
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
      queryOrder,
      branchName,
      buildIds,
      repositoryId,
      repositoryType,
    }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
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

      return {
        content: [{ type: "text", text: JSON.stringify(builds, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_log,
    "Retrieves the logs for a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build log for"),
      buildId: z.coerce.number().min(1).describe("ID of the build to get the log for"),
    },
    async ({ project, buildId }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const logs = await buildApi.getBuildLogs(project, buildId);

      return {
        content: [{ type: "text", text: JSON.stringify(logs, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_log_by_id,
    "Get a specific build log by log ID.",
    {
      project: z.string().describe("Project ID or name to get the build log for"),
      buildId: z.coerce.number().min(1).describe("ID of the build to get the log for"),
      logId: z.coerce.number().min(1).describe("ID of the log to retrieve"),
      startLine: z.coerce.number().optional().describe("Starting line number for the log content, defaults to 0"),
      endLine: z.coerce.number().optional().describe("Ending line number for the log content, defaults to the end of the log"),
    },
    async ({ project, buildId, logId, startLine, endLine }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const logLines = await buildApi.getBuildLogLines(project, buildId, logId, startLine, endLine);

      return createExternalContentResponse(logLines, "build log");
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_changes,
    "Get the changes associated with a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build changes for"),
      buildId: z.coerce.number().min(1).describe("ID of the build to get changes for"),
      continuationToken: z.string().optional().describe("Continuation token for pagination"),
      top: z.number().default(100).describe("Number of changes to retrieve, defaults to 100"),
      includeSourceChange: z.boolean().optional().describe("Whether to include source changes in the results, defaults to false"),
    },
    async ({ project, buildId, continuationToken, top, includeSourceChange }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const changes = await buildApi.getBuildChanges(project, buildId, continuationToken, top, includeSourceChange);

      return {
        content: [{ type: "text", text: JSON.stringify(changes, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_timeline,
    "Get the timeline of a build: the stage, phase, job and task records with their state, result, timings and issues (errors/warnings). Use this to find which stage or task of a run failed before fetching logs.",
    {
      project: z.string().describe("Project ID or name the build belongs to"),
      buildId: z.coerce.number().min(1).describe("ID of the build to get the timeline for"),
      timelineId: z.string().optional().describe("ID of a specific timeline. Omit to get the build's current timeline."),
      changeId: z.coerce.number().optional().describe("Change ID to get an incremental update of the timeline."),
      planId: z.string().optional().describe("ID of the plan the timeline belongs to."),
      recordType: z
        .enum(["Stage", "Phase", "Job", "Task", "Checkpoint"])
        .optional()
        .describe("Return only records of this type. Timelines are large, so narrowing to 'Stage' or 'Job' is usually enough to locate a failure."),
      onlyFailed: z.boolean().optional().describe("If true, return only records whose result is 'failed' or 'canceled', or that carry issues."),
    },
    async ({ project, buildId, timelineId, changeId, planId, recordType, onlyFailed }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const timeline = await buildApi.getBuildTimeline(project, buildId, timelineId, changeId, planId);

        if (!timeline) {
          return { content: [{ type: "text", text: `No timeline found for build ${buildId}` }], isError: true };
        }

        // Filtering is done here rather than by the caller because a timeline of
        // a large pipeline is mostly task records the model does not need.
        const records = (timeline.records ?? []).filter((record) => {
          if (recordType && record.type !== recordType) return false;
          if (onlyFailed) {
            const failed = record.result === TaskResult.Failed || record.result === TaskResult.Canceled;
            return failed || (record.issues?.length ?? 0) > 0;
          }
          return true;
        });

        return { content: [{ type: "text", text: JSON.stringify({ ...timeline, records }, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching build timeline: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_run,
    "Gets a run for a particular pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.coerce.number().min(1).describe("ID of the pipeline to run"),
      runId: z.coerce.number().min(1).describe("ID of the run to get"),
    },
    async ({ project, pipelineId, runId }) => {
      const connection = await connectionProvider();
      const pipelinesApi = await connection.getPipelinesApi();
      const pipelineRun = await pipelinesApi.getRun(project, pipelineId, runId);

      return {
        content: [{ type: "text", text: JSON.stringify(pipelineRun, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_list_runs,
    "Gets top 10000 runs for a particular pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.coerce.number().min(1).describe("ID of the pipeline to run"),
    },
    async ({ project, pipelineId }) => {
      const connection = await connectionProvider();
      const pipelinesApi = await connection.getPipelinesApi();
      const pipelineRuns = await pipelinesApi.listRuns(project, pipelineId);

      return {
        content: [{ type: "text", text: JSON.stringify(pipelineRuns, null, 2) }],
      };
    }
  );

  const resourcesSchema = z.object({
    builds: z
      .record(
        z.string().describe("Name of the build resource."),
        z.object({
          version: z.string().optional().describe("Version of the build resource."),
        })
      )
      .optional(),
    containers: z
      .record(
        z.string().describe("Name of the container resource."),
        z.object({
          version: z.string().optional().describe("Version of the container resource."),
        })
      )
      .optional(),
    packages: z
      .record(
        z.string().describe("Name of the package resource."),
        z.object({
          version: z.string().optional().describe("Version of the package resource."),
        })
      )
      .optional(),
    pipelines: z.record(
      z.string().describe("Name of the pipeline resource."),
      z.object({
        runId: z.coerce.number().min(1).optional().describe("Id of the source pipeline run that triggered or is referenced by this pipeline run."),
        version: z.string().optional().describe("Version of the source pipeline run."),
      })
    ),
    repositories: z
      .record(
        z.string().describe("Name of the repository resource."),
        z.object({
          refName: z.string().describe("Reference name, e.g., refs/heads/main."),
          token: z.string().optional(),
          tokenType: z.string().optional(),
          version: z.string().optional().describe("Version of the repository resource, git commit sha."),
        })
      )
      .optional(),
  });

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_run_pipeline,
    "Starts a new run of a pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.coerce.number().min(1).describe("ID of the pipeline to run"),
      pipelineVersion: z.coerce.number().min(1).optional().describe("Version of the pipeline to run. If not provided, the latest version will be used."),
      previewRun: z.boolean().optional().describe("If true, returns the final YAML document after parsing templates without creating a new run."),
      resources: resourcesSchema.optional().describe("A dictionary of resources to pass to the pipeline."),
      stagesToSkip: z.array(z.string()).optional().describe("A list of stages to skip."),
      templateParameters: z.record(z.string(), z.string()).optional().describe("Custom build parameters as key-value pairs"),
      variables: z.record(z.string(), variableSchema).optional().describe("A dictionary of variables to pass to the pipeline."),
      yamlOverride: z.string().optional().describe("YAML override for the pipeline run."),
    },
    async ({ project, pipelineId, pipelineVersion, previewRun, resources, stagesToSkip, templateParameters, variables, yamlOverride }) => {
      if (!previewRun && yamlOverride) {
        throw new Error("Parameter 'yamlOverride' can only be specified together with parameter 'previewRun'.");
      }

      const connection = await connectionProvider();
      const pipelinesApi = await connection.getPipelinesApi();
      const runRequest = {
        previewRun: previewRun,
        resources: {
          ...resources,
        },
        stagesToSkip: stagesToSkip,
        templateParameters: templateParameters,
        variables: variables,
        yamlOverride: yamlOverride,
      };

      const pipelineRun = await pipelinesApi.runPipeline(runRequest, project, pipelineId, pipelineVersion);
      const queuedBuild = { id: pipelineRun.id };
      const buildId = queuedBuild.id;

      if (buildId === undefined) {
        throw new Error("Failed to get build ID from pipeline run");
      }

      return {
        content: [{ type: "text", text: JSON.stringify(pipelineRun, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_status,
    "Fetches the status of a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build status for"),
      buildId: z.coerce.number().min(1).describe("ID of the build to get the status for"),
    },
    async ({ project, buildId }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const build = await buildApi.getBuildReport(project, buildId);

      return {
        content: [{ type: "text", text: JSON.stringify(build, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_update_build_stage,
    "Updates the stage of a specific build.",
    {
      project: z.string().describe("Project ID or name to update the build stage for"),
      buildId: z.coerce.number().min(1).describe("ID of the build to update"),
      stageName: z.string().describe("Name of the stage to update"),
      status: z.enum(getEnumKeys(StageUpdateType) as [string, ...string[]]).describe("New status for the stage"),
      forceRetryAllJobs: z.boolean().default(false).describe("Whether to force retry all jobs in the stage."),
    },
    async ({ project, buildId, stageName, status, forceRetryAllJobs }) => {
      const connection = await connectionProvider();
      const orgUrl = connection.serverUrl;
      const endpoint = `${orgUrl}/${encodeURIComponent(project)}/_apis/build/builds/${buildId}/stages/${encodeURIComponent(stageName)}?api-version=${apiVersion}`;
      const token = await tokenProvider();

      const body = {
        forceRetryAllJobs: forceRetryAllJobs,
        state: safeEnumConvert(StageUpdateType, status),
      };

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "User-Agent": userAgentProvider(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update build stage: ${response.status} ${errorText}`);
      }

      const updatedBuild = await response.text();

      return {
        content: [{ type: "text", text: JSON.stringify(updatedBuild, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_list_artifacts,
    "Lists artifacts for a given build.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.coerce.number().min(1).describe("The ID of the build."),
    },
    async ({ project, buildId }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const artifacts = await buildApi.getArtifacts(project, buildId);

      return {
        content: [{ type: "text", text: JSON.stringify(artifacts, null, 2) }],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_download_artifact,
    "Downloads a pipeline artifact. When destinationPath is provided, it must be a relative local path; absolute paths and path traversal are not allowed.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.coerce.number().min(1).describe("The ID of the build."),
      artifactName: z.string().describe("The name of the artifact to download."),
      destinationPath: z.string().optional().describe("The relative local path to download the artifact to. If not provided, returns binary content as base64."),
    },
    async ({ project, buildId, artifactName, destinationPath }) => {
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

      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const artifact = await buildApi.getArtifact(project, buildId, artifactName);

      if (!artifact) {
        return {
          content: [{ type: "text", text: `Artifact ${artifactName} not found in build ${buildId}.` }],
        };
      }

      const fileStream = await buildApi.getArtifactContentZip(project, buildId, artifactName);

      // If destinationPath is provided, save to disk
      if (destinationPath) {
        const fullDestinationPath = resolve(destinationPath);

        mkdirSync(fullDestinationPath, { recursive: true });
        const fileDestinationPath = join(fullDestinationPath, `${artifactName}.zip`);

        const writeStream = createWriteStream(fileDestinationPath);
        await new Promise<void>((resolve, reject) => {
          fileStream.pipe(writeStream);
          fileStream.on("end", () => resolve());
          fileStream.on("error", (err) => reject(err));
        });

        return {
          content: [{ type: "text", text: `Artifact ${artifactName} downloaded to ${destinationPath}.` }],
        };
      }

      // Otherwise, return binary content as base64
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        fileStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        fileStream.on("end", () => resolve());
        fileStream.on("error", (err) => reject(err));
      });

      const buffer = Buffer.concat(chunks);
      const base64Data = buffer.toString("base64");

      return {
        content: [
          {
            type: "resource",
            resource: {
              uri: `data:application/zip;base64,${base64Data}`,
              mimeType: "application/zip",
              text: base64Data,
            },
          },
        ],
      };
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build,
    "Get a single build by its ID, including status, result, and timing.",
    {
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().describe("The ID of the build."),
    },
    async ({ project, buildId }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const build = await buildApi.getBuild(project, buildId);

        if (!build) {
          return { content: [{ type: "text", text: `Build ${buildId} not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(build, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching build: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_definition,
    "Get a single build/pipeline definition by its ID.",
    {
      project: z.string().describe("Project ID or name."),
      definitionId: z.coerce.number().describe("The ID of the build definition."),
      revision: z.coerce.number().optional().describe("A specific revision of the definition to retrieve. Optional."),
      includeLatestBuilds: z.boolean().optional().describe("Include the latest and latest completed builds for the definition."),
    },
    async ({ project, definitionId, revision, includeLatestBuilds }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const definition = await buildApi.getDefinition(project, definitionId, revision, undefined, undefined, includeLatestBuilds);

        if (!definition) {
          return { content: [{ type: "text", text: `Build definition ${definitionId} not found` }], isError: true };
        }

        return { content: [{ type: "text", text: JSON.stringify(definition, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching build definition: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_queue_build,
    "Queue (start) a new build for a build definition.",
    {
      project: z.string().describe("Project ID or name."),
      definitionId: z.coerce.number().describe("The ID of the build definition to queue."),
      sourceBranch: z.string().optional().describe("The branch to build, e.g. 'refs/heads/main'. Defaults to the definition's default branch."),
      parameters: z.string().optional().describe('Build parameters as a JSON object string, e.g. \'{"myVar":"value"}\'.'),
    },
    async ({ project, definitionId, sourceBranch, parameters }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const build: Build = { definition: { id: definitionId }, sourceBranch, parameters };
        const queued = await buildApi.queueBuild(build, project);

        return { content: [{ type: "text", text: JSON.stringify(queued, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error queueing build: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_cancel_build,
    "Cancel an in-progress build by setting its status to Cancelling.",
    {
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().describe("The ID of the build to cancel."),
    },
    async ({ project, buildId }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const build: Build = { status: BuildStatus.Cancelling };
        const updated = await buildApi.updateBuild(build, project, buildId);

        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error cancelling build: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_get_build_tags,
    "Get the tags applied to a build.",
    {
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().describe("The ID of the build."),
    },
    async ({ project, buildId }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const tags = await buildApi.getBuildTags(project, buildId);

        return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching build tags: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_add_build_tag,
    "Add a tag to a build. Returns the build's updated tag list.",
    {
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().describe("The ID of the build."),
      tag: z.string().describe("The tag to add."),
    },
    async ({ project, buildId, tag }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const tags = await buildApi.addBuildTag(project, buildId, tag);

        return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error adding build tag: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PIPELINE_TOOLS.pipelines_delete_build_tag,
    "Delete a tag from a build. Returns the build's remaining tag list.",
    {
      project: z.string().describe("Project ID or name."),
      buildId: z.coerce.number().describe("The ID of the build."),
      tag: z.string().describe("The tag to remove."),
    },
    async ({ project, buildId, tag }) => {
      try {
        const connection = await connectionProvider();
        const buildApi = await connection.getBuildApi();
        const tags = await buildApi.deleteBuildTag(project, buildId, tag);

        return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting build tag: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { PIPELINE_TOOLS, configurePipelineTools };
