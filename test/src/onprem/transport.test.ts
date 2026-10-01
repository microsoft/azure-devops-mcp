// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { buildWindowsWorkerScript, createPatTransport, createWindowsIntegratedTransport, SpawnFunction } from "../../../src/onprem/transport";

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = jest.fn(() => true);
  written: Record<string, unknown>[] = [];

  constructor() {
    super();
    this.stdin.on("data", (chunk: Buffer) => {
      chunk
        .toString("utf8")
        .split("\n")
        .filter(Boolean)
        .forEach((line) => this.written.push(JSON.parse(line)));
    });
  }

  respond(message: Record<string, unknown>) {
    this.stdout.write(JSON.stringify(message) + "\n");
  }
}

function setup() {
  const children: FakeChild[] = [];
  const spawn = jest.fn((() => {
    const child = new FakeChild();
    children.push(child);
    return child as unknown as ChildProcessWithoutNullStreams;
  }) as SpawnFunction);
  const transport = createWindowsIntegratedTransport({ spawn, platform: "win32", requestTimeoutSeconds: 1 });
  return { spawn, transport, children };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("Windows integrated authentication transport", () => {
  it("uses HttpClient default credentials with redirects disabled and no secrets", () => {
    const script = buildWindowsWorkerScript(30);
    expect(script).toContain("$handler.UseDefaultCredentials = $true");
    expect(script).toContain("$handler.AllowAutoRedirect = $false");
    expect(script).toContain("[TimeSpan]::FromSeconds(30)");
    expect(script).not.toMatch(/password|PERSONAL_ACCESS_TOKEN/i);
  });

  it("starts one hidden PowerShell worker and correlates responses by id", async () => {
    const { spawn, transport, children } = setup();

    const first = transport({ url: "https://server/c/_apis/projects?api-version=5.0", accept: "application/json", userAgent: "UA" });
    const second = transport({ url: "https://server/c/_apis/projects?api-version=5.0&$top=1", accept: "application/json", userAgent: "UA" });
    await flush();

    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toBe("powershell.exe");
    expect(args).toEqual(expect.arrayContaining(["-NoProfile", "-NonInteractive", "-EncodedCommand"]));
    expect(options).toEqual({ windowsHide: true });
    const encodedScript = Buffer.from(args[args.length - 1], "base64").toString("utf16le");
    expect(encodedScript).toContain("UseDefaultCredentials = $true");

    const child = children[0];
    expect(child.written).toEqual([
      { id: 1, url: "https://server/c/_apis/projects?api-version=5.0", accept: "application/json", userAgent: "UA" },
      { id: 2, url: "https://server/c/_apis/projects?api-version=5.0&$top=1", accept: "application/json", userAgent: "UA" },
    ]);

    child.respond({ id: 2, status: 200, contentType: "application/json", body: Buffer.from('{"n":2}').toString("base64") });
    child.respond({ id: 1, error: "The remote name could not be resolved" });

    await expect(second).resolves.toEqual({ status: 200, contentType: "application/json", body: Buffer.from('{"n":2}') });
    await expect(first).rejects.toThrow("Azure DevOps Server request failed: The remote name could not be resolved");
  });

  it("rejects pending requests with stderr detail when the worker exits and restarts on the next request", async () => {
    const { spawn, transport, children } = setup();
    const pending = transport({ url: "https://server/c/x", accept: "application/json", userAgent: "UA" });
    await flush();
    children[0].stderr.write("Add-Type: Cannot add type. Constrained language mode.");
    await flush();
    children[0].emit("exit", 1);
    await expect(pending).rejects.toThrow(/exited with code 1\. Add-Type: Cannot add type/);

    void transport({ url: "https://server/c/y", accept: "application/json", userAgent: "UA" }).catch(() => undefined);
    await flush();
    expect(spawn).toHaveBeenCalledTimes(2);
    children[1].emit("exit", 0);
  });

  it("times out and restarts a stuck worker", async () => {
    jest.useFakeTimers();
    try {
      const { transport, children } = setup();
      const pending = transport({ url: "https://server/c/x", accept: "application/json", userAgent: "UA" });
      jest.advanceTimersByTime(16_000);
      await expect(pending).rejects.toThrow("timed out after 16 seconds");
      expect(children[0].kill).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("is unavailable on non-Windows platforms", async () => {
    const spawn = jest.fn() as unknown as SpawnFunction;
    const transport = createWindowsIntegratedTransport({ spawn, platform: "linux" });
    await expect(transport({ url: "https://server/c/x", accept: "application/json", userAgent: "UA" })).rejects.toThrow("only available when the MCP server runs on Windows");
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe("PAT transport", () => {
  it("sends Basic auth from the environment without following redirects", async () => {
    const fetchFn = jest.fn(async () => new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const transport = createPatTransport(() => "dXNlcjpwYXQ=", fetchFn);
    const response = await transport({ url: "https://server/c/x", accept: "application/json", userAgent: "UA" });

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe('{"ok":true}');
    expect(fetchFn).toHaveBeenCalledWith("https://server/c/x", {
      method: "GET",
      redirect: "manual",
      headers: { "Authorization": "Basic dXNlcjpwYXQ=", "Accept": "application/json", "User-Agent": "UA" },
    });
  });

  it("fails clearly when PERSONAL_ACCESS_TOKEN is missing", async () => {
    const transport = createPatTransport(() => undefined, jest.fn() as unknown as typeof fetch);
    await expect(transport({ url: "https://server/c/x", accept: "application/json", userAgent: "UA" })).rejects.toThrow("PERSONAL_ACCESS_TOKEN");
  });
});
