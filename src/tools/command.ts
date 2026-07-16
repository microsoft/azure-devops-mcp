// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { WebApi } from "azure-devops-node-api";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodRawShape } from "zod";

/**
 * Shared infrastructure available to every command.
 *
 * Command-specific data is passed separately via the typed args object, so the
 * `Command` interface stays stable even as individual commands evolve. This is
 * the same "context + typed args" split used by frameworks like Express and
 * NestJS: shared infrastructure goes into the context, request-specific data
 * goes into the arguments.
 */
export interface CommandContext {
  /** Returns an authenticated Azure DevOps Web API connection. */
  connectionProvider: () => Promise<WebApi>;
  /** Returns a bearer token for direct REST calls. */
  tokenProvider: () => Promise<string>;
  /** Returns the User-Agent string to attach to outbound requests. */
  userAgentProvider: () => string;
}

/**
 * Infers the typed args object from the Zod raw shape that is passed to
 * `server.tool(...)`. Lets a command declare a single strongly-typed argument
 * object instead of a long positional parameter list.
 */
export type CommandArgs<TShape extends ZodRawShape> = z.infer<z.ZodObject<TShape>>;

/**
 * A command encapsulates the behavior of a single MCP tool.
 *
 * Shared infrastructure is received via `context`; command-specific input via
 * the typed `args` object. The action switch (for grouped tools) lives inside
 * `execute`.
 *
 * @example
 * const searchCommand: Command<SearchArgs> = {
 *   async execute(context, args) {
 *     const connection = await context.connectionProvider();
 *     // ...use args.query, args.maxResults, etc.
 *   },
 * };
 */
export interface Command<TArgs> {
  execute(context: CommandContext, args: TArgs): Promise<CallToolResult>;
}
