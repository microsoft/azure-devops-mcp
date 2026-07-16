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
 * A command encapsulates the behavior of a single MCP tool action.
 *
 * Shared infrastructure is received via `context`; command-specific input via
 * the typed `args` object.
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

/** A registry that maps each action name to the command that handles it. */
export type CommandRegistry<TArgs extends { action: string }> = Partial<Record<TArgs["action"], Command<TArgs>>>;

/** Builds an error `CallToolResult`. */
export const errorResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

/**
 * Routes a validated, action-carrying args object to the matching command.
 *
 * This is what removes long positional parameter lists from grouped ("action")
 * tools: instead of destructuring every possible field, the whole typed args
 * object is forwarded to the single command keyed by `args.action`, coupling
 * each action to exactly one command.
 *
 * - Unknown actions short-circuit with an "Unknown action" error and never
 *   touch the context (so no connection is opened).
 * - Errors thrown by a command are caught and formatted using the optional
 *   per-action `errorPrefixes` map (falling back to a generic message).
 * - Errors returned by a command (e.g. validation `errorResult`s) pass through
 *   unchanged.
 */
export async function dispatchAction<TArgs extends { action: string }>(
  commands: CommandRegistry<TArgs>,
  context: CommandContext,
  args: TArgs,
  errorPrefixes?: Partial<Record<TArgs["action"], string>>
): Promise<CallToolResult> {
  const command = commands[args.action as TArgs["action"]];
  if (!command) return errorResult(`Unknown action: ${args.action}`);

  try {
    return await command.execute(context, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const prefix = errorPrefixes?.[args.action as TArgs["action"]];
    return errorResult(prefix ? `${prefix}${message}` : `Error: ${message}`);
  }
}
