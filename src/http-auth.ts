// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getRequestContext } from "./request-context.js";

const azureDevOpsResourceAppId = "499b84ac-1321-427f-aa17-267ca6975798";
const easyAuthAccessTokenHeader = "x-ms-token-aad-access-token";

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header)) {
    const firstValue = header.find((value) => typeof value === "string" && value.trim());
    return firstValue?.trim();
  }
  return undefined;
}

function getIncomingAccessToken(): string | undefined {
  const headers = getRequestContext()?.headers;
  if (!headers) return undefined;

  const easyAuthToken = getHeaderValue(headers[easyAuthAccessTokenHeader]);
  if (easyAuthToken) {
    return easyAuthToken;
  }

  const authorizationHeader = getHeaderValue(headers["authorization"]);
  if (!authorizationHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  return match?.[1]?.trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length < 2) return undefined;

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isAzureDevOpsAudienceToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const audience = typeof payload?.aud === "string" ? payload.aud : undefined;
  if (!audience) return false;

  return audience === azureDevOpsResourceAppId || audience.includes(azureDevOpsResourceAppId);
}

export { azureDevOpsResourceAppId, getIncomingAccessToken, isAzureDevOpsAudienceToken };
