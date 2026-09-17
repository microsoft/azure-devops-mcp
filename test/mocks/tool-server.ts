// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A stand-in McpServer for tool-module tests.
 *
 * Tool modules register through registerTool() (src/shared/tool-registration.ts),
 * which calls `server.registerTool(name, { description, inputSchema, annotations }, handler)`.
 * The suites were written against the older positional `server.tool(name,
 * description, schema, handler)` call and find handlers through
 * `server.tool.mock.calls` — several hundred lookups in 34 files. This double
 * replays every registerTool call into `tool` in that positional shape, so those
 * lookups keep working, while `registerTool.mock.calls` still holds the real
 * registration (annotations included) for tests that care about it.
 */
export function createToolServer<Extra extends object>(extra?: Extra) {
  const tool = jest.fn();
  const registerTool = jest.fn((name: string, config: { description?: string; inputSchema?: unknown }, handler: unknown) => {
    tool(name, config.description, config.inputSchema, handler);
    return { update: jest.fn(), remove: jest.fn(), enable: jest.fn(), disable: jest.fn() };
  });
  return { tool, registerTool, ...(extra ?? ({} as Extra)) };
}
