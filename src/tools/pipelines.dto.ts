// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";
import { getEnumKeys } from "../utils.js";
import { RepositoryType } from "azure-devops-node-api/interfaces/PipelinesInterfaces.js";
import { StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for the pipelines_write tool.
//
// Each action's inputs are declared once as a Zod "raw shape". The shapes are
// the single source of truth: the tool's input schema is composed from them,
// and the TypeScript argument types are derived via `z.infer` (no hand-written,
// drift-prone duplicate types). These types are safe to export — they are
// compile-time only and erased at runtime, so they have no effect on the MCP
// protocol or a local server.
// ─────────────────────────────────────────────────────────────────────────────

export const variableSchema = z.object({
  value: z.string().optional(),
  isSecret: z.boolean().optional(),
});

export const resourcesSchema = z.object({
  builds: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
  containers: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
  packages: z.record(z.string(), z.object({ version: z.string().optional() })).optional(),
  pipelines: z
    .record(
      z.string(),
      z.object({
        runId: z.coerce.number().min(1).optional().describe("Id of the source pipeline run."),
        version: z.string().optional(),
      })
    )
    .optional(),
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

/** Fields shared by every write action. */
const projectShape = {
  project: z.string().describe("Project ID or name."),
};

/** run_pipeline inputs. */
export const runPipelineShape = {
  ...projectShape,
  pipelineId: z.coerce.number().min(1).optional().describe("ID of the pipeline to run. Required for: run_pipeline."),
  pipelineVersion: z.coerce.number().min(1).optional().describe("Version of the pipeline to run. Used for: run_pipeline."),
  previewRun: z.boolean().optional().describe("If true, returns the final YAML without creating a run. Used for: run_pipeline."),
  resources: resourcesSchema.optional().describe("Resources to pass to the pipeline. Used for: run_pipeline."),
  stagesToSkip: z.array(z.string()).optional().describe("Stages to skip. Used for: run_pipeline."),
  templateParameters: z.record(z.string(), z.string()).optional().describe("Custom build parameters as key-value pairs. Used for: run_pipeline."),
  variables: z.record(z.string(), variableSchema).optional().describe("Variables to pass to the pipeline. Used for: run_pipeline."),
  yamlOverride: z.string().optional().describe("YAML override (only valid with previewRun). Used for: run_pipeline."),
};

/** create_pipeline inputs. */
export const createPipelineShape = {
  ...projectShape,
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
};

/** update_build_stage inputs. */
export const updateBuildStageShape = {
  ...projectShape,
  buildId: z.coerce.number().min(1).optional().describe("ID of the build to update. Required for: update_build_stage."),
  stageName: z.string().optional().describe("Name of the stage to update. Required for: update_build_stage."),
  status: z
    .enum(getEnumKeys(StageUpdateType) as [string, ...string[]])
    .optional()
    .describe("New status for the stage. Required for: update_build_stage."),
  forceRetryAllJobs: z.boolean().default(false).describe("Whether to force retry all jobs in the stage. Used for: update_build_stage."),
};

/** The composed input shape for the grouped `pipelines_write` tool. */
export const pipelinesWriteShape = {
  action: z
    .enum(["run_pipeline", "create_pipeline", "update_build_stage"])
    .describe(
      "The action to perform. Options: run_pipeline (queue a new pipeline run), create_pipeline (create a new YAML pipeline definition), update_build_stage (cancel, retry, or run a stage on an in-flight build)."
    ),
  ...runPipelineShape,
  ...createPipelineShape,
  ...updateBuildStageShape,
};

// Per-action schemas + inferred argument DTOs. `z.infer` keeps these types in
// lockstep with the schemas above.
export const runPipelineSchema = z.object(runPipelineShape);
export const createPipelineSchema = z.object(createPipelineShape);
export const updateBuildStageSchema = z.object(updateBuildStageShape);
export const pipelinesWriteSchema = z.object(pipelinesWriteShape);

export type RunPipelineArgs = z.infer<typeof runPipelineSchema>;
export type CreatePipelineArgs = z.infer<typeof createPipelineSchema>;
export type UpdateBuildStageArgs = z.infer<typeof updateBuildStageSchema>;
export type PipelinesWriteArgs = z.infer<typeof pipelinesWriteSchema>;
