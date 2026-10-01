// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { OnPremConfig } from "./config.js";
import { Transport } from "./transport.js";

export type QueryValue = string | number | boolean | undefined | null;

export class AzureDevOpsServerError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AzureDevOpsServerError";
  }
}

/** Encodes a single URL path segment such as a project or repository name. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

/**
 * Minimal read-only REST client for an Azure DevOps Server project collection.
 * Every request is constrained to the configured collection URL and uses the
 * configured (Azure DevOps Server 2019-compatible by default) api-version.
 */
export class AzureDevOpsServerClient {
  private readonly collectionUrl: URL;

  constructor(
    private readonly config: OnPremConfig,
    private readonly transport: Transport,
    private readonly userAgentProvider: () => string
  ) {
    this.collectionUrl = new URL(config.collectionUrl + "/");
  }

  get apiVersion(): string {
    return this.config.apiVersion;
  }

  buildUrl(path: string, query: Record<string, QueryValue> = {}, apiVersion = this.config.apiVersion): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) {
      throw new Error("Absolute URLs are not allowed for Azure DevOps Server requests.");
    }
    const url = new URL(path.replace(/^\/+/, ""), this.collectionUrl);
    if (url.origin !== this.collectionUrl.origin || !url.pathname.startsWith(this.collectionUrl.pathname)) {
      throw new Error("Refusing to send a request outside the configured Azure DevOps Server collection.");
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("api-version", apiVersion);
    return url.toString();
  }

  async getJson<T>(path: string, query: Record<string, QueryValue> = {}, apiVersion?: string): Promise<T> {
    const response = await this.send(this.buildUrl(path, query, apiVersion), "application/json");
    const text = response.body.toString("utf8");
    if (!/json/i.test(response.contentType)) {
      throw new AzureDevOpsServerError(
        `Azure DevOps Server returned unexpected content type '${response.contentType || "unknown"}' (HTTP ${response.status}). Verify --server-url and the collection name.`,
        response.status
      );
    }
    try {
      return JSON.parse(text.replace(/^\uFEFF/, "")) as T;
    } catch {
      throw new AzureDevOpsServerError(`Azure DevOps Server returned invalid JSON (HTTP ${response.status}).`, response.status);
    }
  }

  private async send(url: string, accept: string) {
    const response = await this.transport({ url, accept, userAgent: this.userAgentProvider() });
    if (response.status >= 200 && response.status < 300) {
      return response;
    }
    throw new AzureDevOpsServerError(describeFailure(response.status, response.contentType, response.body), response.status);
  }
}

function describeFailure(status: number, contentType: string, body: Buffer): string {
  let detail = "";
  if (/json/i.test(contentType)) {
    try {
      const parsed = JSON.parse(body.toString("utf8").replace(/^\uFEFF/, ""));
      if (parsed && typeof parsed.message === "string") detail = parsed.message;
    } catch {
      // ignore
    }
  }
  if (status === 401) {
    return `HTTP 401 Unauthorized from Azure DevOps Server. ${detail ? detail + " " : ""}Verify that the signed-in Windows account (or PAT) has access to the collection.`.trim();
  }
  if (status >= 300 && status < 400) {
    return `HTTP ${status} redirect from Azure DevOps Server was not followed. Verify --server-url and the collection name.`;
  }
  if (status === 404 && !detail) {
    return "HTTP 404 Not Found from Azure DevOps Server. Verify --server-url, the collection name, and the project/repository/pull request identifiers.";
  }
  return `HTTP ${status} from Azure DevOps Server${detail ? `: ${detail}` : "."}`;
}
