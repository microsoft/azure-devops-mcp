// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Zod schemas for the two parameters almost every tool takes.
//
// `project` appeared as a hand-written `z.string().optional().describe(...)` in
// 109 places and `team` in 48, in four slightly different wordings, each
// spelling out that omitting the value triggers an elicitation. Repeated across
// the tool list that sentence cost about 13 KB — roughly 3.6k tokens of the
// model's context on every request — to say the same thing 157 times.
//
// The description here is deliberately bare. How a missing value is resolved is
// a property of the server, not of each parameter, and it is stated once in the
// `instructions` text (see server-instructions.ts) instead.

import { z } from "zod";

const PROJECT_DESCRIPTION = "Azure DevOps project name or ID.";
const TEAM_DESCRIPTION = "Azure DevOps team name or ID.";

/** `project`, resolved from the env default or an elicitation when omitted. */
export const optionalProject = z.string().optional().describe(PROJECT_DESCRIPTION);

/** `project`, where the tool cannot sensibly guess one. */
export const requiredProject = z.string().describe(PROJECT_DESCRIPTION);

/** `team`, resolved from the env default or an elicitation when omitted. */
export const optionalTeam = z.string().optional().describe(TEAM_DESCRIPTION);

/** `team`, where the tool cannot sensibly guess one. */
export const requiredTeam = z.string().describe(TEAM_DESCRIPTION);

/**
 * `project` or `team` with a clause the caller has to know about — an
 * ownership rule, or what happens in this particular tool when it is omitted.
 */
export const optionalProjectWith = (note: string) => z.string().optional().describe(`${PROJECT_DESCRIPTION} ${note}`);
export const requiredProjectWith = (note: string) => z.string().describe(`${PROJECT_DESCRIPTION} ${note}`);
export const optionalTeamWith = (note: string) => z.string().optional().describe(`${TEAM_DESCRIPTION} ${note}`);
