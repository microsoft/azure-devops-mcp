// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { summarizeMcpMessage } from "../../src/logger";

describe("summarizeMcpMessage", () => {
  it("summarizes tool calls without logging full argument values", () => {
    const summary = summarizeMcpMessage({
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: {
        name: "repo_create_pull_request",
        arguments: {
          repositoryId: "repo-123",
          title: "Add request logging",
          description: "Sensitive details should not be logged verbatim",
        },
      },
    });

    expect(summary).toEqual({
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      name: "repo_create_pull_request",
      argumentKeys: ["description", "repositoryId", "title"],
    });
  });

  it("summarizes non-tool MCP requests with relevant metadata", () => {
    const summary = summarizeMcpMessage({
      jsonrpc: "2.0",
      id: "abc",
      method: "resources/read",
      params: {
        uri: "ado://work-items/123",
      },
    });

    expect(summary).toEqual({
      jsonrpc: "2.0",
      id: "abc",
      method: "resources/read",
      uri: "ado://work-items/123",
    });
  });
});
