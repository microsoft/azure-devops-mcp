// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for the work write tools.
//
// Each action's inputs are declared once as a Zod "raw shape". The shapes are
// the single source of truth: the tool's input schema is composed from them,
// and the TypeScript argument types are derived via `z.infer` (no hand-written,
// drift-prone duplicate types). These types are safe to export — they are
// compile-time only and erased at runtime, so they have no effect on the MCP
// protocol or a local server.
// ─────────────────────────────────────────────────────────────────────────────

/** Fields shared by every work iteration write action. */
const workIterationProjectShape = {
  project: z.string().describe("The name or ID of the Azure DevOps project."),
};

const iterationItemSchema = z.object({
  iterationName: z.string().optional().describe("The name of the iteration to create. Used for create."),
  startDate: z.string().optional().describe("The start date of the iteration in ISO format (e.g., '2023-01-01T00:00:00Z'). Used for create."),
  finishDate: z.string().optional().describe("The finish date of the iteration in ISO format (e.g., '2023-01-31T23:59:59Z'). Used for create."),
  identifier: z.string().optional().describe("The identifier of the iteration to assign. Used for assign."),
  path: z.string().optional().describe("The path of the iteration to assign, e.g., 'Project/Iteration'. Used for assign."),
});

const iterationsField = {
  iterations: z.array(iterationItemSchema).describe("An array of iterations to process. For create: provide iterationName and optional dates. For assign: provide identifier and path."),
};

/** create iteration inputs. */
export const createIterationShape = {
  ...workIterationProjectShape,
  ...iterationsField,
};

/** assign iteration inputs. */
export const assignIterationShape = {
  ...workIterationProjectShape,
  team: z.string().optional().describe("The name or ID of the Azure DevOps team. Required for assign."),
  ...iterationsField,
};

/** The composed input shape for the grouped `work_iteration_write` tool. */
export const workIterationWriteShape = {
  action: z.enum(["create", "assign"]).describe("The action to perform. 'create' creates new iterations in the project; 'assign' assigns existing iterations to a team."),
  ...createIterationShape,
  ...assignIterationShape,
};

// Per-action schemas + inferred argument DTOs.
export const createIterationSchema = z.object(createIterationShape);
export const assignIterationSchema = z.object(assignIterationShape);
export const workIterationWriteSchema = z.object(workIterationWriteShape);

export type CreateIterationArgs = z.infer<typeof createIterationSchema>;
export type AssignIterationArgs = z.infer<typeof assignIterationSchema>;
export type WorkIterationWriteArgs = z.infer<typeof workIterationWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────

/** update capacity inputs. */
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
    .describe("Array of days off for the team member, each with a start and end date in ISO format."),
};

/** The composed input shape for the `work_capacity_write` tool. */
export const workCapacityWriteShape = {
  action: z.literal("update").describe("The action to perform. Only 'update' is supported."),
  ...updateCapacityShape,
};

// Per-action schemas + inferred argument DTOs.
export const updateCapacitySchema = z.object(updateCapacityShape);
export const workCapacityWriteSchema = z.object(workCapacityWriteShape);

export type UpdateCapacityArgs = z.infer<typeof updateCapacitySchema>;
export type WorkCapacityWriteArgs = z.infer<typeof workCapacityWriteSchema>;
