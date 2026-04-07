// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

/**
 * Creates an optional Zod schema that accepts either a single string or an array of strings,
 * normalizing the input to always produce a string array.
 */
export const stringArrayParam = (description: string) =>
  z
    .union([z.string().transform((value) => [value]), z.array(z.string())])
    .optional()
    .describe(description);
