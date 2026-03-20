// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { WebApi } from "azure-devops-node-api";
import { apiVersion } from "../utils.js";
import { isCustomUrl } from "../config.js";
import { IdentityBase } from "azure-devops-node-api/interfaces/IdentitiesInterfaces.js";

interface IdentitiesResponse {
  value: IdentityBase[];
}

async function getCurrentUserDetails(authHeaderProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  const connection = await connectionProvider();
  const url = `${connection.serverUrl}/_apis/connectionData`;
  const authHeader = await authHeaderProvider();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "User-Agent": userAgentProvider(),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Error fetching user details: ${data.message}`);
  }
  return data;
}

/**
 * Searches for identities using Azure DevOps Identity API
 */
async function searchIdentities(identity: string, authHeaderProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): Promise<IdentitiesResponse> {
  const authHeader = await authHeaderProvider();
  const connection = await connectionProvider();
  let baseUrl: string;
  if (isCustomUrl) {
    baseUrl = `${connection.serverUrl}/_apis/identities`;
  } else {
    const orgName = connection.serverUrl.split("/")[3];
    baseUrl = `https://vssps.dev.azure.com/${orgName}/_apis/identities`;
  }

  const params = new URLSearchParams({
    "api-version": apiVersion,
    "searchFilter": "General",
    "filterValue": identity,
  });

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "User-Agent": userAgentProvider(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

/**
 * Gets the user ID from email or unique name using Azure DevOps Identity API
 */
async function getUserIdFromEmail(userEmail: string, authHeaderProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): Promise<string> {
  const identities = await searchIdentities(userEmail, authHeaderProvider, connectionProvider, userAgentProvider);

  if (!identities || identities.value?.length === 0) {
    throw new Error(`No user found with email/unique name: ${userEmail}`);
  }

  const firstIdentity = identities.value[0];
  if (!firstIdentity.id) {
    throw new Error(`No ID found for user with email/unique name: ${userEmail}`);
  }

  return firstIdentity.id;
}

export { getCurrentUserDetails, getUserIdFromEmail, searchIdentities };
