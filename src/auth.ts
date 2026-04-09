// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { AccountInfo, AuthenticationResult, ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";
import open from "open";
import { azureDevOpsResourceAppId, getIncomingAccessToken, isAzureDevOpsAudienceToken } from "./http-auth.js";
import { logger } from "./logger.js";

const scopes = [`${azureDevOpsResourceAppId}/.default`];

class OAuthAuthenticator {
  static clientId = "0d50963b-7bb9-4fe7-94c7-a99af00b5136";
  static defaultAuthority = "https://login.microsoftonline.com/common";
  static zeroTenantId = "00000000-0000-0000-0000-000000000000";

  private accountId: AccountInfo | null;
  private publicClientApp: PublicClientApplication;

  constructor(tenantId?: string) {
    this.accountId = null;

    let authority = OAuthAuthenticator.defaultAuthority;
    if (tenantId && tenantId !== OAuthAuthenticator.zeroTenantId) {
      authority = `https://login.microsoftonline.com/${tenantId}`;
      logger.debug(`OAuthAuthenticator: Using tenant-specific authority for tenantId='${tenantId}'`);
    } else {
      logger.debug(`OAuthAuthenticator: Using default common authority`);
    }

    this.publicClientApp = new PublicClientApplication({
      auth: {
        clientId: OAuthAuthenticator.clientId,
        authority,
      },
    });
    logger.debug(`OAuthAuthenticator: Initialized with clientId='${OAuthAuthenticator.clientId}'`);
  }

  public async getToken(): Promise<string> {
    let authResult: AuthenticationResult | null = null;
    if (this.accountId) {
      logger.debug(`OAuthAuthenticator: Attempting silent token acquisition for cached account`);
      try {
        authResult = await this.publicClientApp.acquireTokenSilent({
          scopes,
          account: this.accountId,
        });
        logger.debug(`OAuthAuthenticator: Successfully acquired token silently`);
      } catch (error) {
        logger.debug(`OAuthAuthenticator: Silent token acquisition failed: ${error instanceof Error ? error.message : String(error)}`);
        authResult = null;
      }
    } else {
      logger.debug(`OAuthAuthenticator: No cached account available, interactive auth required`);
    }
    if (!authResult) {
      logger.debug(`OAuthAuthenticator: Starting interactive token acquisition`);
      authResult = await this.publicClientApp.acquireTokenInteractive({
        scopes,
        openBrowser: async (url) => {
          logger.debug(`OAuthAuthenticator: Opening browser for authentication`);
          open(url);
        },
      });
      this.accountId = authResult.account;
      logger.debug(`OAuthAuthenticator: Successfully acquired token interactively, account cached`);
    }

    if (!authResult.accessToken) {
      logger.error(`OAuthAuthenticator: Authentication result contains no access token`);
      throw new Error("Failed to obtain Azure DevOps OAuth token.");
    }
    logger.debug(`OAuthAuthenticator: Token obtained successfully`);
    return authResult.accessToken;
  }
}

function createAuthenticator(type: string, tenantId?: string): () => Promise<string> {
  logger.debug(`Creating authenticator of type '${type}' with tenantId='${tenantId ?? "undefined"}'`);
  switch (type) {
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
        const result = await credential.getToken(scopes);
        if (!result) {
          logger.error(`${type}: Failed to obtain token - credential.getToken returned null/undefined`);
          throw new Error("Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged or use interactive type of authentication.");
        }
        logger.debug(`${type}: Successfully obtained Azure DevOps token`);
        return result.token;
      };

    case "passthrough": {
      const authorityTenant = process.env["ADO_MCP_OBO_TENANT_ID"] || tenantId || OAuthAuthenticator.zeroTenantId;
      const clientId = process.env["ADO_MCP_OBO_CLIENT_ID"];
      const clientSecret = process.env["ADO_MCP_OBO_CLIENT_SECRET"];
      const canExchangeToken = !!clientId && !!clientSecret && authorityTenant !== OAuthAuthenticator.zeroTenantId;

      const confidentialClient =
        canExchangeToken
          ? new ConfidentialClientApplication({
              auth: {
                clientId,
                clientSecret,
                authority: `https://login.microsoftonline.com/${authorityTenant}`,
              },
            })
          : null;

      return async () => {
        const incomingToken = getIncomingAccessToken();
        if (!incomingToken) {
          logger.error("passthrough: No incoming user token found in the HTTP request");
          throw new Error(
            "No incoming Entra user token was found. Ensure the MCP endpoint receives a bearer token directly or enable Easy Auth token store so x-ms-token-aad-access-token is forwarded."
          );
        }

        if (isAzureDevOpsAudienceToken(incomingToken)) {
          logger.debug("passthrough: Using incoming Azure DevOps audience token directly");
          return incomingToken;
        }

        if (!confidentialClient) {
          logger.error("passthrough: OBO configuration missing for token exchange");
          throw new Error(
            "The incoming token is not an Azure DevOps token, and OBO exchange is not configured. Set ADO_MCP_OBO_CLIENT_ID, ADO_MCP_OBO_CLIENT_SECRET, and ADO_MCP_OBO_TENANT_ID."
          );
        }

        const result = await confidentialClient.acquireTokenOnBehalfOf({
          oboAssertion: incomingToken,
          scopes,
        });

        if (!result?.accessToken) {
          logger.error("passthrough: Failed to exchange incoming token for Azure DevOps token");
          throw new Error("Failed to exchange the incoming Entra user token for an Azure DevOps delegated token.");
        }

        logger.debug("passthrough: Successfully exchanged incoming token for Azure DevOps token");
        return result.accessToken;
      };
    }

    default:
      logger.debug(`Authenticator: Using OAuth interactive authentication (default)`);
      const authenticator = new OAuthAuthenticator(tenantId);
      return () => {
        return authenticator.getToken();
      };
  }
}
export { createAuthenticator };
