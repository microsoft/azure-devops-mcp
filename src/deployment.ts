// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface DeploymentContext {
  organizationInput: string;
  organizationUrl: string;
  organizationName?: string;
  isHosted: boolean;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isHostedHostname(hostname: string): boolean {
  return hostname === "dev.azure.com" || hostname.endsWith(".visualstudio.com");
}

export function extractOrganizationNameFromServerUrl(serverUrl: string): string | undefined {
  try {
    const parsed = new URL(serverUrl);
    if (parsed.hostname === "dev.azure.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments[0];
    }

    if (parsed.hostname.endsWith(".visualstudio.com")) {
      return parsed.hostname.split(".")[0];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function resolveDeploymentContext(organizationInput: string): DeploymentContext {
  if (isUrlLike(organizationInput)) {
    const parsed = new URL(organizationInput);
    const organizationUrl = trimTrailingSlash(parsed.toString());
    const isHosted = isHostedHostname(parsed.hostname);

    return {
      organizationInput,
      organizationUrl,
      organizationName: extractOrganizationNameFromServerUrl(organizationUrl),
      isHosted,
    };
  }

  const organizationName = organizationInput;

  return {
    organizationInput,
    organizationName,
    organizationUrl: `https://dev.azure.com/${organizationName}`,
    isHosted: true,
  };
}

export function buildIdentityApiBaseUrl(serverUrl: string): string {
  const organizationName = extractOrganizationNameFromServerUrl(serverUrl);
  if (organizationName) {
    return `https://vssps.dev.azure.com/${organizationName}/_apis/identities`;
  }

  return `${trimTrailingSlash(serverUrl)}/_apis/identities`;
}

export function buildHostedSearchUrl(serverUrl: string, searchApiPath: string, apiVersion: string): string | undefined {
  const organizationName = extractOrganizationNameFromServerUrl(serverUrl);
  if (!organizationName) {
    return undefined;
  }

  return `https://almsearch.dev.azure.com/${organizationName}/_apis/search/${searchApiPath}?api-version=${apiVersion}`;
}
