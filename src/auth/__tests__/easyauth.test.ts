// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { parseClientPrincipal } from "../easyauth.js";

function mockRequest(headerValue: string | undefined): { headers: Record<string, string | undefined> } {
  return {
    headers: { "x-ms-client-principal": headerValue },
  };
}

describe("parseClientPrincipal", () => {
  it("returns empty object when header is missing", () => {
    const req = mockRequest(undefined);
    expect(parseClientPrincipal(req as never)).toEqual({});
  });

  it("returns empty object when header is empty string", () => {
    const req = mockRequest("");
    expect(parseClientPrincipal(req as never)).toEqual({});
  });

  it("returns empty object when header is not base64 JSON", () => {
    const req = mockRequest("not-valid-base64!!!");
    expect(parseClientPrincipal(req as never)).toEqual({});
  });

  it("extracts email from claims array (emailaddress claim type)", () => {
    const payload = {
      claims: [
        { typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", val: "user@example.com" },
        { typ: "name", val: "Test User" },
      ],
    };
    const req = mockRequest(Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"));
    const result = parseClientPrincipal(req as never);
    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("Test User");
  });

  it("extracts email from preferred_username claim", () => {
    const payload = {
      claims: [
        { typ: "preferred_username", val: "alice@contoso.com" },
      ],
    };
    const req = mockRequest(Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"));
    const result = parseClientPrincipal(req as never);
    expect(result.email).toBe("alice@contoso.com");
  });

  it("extracts email from userDetails when present", () => {
    const payload = { userDetails: "bob@contoso.com" };
    const req = mockRequest(Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"));
    const result = parseClientPrincipal(req as never);
    expect(result.email).toBe("bob@contoso.com");
  });
});
