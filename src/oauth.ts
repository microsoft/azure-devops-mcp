// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccountInfo, AuthenticationResult, PublicClientApplication } from "@azure/msal-node";
import { NativeBrokerPlugin } from "@azure/msal-node-extensions";
import open from "open";
import { logger } from "./logger.js";

export const azureDevOpsScopes = ["499b84ac-1321-427f-aa17-267ca6975798/.default"];

export class OAuthAuthenticator {
  static clientId = "0d50963b-7bb9-4fe7-94c7-a99af00b5136";
  static defaultAuthority = "https://login.microsoftonline.com/common";
  static zeroTenantId = "00000000-0000-0000-0000-000000000000";

  private accountId: AccountInfo | null;
  private publicClientApp: PublicClientApplication;
  private publicClientAppFallback: PublicClientApplication;

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
      broker: {
        nativeBrokerPlugin: new NativeBrokerPlugin(),
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message) => {
            logger.debug(`MSALClient[${level}]: ${message}`);
          },
        },
      },
    });
    this.publicClientAppFallback = new PublicClientApplication({
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
          scopes: azureDevOpsScopes,
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
      try {
        authResult = await this.publicClientApp.acquireTokenInteractive({
          scopes: azureDevOpsScopes,
          openBrowser: async (url) => {
            logger.debug(`OAuthAuthenticator: Opening browser for authentication with target URL: ${url}`);
            open(url);
          },
        });
        this.accountId = authResult.account;
        logger.debug(`OAuthAuthenticator: Successfully acquired token interactively, account cached`);
      } catch (error) {
        const msalErrorMessage = (error as any).platformBrokerError ? JSON.stringify((error as any).platformBrokerError) : "";
        logger.debug(`OAuthAuthenticator: Interactive token acquisition failed: ${error instanceof Error ? error.message + msalErrorMessage : String(error)}`);
        authResult = null;
      }
    }
    if (!authResult) {
      logger.debug(`OAuthAuthenticator: Starting interactive token acquisition without broker`);
      authResult = await this.publicClientAppFallback.acquireTokenInteractive({
        scopes: azureDevOpsScopes,
        openBrowser: async (url) => {
          logger.debug(`OAuthAuthenticator: Opening browser for authentication with target URL: ${url}`);
          open(url);
        },
      });
      logger.debug(`OAuthAuthenticator: Successfully acquired token interactively without broker`);
    }

    if (!authResult?.accessToken) {
      logger.error(`OAuthAuthenticator: Authentication result contains no access token`);
      throw new Error("Failed to obtain Azure DevOps OAuth token.");
    }
    logger.debug(`OAuthAuthenticator: Token obtained successfully`);
    return authResult.accessToken;
  }
}