// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { DEFAULT_ONPREM_API_VERSION, resolveOnPremConfig } from "../../../src/onprem/config";

describe("resolveOnPremConfig", () => {
  it("builds the collection URL from the server root and collection name with 2019-compatible defaults", () => {
    expect(resolveOnPremConfig({ serverUrl: "https://ado.contoso.com/", collection: "DefaultCollection" })).toEqual({
      collectionUrl: "https://ado.contoso.com/DefaultCollection",
      collection: "DefaultCollection",
      authentication: "windows",
      apiVersion: DEFAULT_ONPREM_API_VERSION,
    });
    expect(DEFAULT_ONPREM_API_VERSION).toBe("5.0");
  });

  it("preserves a virtual directory such as /tfs and encodes the collection", () => {
    const config = resolveOnPremConfig({ serverUrl: "https://ado.contoso.com/tfs///", collection: "My Collection", authentication: "pat", apiVersion: "5.1" });
    expect(config.collectionUrl).toBe("https://ado.contoso.com/tfs/My%20Collection");
    expect(config.authentication).toBe("pat");
    expect(config.apiVersion).toBe("5.1");
  });

  it.each([
    [{ serverUrl: "not a url", collection: "c" }, "Invalid --server-url"],
    [{ serverUrl: "ftp://server", collection: "c" }, "Unsupported --server-url protocol"],
    [{ serverUrl: "https://user:secret@server", collection: "c" }, "must not contain credentials"],
    [{ serverUrl: "https://server?x=1", collection: "c" }, "query string"],
    [{ serverUrl: "https://server", collection: "a/b" }, "Invalid collection name"],
    [{ serverUrl: "https://server", collection: ".." }, "Invalid collection name"],
    [{ serverUrl: "https://server", collection: "c", authentication: "interactive" }, "not supported with --server-url"],
    [{ serverUrl: "https://server", collection: "c", apiVersion: "latest" }, "Invalid --api-version"],
  ])("rejects invalid input %#", (input, message) => {
    expect(() => resolveOnPremConfig(input)).toThrow(message);
  });

  it("accepts preview api versions", () => {
    expect(resolveOnPremConfig({ serverUrl: "http://server", collection: "c", apiVersion: "5.0-preview.1" }).apiVersion).toBe("5.0-preview.1");
  });
});
