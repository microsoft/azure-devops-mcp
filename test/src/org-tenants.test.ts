// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { jest } from "@jest/globals";
import fs, { readFile, writeFile } from "fs/promises";
import { getOrgTenant } from "../../src/org-tenants";

jest.mock("fs/promises");
jest.mock("../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

type FetchMock = jest.Mock<typeof fetch>;

describe("getOrgTenant", () => {
  const orgName = "testorg";
  let mockFetch: FetchMock;
  let mockReadFile: jest.SpiedFunction<typeof readFile>;
  let mockWriteFile: jest.SpiedFunction<typeof writeFile>;

  beforeEach(() => {
    mockFetch = jest.fn() as FetchMock;
    global.fetch = mockFetch;

    mockReadFile = jest.spyOn(fs, "readFile");
    mockWriteFile = jest.spyOn(fs, "writeFile");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should return tenant from cache when entry is valid and not expired", async () => {
    const cachedTenantId = "cached-tenant-guid";
    const cacheData = {
      [orgName]: {
        tenantId: cachedTenantId,
        refreshedOn: Date.now() - 1000, // 1 second ago, not expired
      },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(cacheData));

    const result = await getOrgTenant(orgName);

    expect(result).toBe(cachedTenantId);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should fetch from API when cache is broken and saves the result", async () => {
    const fetchedTenantId = "fetched-tenant-guid";
    mockReadFile.mockRejectedValue(new Error("Cache file corrupted"));
    mockFetch.mockResolvedValue({
      status: 404,
      headers: {
        get: () => {
          return fetchedTenantId;
        },
      },
    } as unknown as Response);

    const result = await getOrgTenant(orgName);

    expect(result).toBe(fetchedTenantId);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("returns fetched tenant despite failure to save cache", async () => {
    const fetchedTenantId = "fetched-tenant-guid";
    mockReadFile.mockResolvedValue("{}");
    mockFetch.mockResolvedValue({
      status: 404,
      headers: {
        get: () => {
          return fetchedTenantId;
        },
      },
    } as unknown as Response);
    mockWriteFile.mockRejectedValue(new Error("Disk full"));

    const result = await getOrgTenant(orgName);

    expect(result).toBe(fetchedTenantId);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("should return undefined when cache is empty and fetch fails", async () => {
    mockReadFile.mockResolvedValue("{}");
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await getOrgTenant(orgName);

    expect(result).toBeUndefined();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("should fetch from API when cache is empty and cache the successful result", async () => {
    const fetchedTenantId = "fresh-tenant-guid";
    mockReadFile.mockResolvedValue("{}");
    mockFetch.mockResolvedValue({
      status: 404,
      headers: {
        get: () => {
          return fetchedTenantId;
        },
      },
    } as unknown as Response);

    const result = await getOrgTenant(orgName);

    expect(result).toBe(fetchedTenantId);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("should return undefined when fetch from API fails", async () => {
    mockReadFile.mockResolvedValue("{}");
    mockFetch.mockResolvedValue({
      status: 500,
    } as unknown as Response);

    const result = await getOrgTenant(orgName);

    expect(result).toBe(undefined);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).toHaveBeenCalledTimes(0);
  });

  it("should return undefined when fetch from API has no tenant ID in the headers", async () => {
    mockReadFile.mockResolvedValue("{}");
    mockFetch.mockResolvedValue({
      status: 404,
      headers: {
        get: () => {
          return undefined;
        },
      },
    } as unknown as Response);

    const result = await getOrgTenant(orgName);

    expect(result).toBe(undefined);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).toHaveBeenCalledTimes(0);
  });

  it("should use expired cache entry as fallback when fresh fetch fails", async () => {
    const expiredTenantId = "expired-tenant-guid";
    const expiredCacheData = {
      [orgName]: {
        tenantId: expiredTenantId,
        refreshedOn: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago, expired
      },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(expiredCacheData));
    mockFetch.mockRejectedValue(new Error("API unavailable"));

    const result = await getOrgTenant(orgName);

    expect(result).toBe(expiredTenantId);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`https://vssps.dev.azure.com/${orgName}`, { method: "HEAD" });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
