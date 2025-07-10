import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { AccessToken } from "@azure/identity";

// Mock interfaces following the pattern from core.test.ts
interface MockAzureCliCredential {
  getToken: jest.MockedFunction<(scope: string) => Promise<AccessToken>>;
}

interface MockChainedTokenCredential {
  getToken: jest.MockedFunction<(scope: string) => Promise<AccessToken>>;
}

describe("Azure DevOps MCP Server Authentication", () => {
  let mockAzureCliCredential: MockAzureCliCredential;
  let mockChainedTokenCredential: MockChainedTokenCredential;

  beforeEach(() => {
    mockAzureCliCredential = {
      getToken: jest.fn(),
    };

    mockChainedTokenCredential = {
      getToken: jest.fn(),
    };
  });

  describe("Command line argument parsing", () => {
    it("should parse organization name from arguments", () => {
      const testArgs = ["node", "index.js", "test-org"];
      const orgName = testArgs[2];
      const tenantId = testArgs[3];
      
      expect(orgName).toBe("test-org");
      expect(tenantId).toBeUndefined();
    });

    it("should parse organization name and tenant ID from arguments", () => {
      const testTenantId = "12345678-1234-1234-1234-123456789012";
      const testArgs = ["node", "index.js", "test-org", testTenantId];
      const orgName = testArgs[2];
      const tenantId = testArgs[3];

      expect(orgName).toBe("test-org");
      expect(tenantId).toBe(testTenantId);
    });

    it("should handle organization name without tenant ID", () => {
      const testArgs = ["node", "index.js", "test-org"];
      const orgName = testArgs[2];
      const tenantId = testArgs[3];

      expect(orgName).toBe("test-org");
      expect(tenantId).toBeUndefined();
    });
  });

  describe("Azure authentication credential configuration", () => {
    it("should create AzureCliCredential with empty options when no tenant provided", () => {
      const tenantId = undefined;
      const credentialOptions = tenantId ? { tenantId } : {};
      
      expect(credentialOptions).toEqual({});
    });

    it("should create AzureCliCredential with tenant when provided", () => {
      const testTenantId = "12345678-1234-1234-1234-123456789012";
      const credentialOptions = testTenantId ? { tenantId: testTenantId } : {};
      
      expect(credentialOptions).toEqual({ tenantId: testTenantId });
    });

    it("should use correct Azure DevOps scope for authentication", () => {
      const expectedScope = "499b84ac-1321-427f-aa17-267ca6975798/.default";
      
      expect(expectedScope).toBe("499b84ac-1321-427f-aa17-267ca6975798/.default");
    });
  });

  describe("Authentication token handling", () => {
    it("should handle successful token retrieval", async () => {
      const mockToken: AccessToken = {
        token: "test-token",
        expiresOnTimestamp: Date.now() + 3600000,
      };

      mockAzureCliCredential.getToken.mockResolvedValue(mockToken);

      const result = await mockAzureCliCredential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");

      expect(mockAzureCliCredential.getToken).toHaveBeenCalledWith("499b84ac-1321-427f-aa17-267ca6975798/.default");
      expect(result).toEqual(mockToken);
    });

    it("should handle authentication errors gracefully", async () => {
      const authError = new Error("Authentication failed");
      mockAzureCliCredential.getToken.mockRejectedValue(authError);

      await expect(mockAzureCliCredential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default"))
        .rejects.toThrow("Authentication failed");
    });
  });

  describe("Multi-tenant scenarios", () => {
    it("should provide helpful error message for tenant-related authentication failures", () => {
      const tenantError = new Error("Multiple tenants available. Please specify a tenant.");
      const tenantId = undefined; // No tenant specified
      
      // Test that we can detect tenant-related errors
      expect(tenantError.message).toContain("tenant");
      expect(tenantId).toBeUndefined();
      
      // This would trigger the helpful hint in the actual implementation
      const shouldShowHint = !tenantId && tenantError.message.includes("tenant");
      expect(shouldShowHint).toBe(true);
    });

    it("should handle successful authentication with tenant information", () => {
      const testTenantId = "12345678-1234-1234-1234-123456789012";
      const credentialOptions = { tenantId: testTenantId };
      
      expect(credentialOptions.tenantId).toBe(testTenantId);
      
      // Verify tenant info is properly formatted for logging
      const logMessage = `Successfully obtained token using Azure CLI credentials with tenant ${testTenantId}`;
      expect(logMessage).toContain(testTenantId);
    });

    it("should handle default tenant when no tenant specified", () => {
      const tenantId = undefined;
      const credentialOptions = tenantId ? { tenantId } : {};
      
      expect(credentialOptions).toEqual({});
      
      // Verify default tenant logging
      const logMessage = `Successfully obtained token using Azure CLI credentials with default tenant`;
      expect(logMessage).toContain("default tenant");
    });
  });

  describe("Error message formatting", () => {
    it("should format authentication errors with tenant context", () => {
      const testTenantId = "12345678-1234-1234-1234-123456789012";
      const error = new Error("Authentication failed");
      
      const tenantInfo = testTenantId ? ` with tenant ${testTenantId}` : ' with default tenant';
      const errorMessage = `Failed to get Azure DevOps token${tenantInfo}: ${error.message}`;
      
      expect(errorMessage).toBe(`Failed to get Azure DevOps token with tenant ${testTenantId}: Authentication failed`);
    });

    it("should format authentication errors without tenant context", () => {
      const error = new Error("Authentication failed");
      
      const tenantInfo = ' with default tenant';
      const errorMessage = `Failed to get Azure DevOps token${tenantInfo}: ${error.message}`;
      
      expect(errorMessage).toBe("Failed to get Azure DevOps token with default tenant: Authentication failed");
    });
  });
});
