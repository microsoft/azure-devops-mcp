// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for the work_iteration_write and work_capacity_write tools.
//
// Each action's inputs are declared once as a Zod "raw shape". The shapes are
// the single source of truth: the tools' input schemas are composed from them,
// and the TypeScript argument types are derived via `z.infer` (no hand-written,
// drift-prone duplicate types). These types are safe to export — they are
// compile-time only and erased at runtime, so they have no effect on the MCP
// protocol or a local server.
// ─────────────────────────────────────────────────────────────────────────────

const iterationsSchema = z
  .array(
    z.object({
      iterationName: z.string().optional().describe("The name of the iteration to create. Used for create."),
      startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z'). Used for create."),
      finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z'). Used for create."),
      identifier: z.string().optional().describe("The identifier of the iteration to assign. Used for assign."),
      path: z.string().optional().describe("The path of the iteration to assign, e.g., 'Project/Iteration'. Used for assign."),
    })
  )
  .describe("An array of iterations to process. For create: provide iterationName and optional dates. For assign: provide identifier and path.");

/** Fields shared by every work_iteration_write action. */
const projectShape = {
  project: z.string().describe("The name or ID of the Azure DevOps project."),
};

/** create (work_iteration_write) inputs. */
export const createIterationsShape = {
  ...projectShape,
  iterations: iterationsSchema,
};

/** assign (work_iteration_write) inputs. */
export const assignIterationsShape = {
  ...projectShape,
  team: z.string().optional().describe("The name or ID of the Azure DevOps team. Required for assign."),
  iterations: iterationsSchema,
};

/** The composed input shape for the grouped `work_iteration_write` tool. */
export const workIterationWriteShape = {
  action: z.enum(["create", "assign"]).describe("The action to perform. 'create' creates new iterations in the project; 'assign' assigns existing iterations to a team."),
  // assign is spread first so the published property order stays project, team, iterations.
  ...assignIterationsShape,
  ...createIterationsShape,
};

/** update (work_capacity_write) inputs. */
export const updateCapacityShape = {
  project: z.string().describe("The name or Id of the Azure DevOps project."),
  team: z.string().describe("The name or Id of the Azure DevOps team."),
  teamMemberId: z.string().describe("The team member Id for the specific team member."),
  iterationId: z.string().describe("The Iteration Id to update the capacity for."),
  activities: z
    .array(
      z.object({
        name: z.string().describe("The name of the activity (e.g., 'Development')."),
        capacityPerDay: z.number().describe("The capacity per day for this activity."),
      })
    )
    .describe("Array of activities and their daily capacities for the team member."),
  daysOff: z
    .array(
      z.object({
        start: z.string().describe("Start date of the day off in ISO format."),
        end: z.string().describe("End date of the day off in ISO format."),
      })
    )
    .optional()
    .describe("Days off for the team member (ISO start/end dates). Replaces existing days off; omitted updates preserve them."),
};

/** The composed input shape for the `work_capacity_write` tool. */
export const workCapacityWriteShape = {
  action: z.literal("update").describe("The action to perform. Only 'update' is supported."),
  ...updateCapacityShape,
};

// Per-action schemas + inferred argument DTOs. `z.infer` keeps these types in
// lockstep with the schemas above.
export const createIterationsSchema = z.object(createIterationsShape);
export const assignIterationsSchema = z.object(assignIterationsShape);
export const workIterationWriteSchema = z.object(workIterationWriteShape);
export const updateCapacitySchema = z.object(updateCapacityShape);
export const workCapacityWriteSchema = z.object(workCapacityWriteShape);

export type CreateIterationsArgs = z.infer<typeof createIterationsSchema>;
export type AssignIterationsArgs = z.infer<typeof assignIterationsSchema>;
export type WorkIterationWriteArgs = z.infer<typeof workIterationWriteSchema>;
export type UpdateCapacityArgs = z.infer<typeof updateCapacitySchema>;
export type WorkCapacityWriteArgs = z.infer<typeof workCapacityWriteSchema>;
