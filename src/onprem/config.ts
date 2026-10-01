// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Configuration for the gated Azure DevOps Server (on-premises) mode.
 *
 * On-premises mode is enabled only when `--server-url` is supplied. In that mode the
 * positional `<organization>` argument is interpreted as the project collection name
 * (for example `DefaultCollection`), and only read-only pull request review tools are
 * registered. Cloud-only discovery endpoints (vssps tenant lookup, Entra ID tokens,
 * organization-level search) are never called.
 */

export const DEFAULT_ONPREM_API_VERSION = "5.0";
export const ONPREM_AUTHENTICATION_TYPES = ["windows", "pat"] as const;
export type OnPremAuthenticationType = (typeof ONPREM_AUTHENTICATION_TYPES)[number];

export interface OnPremConfig {
  /** Fully-qualified collection URL without a trailing slash, e.g. https://server/tfs/DefaultCollection */
  collectionUrl: string;
  collection: string;
  authentication: OnPremAuthenticationType;
  apiVersion: string;
}

export interface OnPremConfigInput {
  serverUrl: string;
  collection: string;
  authentication?: string;
  apiVersion?: string;
}

const API_VERSION_PATTERN = /^\d+\.\d+(-preview(\.\d+)?)?$/;

export function resolveOnPremConfig(input: OnPremConfigInput): OnPremConfig {
  let serverUrl: URL;
  try {
    serverUrl = new URL(input.serverUrl);
  } catch {
    throw new Error(`Invalid --server-url '${input.serverUrl}'. Provide the Azure DevOps Server base URL, for example https://server/tfs or https://server.`);
  }

  if (serverUrl.protocol !== "https:" && serverUrl.protocol !== "http:") {
    throw new Error(`Unsupported --server-url protocol '${serverUrl.protocol}'. Use https (recommended) or http.`);
  }
  if (serverUrl.username || serverUrl.password) {
    throw new Error("--server-url must not contain credentials. Use Windows integrated authentication or the PERSONAL_ACCESS_TOKEN environment variable instead.");
  }
  if (serverUrl.search || serverUrl.hash) {
    throw new Error("--server-url must not contain a query string or fragment.");
  }

  const collection = input.collection?.trim();
  if (!collection || collection.includes("/") || collection.includes("\\") || collection === "." || collection === "..") {
    throw new Error(`Invalid collection name '${input.collection}'. Pass the project collection name (for example DefaultCollection) as the first argument.`);
  }

  const authentication = (input.authentication ?? "windows") as OnPremAuthenticationType;
  if (!ONPREM_AUTHENTICATION_TYPES.includes(authentication)) {
    throw new Error(`Authentication type '${input.authentication}' is not supported with --server-url. Supported types for Azure DevOps Server: ${ONPREM_AUTHENTICATION_TYPES.join(", ")}.`);
  }

  const apiVersion = input.apiVersion?.trim() || DEFAULT_ONPREM_API_VERSION;
  if (!API_VERSION_PATTERN.test(apiVersion)) {
    throw new Error(`Invalid --api-version '${apiVersion}'. Expected a value such as 5.0, 5.1 or 6.0-preview.1.`);
  }

  const basePath = serverUrl.pathname.replace(/\/+$/, "");
  const collectionUrl = `${serverUrl.origin}${basePath}/${encodeURIComponent(collection)}`;

  return { collectionUrl, collection, authentication, apiVersion };
}
