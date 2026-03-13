// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getBearerHandler, WebApi } from "azure-devops-node-api";
import { packageVersion } from "../version.js";

/**
 * Returns a WebApi connection. If `organization` is provided, creates a new
 * connection to that org; otherwise falls back to the default connectionProvider.
 */
export async function getConnection(
  organization: string | undefined,
  connectionProvider: () => Promise<WebApi>,
  tokenProvider: () => Promise<string>,
  userAgentProvider: () => string
): Promise<WebApi> {
  if (!organization) {
    return connectionProvider();
  }

  const orgUrl = "https://dev.azure.com/" + organization;
  const accessToken = await tokenProvider();
  const authHandler = getBearerHandler(accessToken);

  return new WebApi(orgUrl, authHandler, undefined, {
    productName: "AzureDevOps.MCP",
    productVersion: packageVersion,
    userAgent: userAgentProvider(),
  });
}
