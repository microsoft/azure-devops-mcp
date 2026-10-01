// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { spawn as nodeSpawn, ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "child_process";
import { createInterface } from "readline";
import { logger } from "../logger.js";

export interface TransportRequest {
  url: string;
  accept: string;
  userAgent: string;
}

export interface TransportResponse {
  status: number;
  contentType: string;
  body: Buffer;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export type SpawnFunction = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 100;

/**
 * PowerShell worker that performs GET requests with System.Net.Http.HttpClient and
 * UseDefaultCredentials = $true. Authentication (Negotiate/Kerberos or NTLM) is negotiated
 * by Windows SSPI using the signed-in user's logon session, so no password or token is
 * ever read, stored or handled by this process. Redirects are disabled so credentials are
 * never forwarded to a different host. Requests are read as JSON lines from stdin and
 * responses are written as JSON lines (body base64-encoded) to stdout.
 */
export function buildWindowsWorkerScript(timeoutSeconds: number): string {
  return `
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
Add-Type -AssemblyName System.Net.Http
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.UseDefaultCredentials = $true
$handler.AllowAutoRedirect = $false
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(${Math.max(1, Math.floor(timeoutSeconds))})
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim().Length -eq 0) { continue }
  $id = $null
  try {
    $req = $line | ConvertFrom-Json
    $id = $req.id
    $msg = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, [Uri]$req.url)
    [void]$msg.Headers.TryAddWithoutValidation('Accept', [string]$req.accept)
    [void]$msg.Headers.TryAddWithoutValidation('User-Agent', [string]$req.userAgent)
    $resp = $client.SendAsync($msg).GetAwaiter().GetResult()
    $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $ct = ''
    if ($null -ne $resp.Content.Headers.ContentType) { $ct = $resp.Content.Headers.ContentType.ToString() }
    $res = @{ id = $id; status = [int]$resp.StatusCode; contentType = $ct; body = [Convert]::ToBase64String($bytes) }
    $resp.Dispose()
  } catch {
    $res = @{ id = $id; error = $_.Exception.GetBaseException().Message }
  }
  [Console]::Out.WriteLine(($res | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}
`;
}

interface PendingRequest {
  resolve: (response: TransportResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface WorkerMessage {
  id?: number | null;
  status?: number;
  contentType?: string;
  body?: string;
  error?: string;
}

export interface WindowsIntegratedTransportOptions {
  spawn?: SpawnFunction;
  platform?: NodeJS.Platform;
  powershellPath?: string;
  requestTimeoutSeconds?: number;
}

/**
 * Creates a transport that authenticates with the current Windows logon session
 * (Windows integrated authentication via Negotiate/NTLM). A single long-lived
 * PowerShell worker is reused for all requests so the authenticated connection is
 * kept alive between calls.
 */
export function createWindowsIntegratedTransport(options: WindowsIntegratedTransportOptions = {}): Transport & { dispose: () => void } {
  const platform = options.platform ?? process.platform;
  const spawn = options.spawn ?? (nodeSpawn as SpawnFunction);
  const powershellPath = options.powershellPath ?? "powershell.exe";
  const timeoutSeconds = options.requestTimeoutSeconds ?? DEFAULT_REQUEST_TIMEOUT_SECONDS;

  let worker: ChildProcessWithoutNullStreams | undefined;
  let nextId = 1;
  let stderrTail = "";
  const pending = new Map<number, PendingRequest>();

  const failAll = (error: Error) => {
    for (const [id, request] of pending) {
      clearTimeout(request.timer);
      request.reject(error);
      pending.delete(id);
    }
  };

  const stopWorker = () => {
    if (worker) {
      const current = worker;
      worker = undefined;
      current.stdin.end();
      current.kill();
    }
  };

  const startWorker = (): ChildProcessWithoutNullStreams => {
    const encoded = Buffer.from(buildWindowsWorkerScript(timeoutSeconds), "utf16le").toString("base64");
    const child = spawn(powershellPath, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true });
    stderrTail = "";

    createInterface({ input: child.stdout }).on("line", (line) => {
      let message: WorkerMessage;
      try {
        message = JSON.parse(line) as WorkerMessage;
      } catch {
        logger.debug(`Windows auth worker emitted non-JSON output: ${line.slice(0, 200)}`);
        return;
      }
      const id = typeof message.id === "number" ? message.id : undefined;
      const request = id !== undefined ? pending.get(id) : undefined;
      if (!request || id === undefined) {
        if (message.error) logger.error(`Windows auth worker error: ${message.error}`);
        return;
      }
      pending.delete(id);
      clearTimeout(request.timer);
      if (message.error !== undefined) {
        request.reject(new Error(`Azure DevOps Server request failed: ${message.error}`));
        return;
      }
      request.resolve({
        status: message.status ?? 0,
        contentType: message.contentType ?? "",
        body: Buffer.from(message.body ?? "", "base64"),
      });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-2000);
    });

    const onExit = (reason: string) => {
      if (worker === child) worker = undefined;
      const detail = stderrTail.trim() ? ` ${stderrTail.trim()}` : "";
      failAll(new Error(`Windows authentication worker (${powershellPath}) ${reason}.${detail}`));
    };
    child.on("error", (error) => onExit(`failed: ${error.message}`));
    child.on("exit", (code) => onExit(`exited with code ${code}`));
    child.stdin.on("error", () => {
      // Surfaced through the 'exit'/'error' handlers.
    });

    return child;
  };

  const transport = (request: TransportRequest): Promise<TransportResponse> => {
    if (platform !== "win32") {
      return Promise.reject(new Error("Windows integrated authentication ('-a windows') is only available when the MCP server runs on Windows. Use '-a pat' on other platforms."));
    }
    if (!worker) {
      worker = startWorker();
    }
    const child = worker;
    const id = nextId++;

    return new Promise<TransportResponse>((resolve, reject) => {
      const timer = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error(`Azure DevOps Server request timed out after ${timeoutSeconds + 15} seconds.`));
          // The worker processes requests sequentially; restart it so later requests are not blocked.
          if (worker === child) stopWorker();
        },
        (timeoutSeconds + 15) * 1000
      );
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, url: request.url, accept: request.accept, userAgent: request.userAgent }) + "\n");
    });
  };

  return Object.assign(transport, { dispose: stopWorker });
}

/**
 * Creates a transport that sends a Personal Access Token using Basic authentication.
 * The token is read from the PERSONAL_ACCESS_TOKEN environment variable on each request
 * (base64 of "username:pat", matching the existing cloud `pat` authentication format).
 */
export function createPatTransport(readEnv: () => string | undefined = () => process.env["PERSONAL_ACCESS_TOKEN"], fetchFn: typeof fetch = (...args) => fetch(...args)): Transport {
  return async (request) => {
    const basicValue = readEnv();
    if (!basicValue) {
      throw new Error("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty. Set it to base64('<username>:<pat>') for your Azure DevOps Server account.");
    }
    const response = await fetchFn(request.url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "Authorization": `Basic ${basicValue}`,
        "Accept": request.accept,
        "User-Agent": request.userAgent,
      },
    });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: Buffer.from(await response.arrayBuffer()),
    };
  };
}
