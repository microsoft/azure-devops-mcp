// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { logger } from "./logger.js";
import { azureDevOpsScopes, OAuthAuthenticator } from "./oauth.js";

const patAllowedHosts = new Set(["dev.azure.com", "vssps.dev.azure.com", "almsearch.dev.azure.com"]);

function isPatAllowedHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return patAllowedHosts.has(normalizedHostname) || normalizedHostname.endsWith(".visualstudio.com");
}

function installPatFetchInterceptor(basicValue: string): void {
  const originalFetch = globalThis.fetch;
  const patBearerValue = `Bearer ${basicValue}`;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.get("Authorization") !== patBearerValue) {
      return originalFetch(input, init);
    }

    const requestUrl = new URL(input instanceof Request ? input.url : input.toString());
    if (requestUrl.protocol !== "https:" || !isPatAllowedHost(requestUrl.hostname)) {
      throw new Error(`Refusing to send a Personal Access Token to untrusted destination '${requestUrl.origin}'`);
    }

    headers.set("Authorization", `Basic ${basicValue}`);
    if (input instanceof Request) {
      return originalFetch(new Request(input, { ...init, headers }));
    }
    return originalFetch(input, { ...init, headers });
  };
}

function createAuthenticator(type: string, tenantId?: string): () => Promise<string> {
  logger.debug(`Creating authenticator of type '${type}' with tenantId='${tenantId ?? "undefined"}'`);
  switch (type) {
    case "pat":
      logger.debug(`Authenticator: Using PAT authentication (PERSONAL_ACCESS_TOKEN)`);
      return async () => {
        logger.debug(`${type}: Reading token from PERSONAL_ACCESS_TOKEN environment variable`);
        const b64Pat = process.env["PERSONAL_ACCESS_TOKEN"];
        if (!b64Pat) {
          logger.error(`${type}: PERSONAL_ACCESS_TOKEN environment variable is not set or empty`);
          throw new Error("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty. Please set it with a valid base64-encoded Azure DevOps Personal Access Token.");
        }
        // Return base64 value as-is — caller uses it directly as the Basic auth credential
        logger.debug(`${type}: Successfully retrieved PAT from environment variable`);
        return b64Pat;
      };

    case "envvar":
      logger.debug(`Authenticator: Using environment variable authentication (ADO_MCP_AUTH_TOKEN)`);
      // Read token from fixed environment variable
      return async () => {
        logger.debug(`${type}: Reading token from ADO_MCP_AUTH_TOKEN environment variable`);
        const token = process.env["ADO_MCP_AUTH_TOKEN"];
        if (!token) {
          logger.error(`${type}: ADO_MCP_AUTH_TOKEN environment variable is not set or empty`);
          throw new Error("Environment variable 'ADO_MCP_AUTH_TOKEN' is not set or empty. Please set it with a valid Azure DevOps Personal Access Token.");
        }
        logger.debug(`${type}: Successfully retrieved token from environment variable`);
        return token;
      };

    case "azcli":
    case "env":
      if (type !== "env") {
        logger.debug(`${type}: Setting AZURE_TOKEN_CREDENTIALS to 'dev' for development credential chain`);
        process.env.AZURE_TOKEN_CREDENTIALS = "dev";
      }
      let credential: TokenCredential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
      if (tenantId) {
        // Use Azure CLI credential if tenantId is provided for multi-tenant scenarios
        const azureCliCredential = new AzureCliCredential({ tenantId });
        credential = new ChainedTokenCredential(azureCliCredential, credential);
      }
      return async () => {
        const result = await credential.getToken(azureDevOpsScopes);
        if (!result) {
          logger.error(`${type}: Failed to obtain token - credential.getToken returned null/undefined`);
          throw new Error("Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged or use interactive type of authentication.");
        }
        logger.debug(`${type}: Successfully obtained Azure DevOps token`);
        return result.token;
      };

    default:
      logger.debug(`Authenticator: Using OAuth interactive authentication (default)`);
      const authenticator = new OAuthAuthenticator(tenantId);
      return () => {
        return authenticator.getToken();
      };
  }
}
export { createAuthenticator, installPatFetchInterceptor };
