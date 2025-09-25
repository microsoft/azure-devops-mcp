// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { AccountInfo, AuthenticationResult, PublicClientApplication } from "@azure/msal-node";
import path from "node:path";
import { spawnSync } from "node:child_process";
import open from "open";

const scopes = ["499b84ac-1321-427f-aa17-267ca6975798/.default"];

class OAuthAuthenticator {
  static clientId = "0d50963b-7bb9-4fe7-94c7-a99af00b5136";
  static defaultAuthority = "https://login.microsoftonline.com/common";

  private accountId: AccountInfo | null;
  private publicClientApp: PublicClientApplication;

  constructor(tenantId?: string) {
    this.accountId = null;
    this.publicClientApp = new PublicClientApplication({
      auth: {
        clientId: OAuthAuthenticator.clientId,
        authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : OAuthAuthenticator.defaultAuthority,
      },
    });
  }

  public async getToken(): Promise<string> {
    let authResult: AuthenticationResult | null = null;
    if (this.accountId) {
      try {
        authResult = await this.publicClientApp.acquireTokenSilent({
          scopes,
          account: this.accountId,
        });
      } catch (error) {
        authResult = null;
      }
    }
    if (!authResult) {
      authResult = await this.publicClientApp.acquireTokenInteractive({
        scopes,
        openBrowser: async (url) => {
          open(url);
        },
      });
      this.accountId = authResult.account;
    }

    if (!authResult.accessToken) {
      throw new Error("Failed to obtain Azure DevOps OAuth token.");
    }
    return authResult.accessToken;
  }
}

/**
  * When working in GitHub Codespaces with an Azure DevOps repo, it's common to use https://github.com/microsoft/ado-codespaces-auth
  * This adds a ~/ado-auth-helper which connects back to VS Code to perform authentication with Azure DevOps.
  *
  * Utilizing this removes the requirement to install AzureCLI in codespaces, but limits the tenant to what is configured in VS Code.
  */
class AzureAuthHelper {
  private adoHelper: string;
  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    this.adoHelper = path.join(home, "ado-auth-helper");
  }
  async getToken(): Promise<string> {
    // Switching to spawn would support context switching, but is a more complicated change.
    return spawnSync(this.adoHelper, ["get-access-token"], { encoding: "utf8" }).stdout.trim();
  }
}

function createAuthenticator(type: string, tenantId?: string): () => Promise<string> {
  switch (type) {
    case "azcli":
    case "env":
      if (type !== "env") {
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
          throw new Error("Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged or use interactive type of authentication.");
        }
        return result.token;
      };

    case "ado-codespaces":
      const authHelper = new AzureAuthHelper();
      return () => authHelper.getToken();

    default:
      const authenticator = new OAuthAuthenticator(tenantId);
      return () => {
        return authenticator.getToken();
      };
  }
}
export { createAuthenticator };
