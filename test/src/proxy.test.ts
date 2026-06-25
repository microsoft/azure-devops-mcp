// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";

const mockSetGlobalDispatcher = jest.fn();
const mockEnvHttpProxyAgent = jest.fn();

jest.mock("undici", () => ({
  setGlobalDispatcher: mockSetGlobalDispatcher,
  EnvHttpProxyAgent: mockEnvHttpProxyAgent,
}));

import { configureProxyDispatcher } from "../../src/proxy";

describe("configureProxyDispatcher", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    mockSetGlobalDispatcher.mockClear();
    mockEnvHttpProxyAgent.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false and does not install dispatcher when no proxy env var is set", () => {
    expect(configureProxyDispatcher()).toBe(false);
    expect(mockSetGlobalDispatcher).not.toHaveBeenCalled();
    expect(mockEnvHttpProxyAgent).not.toHaveBeenCalled();
  });

  it("installs dispatcher when HTTPS_PROXY is set", () => {
    process.env.HTTPS_PROXY = "http://proxy.corp:8080";

    expect(configureProxyDispatcher()).toBe(true);
    expect(mockEnvHttpProxyAgent).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("installs dispatcher when lowercase https_proxy is set", () => {
    process.env.https_proxy = "http://proxy.corp:8080";

    expect(configureProxyDispatcher()).toBe(true);
    expect(mockSetGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("installs dispatcher when HTTP_PROXY is set", () => {
    process.env.HTTP_PROXY = "http://proxy.corp:8080";

    expect(configureProxyDispatcher()).toBe(true);
    expect(mockSetGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("installs dispatcher when lowercase http_proxy is set", () => {
    process.env.http_proxy = "http://proxy.corp:8080";

    expect(configureProxyDispatcher()).toBe(true);
    expect(mockSetGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("treats an empty HTTPS_PROXY as unset and falls through to other vars", () => {
    process.env.HTTPS_PROXY = "";
    process.env.http_proxy = "http://proxy.corp:8080";

    expect(configureProxyDispatcher()).toBe(true);
    expect(mockSetGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("returns false when all proxy env vars are empty strings", () => {
    process.env.HTTPS_PROXY = "";
    process.env.https_proxy = "";
    process.env.HTTP_PROXY = "";
    process.env.http_proxy = "";

    expect(configureProxyDispatcher()).toBe(false);
    expect(mockSetGlobalDispatcher).not.toHaveBeenCalled();
  });
});
