// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readFileSync } from "fs";
import { join } from "path";

const SERVER_JSON = join(__dirname, "..", "..", "server.json");

describe("Official MCP Registry manifest", () => {
  const manifest = JSON.parse(readFileSync(SERVER_JSON, "utf8"));

  it("publishes the hosted server as a remote-only installation", () => {
    expect(manifest).toMatchObject({
      $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
      name: "com.microsoft/azure-devops",
      remotes: [
        {
          type: "streamable-http",
          url: "https://mcp.dev.azure.com",
        },
      ],
      repository: {
        url: "https://github.com/microsoft/azure-devops-mcp",
        source: "github",
      },
      websiteUrl: "https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server",
    });
    expect(manifest).not.toHaveProperty("packages");
  });

  it("uses a valid, current registry metadata version", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.version).not.toBe("2.4.0");
  });
});
