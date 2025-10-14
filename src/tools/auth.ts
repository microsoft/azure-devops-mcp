// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { WebApi } from "azure-devops-node-api";
import { apiVersion } from "../utils.js";
import { IdentityBase } from "azure-devops-node-api/interfaces/IdentitiesInterfaces.js";

interface IdentitiesResponse {
  value: IdentityBase[];
}

async function getCurrentUserDetails(tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  const connection = await connectionProvider();
  const url = `${connection.serverUrl}/_apis/connectionData`;
  const token = await tokenProvider();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
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
async function searchIdentities(identity: string, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): Promise<IdentitiesResponse> {
  const token = await tokenProvider();
  const connection = await connectionProvider();
  const orgName = connection.serverUrl.split("/")[3];
  const baseUrl = `https://vssps.dev.azure.com/${orgName}/_apis/identities`;

  const params = new URLSearchParams({
    "api-version": apiVersion,
    "searchFilter": "General",
    "filterValue": identity,
  });

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
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
async function getUserIdFromEmail(userEmail: string, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string): Promise<string> {
  const identities = await searchIdentities(userEmail, tokenProvider, connectionProvider, userAgentProvider);

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
