// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest } from "@jest/globals";
import { AzureDevOpsServerClient, AzureDevOpsServerError } from "../../../src/onprem/client";
import { resolveOnPremConfig } from "../../../src/onprem/config";
import { Transport, TransportRequest, TransportResponse } from "../../../src/onprem/transport";

function jsonResponse(status: number, body: unknown, contentType = "application/json; charset=utf-8"): TransportResponse {
  return { status, contentType, body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) };
}

function createClient(response: TransportResponse | Error) {
  const transport = jest.fn<Transport>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = new AzureDevOpsServerClient(resolveOnPremConfig({ serverUrl: "https://ado.contoso.com/tfs", collection: "DefaultCollection" }), transport, () => "UA/1.0");
  return { client, transport };
}

describe("AzureDevOpsServerClient", () => {
  it("builds collection-scoped URLs with the configured api-version and skips empty query values", async () => {
    const { client, transport } = createClient(jsonResponse(200, { value: [] }));
    await client.getJson("My%20Project/_apis/git/repositories", { "$top": 5, "searchCriteria.status": "active", "empty": "", "missing": undefined });

    const request = transport.mock.calls[0][0] as TransportRequest;
    expect(request.url).toBe("https://ado.contoso.com/tfs/DefaultCollection/My%20Project/_apis/git/repositories?%24top=5&searchCriteria.status=active&api-version=5.0");
    expect(request.accept).toBe("application/json");
    expect(request.userAgent).toBe("UA/1.0");
  });

  it("refuses absolute URLs and paths escaping the collection", () => {
    const { client } = createClient(jsonResponse(200, {}));
    expect(() => client.buildUrl("https://evil.example.com/_apis")).toThrow("Absolute URLs are not allowed");
    expect(() => client.buildUrl("//evil.example.com/_apis")).toThrow("Absolute URLs are not allowed");
    expect(() => client.buildUrl("../OtherCollection/_apis/projects")).toThrow("outside the configured Azure DevOps Server collection");
  });

  it("parses JSON with a BOM", async () => {
    const { client } = createClient(jsonResponse(200, '\uFEFF{"count":1}'));
    await expect(client.getJson("_apis/projects")).resolves.toEqual({ count: 1 });
  });

  it("surfaces Azure DevOps error messages with the HTTP status", async () => {
    const { client } = createClient(jsonResponse(404, { message: "TF401180: The requested pull request was not found.", typeName: "x" }));
    const error = (await client.getJson("_apis/git/pullRequests/1").catch((e) => e)) as AzureDevOpsServerError;
    expect(error).toBeInstanceOf(AzureDevOpsServerError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("HTTP 404 from Azure DevOps Server: TF401180: The requested pull request was not found.");
  });

  it("explains 401 and redirect failures without following them", async () => {
    await expect(createClient(jsonResponse(401, "", "text/html")).client.getJson("_apis/projects")).rejects.toThrow("signed-in Windows account");
    await expect(createClient(jsonResponse(302, "", "text/html")).client.getJson("_apis/projects")).rejects.toThrow("redirect from Azure DevOps Server was not followed");
  });

  it("rejects non-JSON success responses such as sign-in pages", async () => {
    await expect(createClient(jsonResponse(200, "<html></html>", "text/html")).client.getJson("_apis/projects")).rejects.toThrow("unexpected content type 'text/html'");
  });
});
