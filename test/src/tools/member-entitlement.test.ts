// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureMemberEntitlementTools, MEMBER_ENTITLEMENT_TOOLS, memberEntitlementBaseUrl } from "../../../src/tools/member-entitlement";

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("memberEntitlementBaseUrl", () => {
  it("maps the cloud host to vsaex", () => {
    expect(memberEntitlementBaseUrl("https://dev.azure.com/contoso")).toBe("https://vsaex.dev.azure.com/contoso");
  });

  it("maps the legacy visualstudio.com host to vsaex", () => {
    expect(memberEntitlementBaseUrl("https://contoso.visualstudio.com")).toBe("https://contoso.vsaex.visualstudio.com");
  });

  it("falls back to the same host for on-prem", () => {
    expect(memberEntitlementBaseUrl("https://tfs.local/collection")).toBe("https://tfs.local/collection");
  });
});

describe("configureMemberEntitlementTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn(() => Promise.resolve("fake-token")) as TokenProviderMock;
    connectionProvider = jest.fn().mockResolvedValue({ serverUrl: "https://dev.azure.com/contoso" } as unknown as WebApi);
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function getHandler(toolName: string) {
    configureMemberEntitlementTools(server, tokenProvider, connectionProvider, () => "Jest");
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} not registered`);
    return call[3] as (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
  }

  function ok(bodyText: string, status = 200) {
    return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(bodyText) };
  }

  it("lists user entitlements against the vsaex host with filters", async () => {
    const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.list_users);
    mockFetch.mockResolvedValue(ok('{"members":[]}'));

    const result = await handler({ filter: "name eq 'jdoe@contoso.com'", select: "Projects" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://vsaex.dev.azure.com/contoso/_apis/userentitlements?");
    expect(url).toContain("api-version=7.1");
    expect(url).toContain("%24filter=name+eq+%27jdoe%40contoso.com%27");
    expect(url).toContain("select=Projects");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer fake-token");
    expect(result.content[0].text).toBe('{"members":[]}');
  });

  it("gets a user entitlement and surfaces 404 as an error", async () => {
    const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.get_user);
    mockFetch.mockResolvedValue(ok("", 404));

    const result = await handler({ userId: "abc-guid" });

    expect(mockFetch.mock.calls[0][0]).toBe("https://vsaex.dev.azure.com/contoso/_apis/userentitlements/abc-guid?api-version=7.1");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("adds a user with the advanced (Basic + Test Plans) license", async () => {
    const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.add_user);
    mockFetch.mockResolvedValue(ok('{"operationResult":{"isSuccess":true}}'));

    await handler({ principalName: "jdoe@contoso.com", accountLicenseType: "advanced" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://vsaex.dev.azure.com/contoso/_apis/userentitlements?api-version=7.1");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(init.body)).toEqual({
      accessLevel: { accountLicenseType: "advanced" },
      user: { principalName: "jdoe@contoso.com", subjectKind: "user" },
    });
  });

  it("updates a user's license with a JSON Patch document", async () => {
    const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.update_user_license);
    mockFetch.mockResolvedValue(ok('{"isSuccess":true}'));

    await handler({ userId: "abc-guid", accountLicenseType: "express" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://vsaex.dev.azure.com/contoso/_apis/userentitlements/abc-guid?api-version=7.1");
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/json-patch+json; charset=utf-8");
    expect(JSON.parse(init.body)).toEqual([{ op: "replace", path: "/accessLevel", value: { accountLicenseType: "express" } }]);
  });

  it("surfaces non-OK responses as errors", async () => {
    const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.add_user);
    mockFetch.mockResolvedValue(ok("forbidden", 403));

    const result = await handler({ principalName: "x@y.com", accountLicenseType: "express" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error adding user entitlement");
    expect(result.content[0].text).toContain("403");
  });

  describe("licences and group rules", () => {
    it("delete_user removes the user from the organization", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.delete_user);
      mockFetch.mockResolvedValue(ok("", 204));

      const result = await handler({ userId: "user-1" });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://vsaex.dev.azure.com/contoso/_apis/userentitlements/user-1?api-version=7.1");
      expect(init.method).toBe("DELETE");
      expect(result.content[0].text).toContain("removed from the organization");
    });

    it("delete_user reports an unknown user as an error", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.delete_user);
      mockFetch.mockResolvedValue(ok("", 404));

      const result = await handler({ userId: "nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("get_summary passes the select sections through", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.get_summary);
      mockFetch.mockResolvedValue(ok('{"licenses":[]}'));

      const result = await handler({ select: "AccessLevels,Licenses" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/_apis/userentitlementsummary?");
      expect(url).toContain("select=AccessLevels%2CLicenses");
      expect(result.content[0].text).toContain("licenses");
    });

    it("list_group_entitlements uses the preview api-version", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.list_group_entitlements);
      mockFetch.mockResolvedValue(ok('{"count":0,"value":[]}'));

      await handler({});

      expect(mockFetch.mock.calls[0][0]).toBe("https://vsaex.dev.azure.com/contoso/_apis/groupentitlements?api-version=7.2-preview.1");
    });

    it("get_group_entitlement reports a missing rule as an error", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.get_group_entitlement);
      mockFetch.mockResolvedValue(ok("", 404));

      const result = await handler({ groupId: "nope" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("update_group_license sends a JSON Patch and applies the rule", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.update_group_license);
      mockFetch.mockResolvedValue(ok('{"status":"queued"}'));

      await handler({ groupId: "g1", accountLicenseType: "stakeholder", testOnly: false });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain("ruleOption=applyGroupRule");
      expect(init.method).toBe("PATCH");
      expect(init.headers["Content-Type"]).toBe("application/json-patch+json; charset=utf-8");
      expect(JSON.parse(init.body)).toEqual([{ op: "replace", path: "/licenseRule", from: "", value: { accountLicenseType: "stakeholder", licensingSource: "account" } }]);
    });

    it("update_group_license can evaluate the rule without applying it", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.update_group_license);
      mockFetch.mockResolvedValue(ok("{}"));

      await handler({ groupId: "g1", accountLicenseType: "express", testOnly: true });

      expect(mockFetch.mock.calls[0][0]).toContain("ruleOption=testApplyGroupRule");
    });

    it("list_group_members pages with maxResults and a continuation token", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.list_group_members);
      mockFetch.mockResolvedValue(ok('{"members":[]}'));

      await handler({ groupId: "g1", maxResults: 50, continuationToken: "tok" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/_apis/groupentitlements/g1/members?");
      expect(url).toContain("api-version=7.2-preview.2");
      expect(url).toContain("maxResults=50");
      expect(url).toContain("continuationToken=tok");
    });

    it("add_group_member PUTs the membership", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.add_group_member);
      mockFetch.mockResolvedValue(ok("", 200));

      const result = await handler({ groupId: "g1", memberId: "user-1" });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://vsaex.dev.azure.com/contoso/_apis/groupentitlements/g1/members/user-1?api-version=7.2-preview.2");
      expect(init.method).toBe("PUT");
      expect(result.content[0].text).toContain("was added");
    });

    it("remove_group_member DELETEs the membership", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.remove_group_member);
      mockFetch.mockResolvedValue(ok("", 200));

      const result = await handler({ groupId: "g1", memberId: "user-1" });

      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
      expect(result.content[0].text).toContain("was removed");
    });

    it("surfaces API failures as error results", async () => {
      const handler = getHandler(MEMBER_ENTITLEMENT_TOOLS.list_group_entitlements);
      mockFetch.mockResolvedValue(ok("forbidden", 403));

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to list group entitlements (403)");
    });
  });
});
