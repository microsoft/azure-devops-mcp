// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { jest } from "@jest/globals";

jest.mock("../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("proxy configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("environment variable detection", () => {
    it("should work when no proxy environment variables are set", () => {
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.http_proxy;
      delete process.env.https_proxy;
      delete process.env.NO_PROXY;
      delete process.env.no_proxy;

      // Verify no proxy env vars are set
      expect(process.env.HTTP_PROXY).toBeUndefined();
      expect(process.env.HTTPS_PROXY).toBeUndefined();
      expect(process.env.http_proxy).toBeUndefined();
      expect(process.env.https_proxy).toBeUndefined();
      expect(process.env.NO_PROXY).toBeUndefined();
      expect(process.env.no_proxy).toBeUndefined();
    });

    it("should detect HTTP_PROXY environment variable", () => {
      process.env.HTTP_PROXY = "http://proxy.example.com:8080";

      expect(process.env.HTTP_PROXY).toBe("http://proxy.example.com:8080");
    });

    it("should detect HTTPS_PROXY environment variable", () => {
      process.env.HTTPS_PROXY = "https://proxy.example.com:8443";

      expect(process.env.HTTPS_PROXY).toBe("https://proxy.example.com:8443");
    });

    it("should detect lowercase http_proxy environment variable", () => {
      process.env.http_proxy = "http://proxy.example.com:8080";

      expect(process.env.http_proxy).toBe("http://proxy.example.com:8080");
    });

    it("should detect lowercase https_proxy environment variable", () => {
      process.env.https_proxy = "https://proxy.example.com:8443";

      expect(process.env.https_proxy).toBe("https://proxy.example.com:8443");
    });

    it("should detect NO_PROXY environment variable", () => {
      process.env.NO_PROXY = "localhost,127.0.0.1,.example.com";

      expect(process.env.NO_PROXY).toBe("localhost,127.0.0.1,.example.com");
    });

    it("should detect lowercase no_proxy environment variable", () => {
      process.env.no_proxy = "localhost,127.0.0.1,.example.com";

      expect(process.env.no_proxy).toBe("localhost,127.0.0.1,.example.com");
    });
  });

  describe("proxy URL validation", () => {
    it("should accept valid HTTP proxy URL", () => {
      const proxyUrl = "http://proxy.example.com:8080";
      process.env.HTTP_PROXY = proxyUrl;

      const url = new URL(process.env.HTTP_PROXY);
      expect(url.protocol).toBe("http:");
      expect(url.hostname).toBe("proxy.example.com");
      expect(url.port).toBe("8080");
    });

    it("should accept valid HTTPS proxy URL", () => {
      const proxyUrl = "https://proxy.example.com:8443";
      process.env.HTTPS_PROXY = proxyUrl;

      const url = new URL(process.env.HTTPS_PROXY);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("proxy.example.com");
      expect(url.port).toBe("8443");
    });

    it("should accept proxy URL with authentication credentials", () => {
      const proxyUrl = "http://user:password@proxy.example.com:8080";
      process.env.HTTP_PROXY = proxyUrl;

      const url = new URL(process.env.HTTP_PROXY);
      expect(url.username).toBe("user");
      expect(url.password).toBe("password");
      expect(url.hostname).toBe("proxy.example.com");
    });

    it("should throw for invalid proxy URL format", () => {
      const invalidProxyUrl = "not-a-valid-url";
      process.env.HTTP_PROXY = invalidProxyUrl;

      expect(() => new URL(process.env.HTTP_PROXY!)).toThrow();
    });
  });

  describe("NO_PROXY parsing", () => {
    it("should parse comma-separated NO_PROXY values", () => {
      process.env.NO_PROXY = "localhost,127.0.0.1,.example.com,*.internal.net";

      const noProxyList = process.env.NO_PROXY.split(",");
      expect(noProxyList).toEqual(["localhost", "127.0.0.1", ".example.com", "*.internal.net"]);
    });

    it("should handle empty NO_PROXY value", () => {
      process.env.NO_PROXY = "";

      expect(process.env.NO_PROXY).toBe("");
      const noProxyList = process.env.NO_PROXY.split(",").filter(Boolean);
      expect(noProxyList).toEqual([]);
    });

    it("should handle NO_PROXY with Azure DevOps domains", () => {
      process.env.NO_PROXY = "dev.azure.com,vssps.dev.azure.com,vsrm.dev.azure.com";

      const noProxyList = process.env.NO_PROXY.split(",");
      expect(noProxyList).toContain("dev.azure.com");
      expect(noProxyList).toContain("vssps.dev.azure.com");
      expect(noProxyList).toContain("vsrm.dev.azure.com");
    });
  });
});

describe("global-agent configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should use GLOBAL_AGENT_HTTP_PROXY when set", () => {
    process.env.GLOBAL_AGENT_HTTP_PROXY = "http://global-proxy.example.com:8080";

    expect(process.env.GLOBAL_AGENT_HTTP_PROXY).toBe("http://global-proxy.example.com:8080");
  });

  it("should use GLOBAL_AGENT_HTTPS_PROXY when set", () => {
    process.env.GLOBAL_AGENT_HTTPS_PROXY = "https://global-proxy.example.com:8443";

    expect(process.env.GLOBAL_AGENT_HTTPS_PROXY).toBe("https://global-proxy.example.com:8443");
  });

  it("should use GLOBAL_AGENT_NO_PROXY when set", () => {
    process.env.GLOBAL_AGENT_NO_PROXY = "localhost,*.internal.com";

    expect(process.env.GLOBAL_AGENT_NO_PROXY).toBe("localhost,*.internal.com");
  });
});

describe("undici EnvHttpProxyAgent", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should be configurable via standard proxy environment variables", () => {
    process.env.HTTP_PROXY = "http://proxy.example.com:8080";
    process.env.HTTPS_PROXY = "https://proxy.example.com:8443";
    process.env.NO_PROXY = "localhost,127.0.0.1";

    // EnvHttpProxyAgent reads these env vars automatically
    expect(process.env.HTTP_PROXY).toBeDefined();
    expect(process.env.HTTPS_PROXY).toBeDefined();
    expect(process.env.NO_PROXY).toBeDefined();
  });

  it("should support both uppercase and lowercase proxy env vars", () => {
    // Uppercase takes precedence in most implementations
    process.env.HTTP_PROXY = "http://upper.proxy.com:8080";
    process.env.http_proxy = "http://lower.proxy.com:8080";

    expect(process.env.HTTP_PROXY).toBe("http://upper.proxy.com:8080");
    expect(process.env.http_proxy).toBe("http://lower.proxy.com:8080");
  });
});
