// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export class WebServer {
  private app;
  private mcpTransport;

  constructor(mcpTransport: StreamableHTTPServerTransport, app: express.Application = express()) {
    this.app = app;
    this.app.use(express.json());
    this.mcpTransport = mcpTransport;

    this.app.post("/mcp", async (req: Request, res: Response) => {
      console.log("Received MCP request:", req.body);
      try {
        this.mcpTransport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    this.app.get("/mcp", (req: Request, res: Response) => {
      res.status(405).json({ error: "Method not allowed" });
    });

    this.app.delete("/mcp", (req: Request, res: Response) => {
      res.status(405).json({ error: "Method not allowed" });
    });
  }

  async start() {
    const port = process.env.MCP_HTTP_PORT || 8080;
    this.app.listen(port, () => {
      console.log(`WebServer listening on port ${port}`);
    });
  }

  getApp() {
    return this.app;
  }
}
