// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { WebApi } from "azure-devops-node-api";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface CommandContext {
  connectionProvider: () => Promise<WebApi>;
  tokenProvider: () => Promise<string>;
  userAgentProvider: () => string;
}

export interface Command<TArgs> {
  execute(context: CommandContext, args: TArgs): Promise<CallToolResult>;
}

export type CommandRegistry<TArgs extends { action: string }> = Record<TArgs["action"], Command<TArgs>>;

export const errorResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

export async function dispatchAction<TArgs extends { action: string }>(
  commands: CommandRegistry<TArgs>,
  context: CommandContext,
  args: TArgs,
  errorPrefixes: Record<TArgs["action"], string>
): Promise<CallToolResult> {
  const action = args.action as TArgs["action"];
  if (!Object.hasOwn(commands, action)) {
    return errorResult(`Unknown action: ${args.action}. Supported actions: ${Object.keys(commands).sort().join(", ")}`);
  }

  try {
    return await commands[action].execute(context, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return errorResult(`${errorPrefixes[action]}${message}`);
  }
}
