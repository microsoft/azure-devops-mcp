// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as azdev from "azure-devops-node-api";
import { createAuthenticator } from "./auth.js";
import { getOrgTenant } from "./org-tenants.js";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

/**
 * Configuration for HTTP Server
 */
export interface HttpServerConfig {
  port: number;
  orgName: string;
  authenticationType: string;
  tenantId?: string;
  domains: string | string[];
}

/**
 * HTTP Server for MCP over HTTP/SSE
 */
export class McpHttpServer {
  private app: Express;
  private mcpServer: McpServer;
  private config: HttpServerConfig;
  private userAgentComposer: UserAgentComposer;
  private authenticator!: () => Promise<string>;
  private domainsManager: DomainsManager;

  constructor(config: HttpServerConfig) {
    this.config = config;
    this.app = express();
    this.mcpServer = new McpServer({
      name: "Azure DevOps MCP Server (HTTP)",
      version: packageVersion,
    });
    this.userAgentComposer = new UserAgentComposer(packageVersion);
    this.domainsManager = new DomainsManager(config.domains);

    this.setupMiddleware();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: "*", // En production, restreindre aux domaines autorisés
        credentials: true,
      })
    );

    // Body parser
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        version: packageVersion,
        organization: this.config.orgName,
      });
    });

    // MCP Discovery endpoint
    this.app.get("/mcp/discovery", async (req: Request, res: Response) => {
      try {
        // Return server capabilities
        res.json({
          name: "Azure DevOps MCP Server",
          version: packageVersion,
          description: "MCP server for interacting with Azure DevOps",
          organization: this.config.orgName,
          capabilities: {
            tools: true,
            prompts: true,
            resources: false,
          },
          protocolVersion: "2024-11-05",
        });
      } catch (error) {
        console.error("Error in discovery:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // MCP Initialize endpoint
    this.app.post("/mcp/initialize", async (req: Request, res: Response) => {
      try {
        const { protocolVersion, capabilities, clientInfo } = req.body;

        console.log("Client initializing:", clientInfo);

        res.json({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            prompts: {},
          },
          serverInfo: {
            name: "Azure DevOps MCP Server",
            version: packageVersion,
          },
        });
      } catch (error) {
        console.error("Error in initialize:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // MCP Tools List endpoint
    this.app.get("/mcp/tools/list", async (req: Request, res: Response) => {
      try {
        // Return placeholder - tools are managed by MCP server internally
        // In a full implementation, we would need to extract tool definitions
        res.json({
          tools: [],
          _note: "Tools are registered with MCP server and callable via /mcp/tools/call",
        });
      } catch (error) {
        console.error("Error listing tools:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // MCP Tool Call endpoint
    this.app.post("/mcp/tools/call", async (req: Request, res: Response) => {
      try {
        const { name, arguments: args } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Tool name is required" });
        }

        console.log(`Calling tool: ${name} with args:`, args);

        // Call the tool (this will be handled by the MCP server)
        // For now, return a placeholder
        res.json({
          content: [
            {
              type: "text",
              text: `Tool ${name} called successfully (implementation pending)`,
            },
          ],
        });
      } catch (error) {
        console.error("Error calling tool:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // MCP Prompts List endpoint
    this.app.get("/mcp/prompts/list", async (req: Request, res: Response) => {
      try {
        // Return placeholder - prompts are managed by MCP server internally
        res.json({
          prompts: [],
          _note: "Prompts are registered with MCP server and callable via MCP protocol",
        });
      } catch (error) {
        console.error("Error listing prompts:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // OAuth endpoints (to be implemented in Phase 1)
    this.app.get("/oauth/authorize", (req: Request, res: Response) => {
      // Redirect to Azure AD authorization endpoint
      res.status(501).json({
        error: "OAuth not yet implemented",
        message: "This endpoint will redirect to Azure AD for authentication",
      });
    });

    this.app.get("/oauth/callback", (req: Request, res: Response) => {
      // Handle OAuth callback from Azure AD
      res.status(501).json({
        error: "OAuth not yet implemented",
        message: "This endpoint will handle the OAuth callback",
      });
    });

    this.app.post("/oauth/token", (req: Request, res: Response) => {
      // Exchange authorization code for access token
      res.status(501).json({
        error: "OAuth not yet implemented",
        message: "This endpoint will exchange code for token",
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not found",
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error("Unhandled error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err.message,
      });
    });
  }

  /**
   * Get Azure DevOps client
   */
  private getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>): () => Promise<azdev.WebApi> {
    const orgUrl = "https://dev.azure.com/" + this.config.orgName;

    return async () => {
      const accessToken = await getAzureDevOpsToken();
      const authHandler = azdev.getBearerHandler(accessToken);
      const connection = new azdev.WebApi(orgUrl, authHandler, undefined, {
        productName: "AzureDevOps.MCP",
        productVersion: packageVersion,
        userAgent: this.userAgentComposer.userAgent,
      });
      return connection;
    };
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    // Setup MCP server initialized callback
    this.mcpServer.server.oninitialized = () => {
      this.userAgentComposer.appendMcpClientInfo(this.mcpServer.server.getClientVersion());
    };

    // Get tenant ID
    const tenantId = (await getOrgTenant(this.config.orgName)) ?? this.config.tenantId;

    // Create authenticator
    this.authenticator = createAuthenticator(this.config.authenticationType, tenantId);

    // Configure prompts
    configurePrompts(this.mcpServer);

    // Configure tools
    const enabledDomains = this.domainsManager.getEnabledDomains();
    configureAllTools(this.mcpServer, this.authenticator, this.getAzureDevOpsClient(this.authenticator), () => this.userAgentComposer.userAgent, enabledDomains);

    // Setup routes
    this.setupRoutes();

    console.log("✅ MCP HTTP Server initialized successfully");
    console.log(`📋 Organization: ${this.config.orgName}`);
    console.log(`🔐 Authentication: ${this.config.authenticationType}`);
    console.log(`🌐 Enabled domains: ${Array.from(enabledDomains).join(", ")}`);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.initialize();

    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log(`\n🚀 MCP HTTP Server listening on port ${this.config.port}`);
        console.log(`\n📍 Endpoints:`);
        console.log(`   Health:      http://localhost:${this.config.port}/health`);
        console.log(`   Discovery:   http://localhost:${this.config.port}/mcp/discovery`);
        console.log(`   Tools List:  http://localhost:${this.config.port}/mcp/tools/list`);
        console.log(`   Prompts List: http://localhost:${this.config.port}/mcp/prompts/list`);
        console.log(`\n✨ Server ready to accept connections!\n`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Close MCP server connections if any
    console.log("Stopping MCP HTTP Server...");
  }
}

/**
 * Create and start HTTP server
 */
export async function createHttpServer(config: HttpServerConfig): Promise<McpHttpServer> {
  const server = new McpHttpServer(config);
  await server.start();
  return server;
}
