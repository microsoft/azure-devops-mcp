// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { z } from "zod";

// Preserve date coercion while exposing the existing string/date-time wire schema.
export const dateInputSchema = z.unknown().meta({ type: "string", format: "date-time" }).pipe(z.coerce.date());
