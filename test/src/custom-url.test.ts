// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { WebApi } from "azure-devops-node-api";
import { searchIdentities } from "../../src/tools/auth";
import { setConfig } from "../../src/config";
import { setApiVersions, apiVersion } from "../../src/utils";

describe("Custom URL and API Versioning", () => {
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let userAgentProvider: () => string;
  let mockConnection: WebApi;

  beforeEach(() => {
    tokenProvider = jest.fn() as any;
    userAgentProvider = () => "Jest";
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Reset config to default
    setConfig("", "", false);
    setApiVersions("7.2-preview.1");
  });

  it("should use custom URL for identities when isCustomUrl is true", async () => {
    const customUrl = "https://tfs.contoso.com/tfs/DefaultCollection";
    setConfig("contoso", customUrl, true);

    mockConnection = {
      serverUrl: customUrl,
    } as WebApi;
    connectionProvider = jest.fn().mockResolvedValue(mockConnection) as any;
    (tokenProvider as any).mockResolvedValue("fake-token");

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ value: [] }),
    });

    await searchIdentities("john.doe", tokenProvider, connectionProvider, userAgentProvider);

    // Should NOT use vssps.dev.azure.com
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`${customUrl}/_apis/identities`), expect.any(Object));
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("vssps.dev.azure.com"), expect.any(Object));
  });

  it("should use default vssps URL for identities when isCustomUrl is false", async () => {
    const defaultUrl = "https://dev.azure.com/test-org";
    setConfig("test-org", defaultUrl, false);

    mockConnection = {
      serverUrl: defaultUrl,
    } as WebApi;
    connectionProvider = jest.fn().mockResolvedValue(mockConnection) as any;
    (tokenProvider as any).mockResolvedValue("fake-token");

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ value: [] }),
    });

    await searchIdentities("john.doe", tokenProvider, connectionProvider, userAgentProvider);

    // Should use vssps.dev.azure.com
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("https://vssps.dev.azure.com/test-org/_apis/identities"), expect.any(Object));
  });

  it("should update apiVersion when setApiVersions is called", () => {
    const newVersion = "6.0";
    setApiVersions(newVersion);
    expect(apiVersion).toBe(newVersion);
  });
});
