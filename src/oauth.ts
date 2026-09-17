// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccountInfo, AuthenticationResult, PublicClientApplication } from "@azure/msal-node";
import open from "open";
import { logger } from "./logger.js";

export const azureDevOpsScopes = ["499b84ac-1321-427f-aa17-267ca6975798/.default"];

const clientId = "0d50963b-7bb9-4fe7-94c7-a99af00b5136";
const defaultAuthority = "https://login.microsoftonline.com/common";
const zeroTenantId = "00000000-0000-0000-0000-000000000000";

class ClientAppWrapper {
  private accountId: AccountInfo | null;
  private publicClientApp: PublicClientApplication;
  private withBroker: boolean;

  private constructor(authority: string) {
    this.accountId = null;
    this.publicClientApp = new PublicClientApplication({
      auth: {
        clientId,
        authority,
      },
    });
    this.withBroker = false;
  }

  public static async initialize(authority: string, tryWithBroker: boolean): Promise<ClientAppWrapper> {
    const clientApp = new ClientAppWrapper(authority);
    if (tryWithBroker) {
      try {
        const { NativeBrokerPlugin } = await import("@azure/msal-node-extensions");
        clientApp.publicClientApp = new PublicClientApplication({
          auth: {
            clientId,
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
        clientApp.withBroker = true;
        logger.debug(`PublicClientApplication(authority='${authority}') initialized with broker successfully`);
      } catch (error) {
        logger.debug(`PublicClientApplication(authority='${authority}') initialized without broker`);
        logger.error(`Failed to initialize PublicClientApplication with broker: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return clientApp;
  }

  public isWithBroker(): boolean {
    return this.withBroker;
  }

  public async getToken(): Promise<string> {
    const logPrefix = `ClientAppWrapper(${this.withBroker ? "withBroker" : "noBroker"})`;
    let authResult: AuthenticationResult | null = null;
    if (this.accountId) {
      logger.debug(`${logPrefix}: Attempting silent token acquisition for cached account`);
      try {
        authResult = await this.publicClientApp.acquireTokenSilent({
          scopes: azureDevOpsScopes,
          account: this.accountId,
        });
        logger.debug(`${logPrefix}: Successfully acquired token silently`);
      } catch (error) {
        logger.debug(`${logPrefix}: Silent token acquisition failed: ${error instanceof Error ? error.message : String(error)}`);
        authResult = null;
      }
    } else {
      logger.debug(`${logPrefix}: No cached account available, interactive auth required`);
    }

    if (!authResult) {
      logger.debug(`${logPrefix}: Starting interactive token acquisition`);
      try {
        authResult = await this.publicClientApp.acquireTokenInteractive({
          scopes: azureDevOpsScopes,
          openBrowser: async (url) => {
            logger.debug(`${logPrefix}: Opening browser for authentication with target URL: ${url}`);
            open(url);
          },
        });
        this.accountId = authResult.account;
        logger.debug(`${logPrefix}: Successfully acquired token interactively, account cached`);
      } catch (error) {
        const msalErrorMessage = (error as any).platformBrokerError ? JSON.stringify((error as any).platformBrokerError) : "";
        logger.debug(`${logPrefix}: Interactive token acquisition failed: ${error instanceof Error ? error.message + msalErrorMessage : String(error)}`);
        authResult = null;
      }
    }

    if (!authResult?.accessToken) {
      throw new Error("Failed to obtain Azure DevOps OAuth token.");
    }
    logger.debug(`${logPrefix}: Token obtained successfully`);
    return authResult.accessToken;
  }
}

export class OAuthAuthenticator {
  private authority: string;
  private clientApp: ClientAppWrapper | null;

  constructor(tenantId?: string) {
    this.authority = defaultAuthority;
    if (tenantId && tenantId !== zeroTenantId) {
      this.authority = `https://login.microsoftonline.com/${tenantId}`;
    }
    this.clientApp = null;
  }

  public async getToken(): Promise<string> {
    if (!this.clientApp) {
      this.clientApp = await ClientAppWrapper.initialize(this.authority, true);
    }

    try {
      const token = await this.clientApp.getToken();
      return token;
    } catch {
      if (this.clientApp.isWithBroker()) {
        logger.debug(`OAuthAuthenticator: Token acquisition failed with broker, retrying without broker`);
        this.clientApp = await ClientAppWrapper.initialize(this.authority, false);
      }
    }
    return await this.clientApp.getToken();
  }
}
