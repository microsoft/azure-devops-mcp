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
import { join, resolve } from "path";

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
};

function configurePipelineTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_definitions,
    "Retrieves a list of build definitions for a given project.",
    {
      project: z.string().describe("Project ID or name to get build definitions for"),
      repositoryId: z.string().optional().describe("Repository ID to filter build definitions"),
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
      definitionIds: z.array(z.number()).optional().describe("Array of build definition IDs to filter"),
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
      const buildDefinitions = await buildApi.getDefinitions(
        project,
        name,
        repositoryId,
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

  server.tool(
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_definition_revisions,
    "Retrieves a list of revisions for a specific build definition.",
    {
      project: z.string().describe("Project ID or name to get the build definition revisions for"),
      definitionId: z.number().describe("ID of the build definition to get revisions for"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_builds,
    "Retrieves a list of builds for a given project.",
    {
      project: z.string().describe("Project ID or name to get builds for"),
      definitions: z.array(z.number()).optional().describe("Array of build definition IDs to filter builds"),
      queues: z.array(z.number()).optional().describe("Array of queue IDs to filter builds"),
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
      buildIds: z.array(z.number()).optional().describe("Array of build IDs to retrieve"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_log,
    "Retrieves the logs for a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build log for"),
      buildId: z.number().describe("ID of the build to get the log for"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_log_by_id,
    "Get a specific build log by log ID.",
    {
      project: z.string().describe("Project ID or name to get the build log for"),
      buildId: z.number().describe("ID of the build to get the log for"),
      logId: z.number().describe("ID of the log to retrieve"),
      startLine: z.number().optional().describe("Starting line number for the log content, defaults to 0"),
      endLine: z.number().optional().describe("Ending line number for the log content, defaults to the end of the log"),
    },
    async ({ project, buildId, logId, startLine, endLine }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const logLines = await buildApi.getBuildLogLines(project, buildId, logId, startLine, endLine);

      return {
        content: [{ type: "text", text: JSON.stringify(logLines, null, 2) }],
      };
    }
  );

  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_changes,
    "Get the changes associated with a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build changes for"),
      buildId: z.number().describe("ID of the build to get changes for"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_run,
    "Gets a run for a particular pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.number().describe("ID of the pipeline to run"),
      runId: z.number().describe("ID of the run to get"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_list_runs,
    "Gets top 10000 runs for a particular pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.number().describe("ID of the pipeline to run"),
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
        runId: z.number().describe("Id of the source pipeline run that triggered or is referenced by this pipeline run."),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_run_pipeline,
    "Starts a new run of a pipeline.",
    {
      project: z.string().describe("Project ID or name to run the build in"),
      pipelineId: z.number().describe("ID of the pipeline to run"),
      pipelineVersion: z.number().optional().describe("Version of the pipeline to run. If not provided, the latest version will be used."),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_get_build_status,
    "Fetches the status of a specific build.",
    {
      project: z.string().describe("Project ID or name to get the build status for"),
      buildId: z.number().describe("ID of the build to get the status for"),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_update_build_stage,
    "Updates the stage of a specific build.",
    {
      project: z.string().describe("Project ID or name to update the build stage for"),
      buildId: z.number().describe("ID of the build to update"),
      stageName: z.string().describe("Name of the stage to update"),
      status: z.enum(getEnumKeys(StageUpdateType) as [string, ...string[]]).describe("New status for the stage"),
      forceRetryAllJobs: z.boolean().default(false).describe("Whether to force retry all jobs in the stage."),
    },
    async ({ project, buildId, stageName, status, forceRetryAllJobs }) => {
      const connection = await connectionProvider();
      const orgUrl = connection.serverUrl;
      const endpoint = `${orgUrl}/${project}/_apis/build/builds/${buildId}/stages/${stageName}?api-version=${apiVersion}`;
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

  server.tool(
    PIPELINE_TOOLS.pipelines_list_artifacts,
    "Lists artifacts for a given build.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.number().describe("The ID of the build."),
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

  server.tool(
    PIPELINE_TOOLS.pipelines_download_artifact,
    "Downloads a pipeline artifact.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.number().describe("The ID of the build."),
      artifactName: z.string().describe("The name of the artifact to download."),
      destinationPath: z.string().optional().describe("The local path to download the artifact to. If not provided, returns binary content as base64."),
    },
    async ({ project, buildId, artifactName, destinationPath }) => {
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
}

export { PIPELINE_TOOLS, configurePipelineTools };
