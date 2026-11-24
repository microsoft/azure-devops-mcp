// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";
import { Command, CommandContext, dispatchAction } from "../../src/shared/command";

interface Args {
  action: "ok" | "boom";
}

const context = { connectionProvider: jest.fn(), tokenProvider: jest.fn(), userAgentProvider: jest.fn() } as unknown as CommandContext;
const ok: Command<Args> = { execute: async () => ({ content: [{ type: "text", text: "done" }] }) };
const boom: Command<Args> = {
  execute: async () => {
    throw new Error("bad");
  },
};
const commands = { ok, boom };
const prefixes = { ok: "Error ok: ", boom: "Error boom: " };

describe("dispatchAction", () => {
  it("runs the command registered for the action", async () => {
    expect(await dispatchAction(commands, context, { action: "ok" }, prefixes)).toEqual({ content: [{ type: "text", text: "done" }] });
  });

  it("prefixes errors thrown by the command", async () => {
    expect(await dispatchAction(commands, context, { action: "boom" }, prefixes)).toEqual({ content: [{ type: "text", text: "Error boom: bad" }], isError: true });
  });

  it.each(["missing", "__proto__", "toString"])("rejects %s and lists supported actions", async (action) => {
    expect(await dispatchAction(commands, context, { action } as unknown as Args, prefixes)).toEqual({
      content: [{ type: "text", text: `Unknown action: ${action}. Supported actions: boom, ok` }],
      isError: true,
    });
  });
});
