// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

/**
 * Creates a Zod schema that coerces string values "true"/"false" to booleans.
 * Unlike z.coerce.boolean(), this correctly handles "false" -> false
 * (Boolean("false") returns true, which is not what we want).
 */
export function coerceBoolean() {
  return z.preprocess((val) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return val;
  }, z.boolean());
}
