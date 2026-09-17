// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configurePermissionsTools, PERMISSIONS_TOOLS } from "../../../src/tools/permissions";

describe("configurePermissionsTools", () => {
  let server: McpServer;
  let tokenProvider: () => Promise<string>;
  let connectionProvider: () => Promise<WebApi>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as () => Promise<string>;
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" } as unknown as WebApi);
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configurePermissionsTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  const ok = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) });

  it("lists all security namespaces", async () => {
    const handler = getHandler(PERMISSIONS_TOOLS.list_security_namespaces);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({});

    expect(mockFetch.mock.calls[0][0]).toBe("https://dev.azure.com/contoso/_apis/securitynamespaces?api-version=7.1");
  });

  it("gets a single namespace by id", async () => {
    const handler = getHandler(PERMISSIONS_TOOLS.list_security_namespaces);
    mockFetch.mockResolvedValue(ok("[]"));

    await handler({ namespaceId: "ns-123", localOnly: true });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/_apis/securitynamespaces/ns-123?");
    expect(url).toContain("localOnly=true");
  });

  it("gets access control lists with token and descriptors", async () => {
    const handler = getHandler(PERMISSIONS_TOOLS.get_access_control_lists);
    mockFetch.mockResolvedValue(ok('{"value":[]}'));

    await handler({ namespaceId: "ns-123", token: "repoV2/abc", descriptors: "desc1", includeExtendedInfo: true });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/_apis/accesscontrollists/ns-123?");
    expect(url).toContain("token=repoV2%2Fabc");
    expect(url).toContain("descriptors=desc1");
    expect(url).toContain("includeExtendedInfo=true");
  });

  it("surfaces errors", async () => {
    const handler = getHandler(PERMISSIONS_TOOLS.get_access_control_lists);
    mockFetch.mockResolvedValue(ok("denied", 403));

    const result = await handler({ namespaceId: "ns-123" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching access control lists");
  });

  describe("writing ACLs", () => {
    const GIT = "2e9eb7ed-3c0a-47d4-87c1-0ffdd275fd87";
    const DESCRIPTOR = "Microsoft.TeamFoundation.Identity;S-1-9-1551374245-1";

    const lastCall = () => {
      const [url, init] = mockFetch.mock.calls[0] as [string, { method: string; body?: string }];
      return { url: new URL(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    };

    // Tokens contain "/" and can contain ",", so the check declares its own delimiter.
    it("query_my_permissions joins the tokens with a declared delimiter", async () => {
      mockFetch.mockResolvedValue(ok('{"value":[true,false]}'));

      const result = await getHandler(PERMISSIONS_TOOLS.query_my_permissions)({ namespaceId: GIT, permissions: 4, tokens: ["repoV2/p1/r1", "repoV2/p1/r2"], alwaysAllowAdministrators: false });

      const { url, method } = lastCall();
      expect(method).toBe("GET");
      expect(url.pathname).toBe(`/contoso/_apis/permissions/${GIT}/4`);
      expect(url.searchParams.get("tokens")).toBe("repoV2/p1/r1|repoV2/p1/r2");
      expect(url.searchParams.get("delimiter")).toBe("|");
      expect(result.content[0].text).toContain("true");
    });

    it("set_access_control_entries posts merged entries for the token", async () => {
      mockFetch.mockResolvedValue(ok("[]"));

      await getHandler(PERMISSIONS_TOOLS.set_access_control_entries)({
        namespaceId: GIT,
        token: "repoV2/p1",
        entries: [{ descriptor: DESCRIPTOR, allow: 2, deny: 0 }],
        merge: true,
      });

      const { url, method, body } = lastCall();
      expect(method).toBe("POST");
      expect(url.pathname).toBe(`/contoso/_apis/accesscontrolentries/${GIT}`);
      expect(body).toEqual({ token: "repoV2/p1", merge: true, accessControlEntries: [{ descriptor: DESCRIPTOR, allow: 2, deny: 0, extendedInfo: {} }] });
    });

    it("set_access_control_entries passes merge=false through for a replace", async () => {
      mockFetch.mockResolvedValue(ok("[]"));

      await getHandler(PERMISSIONS_TOOLS.set_access_control_entries)({ namespaceId: GIT, token: "t", entries: [{ descriptor: DESCRIPTOR, allow: 0, deny: 8 }], merge: false });

      expect(lastCall().body.merge).toBe(false);
    });

    it("remove_permission clears bits for one identity on one token", async () => {
      mockFetch.mockResolvedValue(ok("{}"));

      await getHandler(PERMISSIONS_TOOLS.remove_permission)({ namespaceId: GIT, permissions: 16, token: "repoV2/p1/r1", descriptor: DESCRIPTOR });

      const { url, method } = lastCall();
      expect(method).toBe("DELETE");
      expect(url.pathname).toBe(`/contoso/_apis/permissions/${GIT}/16`);
      expect(url.searchParams.get("token")).toBe("repoV2/p1/r1");
      expect(url.searchParams.get("descriptor")).toBe(DESCRIPTOR);
    });

    it("remove_access_control_entries sends the descriptors comma-separated", async () => {
      mockFetch.mockResolvedValue(ok("true"));

      await getHandler(PERMISSIONS_TOOLS.remove_access_control_entries)({ namespaceId: GIT, token: "repoV2/p1", descriptors: [DESCRIPTOR, "Microsoft.TeamFoundation.Identity;S-2"] });

      const { url, method } = lastCall();
      expect(method).toBe("DELETE");
      expect(url.pathname).toBe(`/contoso/_apis/accesscontrolentries/${GIT}`);
      expect(url.searchParams.get("descriptors")).toBe(`${DESCRIPTOR},Microsoft.TeamFoundation.Identity;S-2`);
    });

    it("remove_access_control_lists does not recurse unless asked", async () => {
      mockFetch.mockResolvedValue(ok("true"));

      await getHandler(PERMISSIONS_TOOLS.remove_access_control_lists)({ namespaceId: GIT, tokens: ["repoV2/p1/r1"], recurse: false });

      const { url, method } = lastCall();
      expect(method).toBe("DELETE");
      expect(url.pathname).toBe(`/contoso/_apis/accesscontrollists/${GIT}`);
      expect(url.searchParams.get("recurse")).toBe("false");
    });

    // A DELETE that succeeds with an empty body must not be mistaken for a failure.
    it("reports success on an empty response body", async () => {
      mockFetch.mockResolvedValue(ok(""));

      const result = await getHandler(PERMISSIONS_TOOLS.remove_permission)({ namespaceId: GIT, permissions: 1, token: "t", descriptor: DESCRIPTOR });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"ok":true');
    });

    it("surfaces a refused write with the status and message", async () => {
      mockFetch.mockResolvedValue(ok("TF400813: not authorized", 401));

      const result = await getHandler(PERMISSIONS_TOOLS.set_access_control_entries)({ namespaceId: GIT, token: "t", entries: [{ descriptor: DESCRIPTOR, allow: 1, deny: 0 }], merge: true });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("401");
      expect(result.content[0].text).toContain("TF400813");
    });
  });
});
