// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { UserAgentComposer } from "../../src/useragent";

describe("UserAgentComposer", () => {
  it("initializes with local MCP agent string", () => {
    const sut = new UserAgentComposer("1.0.0");
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local)");
  });

  it("appends MCP client info once", () => {
    const sut = new UserAgentComposer("1.0.0");

    sut.appendMcpClientInfo({ name: "Jest", version: "0.0.1" });
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local) Jest/0.0.1");

    sut.appendMcpClientInfo({ name: "Node", version: "22.0.0" });
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local) Jest/0.0.1");
  });

  it("ignores incomplete MCP client info", () => {
    const sut = new UserAgentComposer("1.0.0");

    sut.appendMcpClientInfo(undefined);
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local)");

    sut.appendMcpClientInfo({ name: "", version: "" });
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local)");

    sut.appendMcpClientInfo({ name: "Node", version: "22.0.0" });
    expect(sut.userAgent).toBe("AzureDevOps.MCP/1.0.0 (local) Node/22.0.0");
  });
});
