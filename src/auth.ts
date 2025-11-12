// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken, AzureCliCredential, ChainedTokenCredential, ClientAssertionCredential, DefaultAzureCredential, GetTokenOptions, ManagedIdentityCredential, TokenCredential } from "@azure/identity";
import { AccountInfo, AuthenticationResult, PublicClientApplication } from "@azure/msal-node";
import open from "open";

const scopes = ["499b84ac-1321-427f-aa17-267ca6975798/.default"];

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
    }

    this.publicClientApp = new PublicClientApplication({
      auth: {
        clientId: OAuthAuthenticator.clientId,
        authority,
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
      } catch {
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
 * Creates a federated application credential that uses a managed identity's
 * access token as a signed client assertion for acquiring tokens for a primary
 * client application.
 */
class FederatedApplicationCredential implements TokenCredential {
  private managedIdentity: ManagedIdentityCredential;
  private clientAssertion: ClientAssertionCredential;

  constructor(tenantId: string, msiClientId: string, appClientId: string) {
    this.managedIdentity = new ManagedIdentityCredential(msiClientId);
    this.clientAssertion = new ClientAssertionCredential(
      tenantId,
      appClientId,
      this.computeAssertionAsync.bind(this)
    );
  }

  async getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> {
    return this.clientAssertion.getToken(scopes, options);
  }

  /**
   * Get an exchange token from our managed identity to use as an assertion.
   */
  private async computeAssertionAsync(): Promise<string> {
    const msiContext = ["api://AzureADTokenExchange/.default"];
    const msiToken = await this.managedIdentity.getToken(msiContext);
    if (!msiToken) {
      throw new Error("Failed to obtain managed identity token for federated authentication.");
    }
    return msiToken.token;
  }
}

function createAuthenticator(type: string, tenantId?: string): () => Promise<string> {
  switch (type) {
    case "envvar":
      // Read token from fixed environment variable
      return async () => {
        const token = process.env["ADO_MCP_AUTH_TOKEN"];
        if (!token) {
          throw new Error("Environment variable 'ADO_MCP_AUTH_TOKEN' is not set or empty. Please set it with a valid Azure DevOps Personal Access Token.");
        }
        return token;
      };

    case "azcli":
    case "env":
      if (type !== "env") {
        process.env.AZURE_TOKEN_CREDENTIALS = "dev";
      }
      
      let credential: TokenCredential;
      
      // Check if federated identity configuration is available
      const federatedTenantId = tenantId || process.env["AZURE_FEDERATED_TENANT_ID"];
      const msiClientId = process.env["AZURE_MSI_CLIENT_ID"];
      const appClientId = process.env["AZURE_APP_CLIENT_ID"];
      
      if (federatedTenantId && msiClientId && appClientId) {
        // Use federated application credential with managed identity
        credential = new FederatedApplicationCredential(federatedTenantId, msiClientId, appClientId);
      } else {
        // Fall back to DefaultAzureCredential
        credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
        if (tenantId) {
          // Use Azure CLI credential if tenantId is provided for multi-tenant scenarios
          const azureCliCredential = new AzureCliCredential({ tenantId });
          credential = new ChainedTokenCredential(azureCliCredential, credential);
        }
      }
      
      return async () => {
        const result = await credential.getToken(scopes);
        if (!result) {
          throw new Error("Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged or use interactive type of authentication.");
        }
        return result.token;
      };

    default:
      const authenticator = new OAuthAuthenticator(tenantId);
      return () => {
        return authenticator.getToken();
      };
  }
}
export { createAuthenticator };
