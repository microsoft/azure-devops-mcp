#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { getBearerHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import cors from "cors";
import { randomUUID } from "crypto";

import { createAuthenticator } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 [organization] [options]")
  .version(packageVersion)
  .command("$0 [organization]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
      demandOption: false,
    });
  })
  .option("domains", {
    alias: "d",
    describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar"],
    default: defaultAuthenticationType,
  })
  .option("token", {
    alias: "k",
    describe: "Azure DevOps Personal Access Token (PAT)",
    type: "string",
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("transport", {
    alias: "tr",
    describe: "Transport to use",
    type: "string",
    choices: ["stdio", "http"],
    default: "stdio",
  })
  .option("port", {
    alias: "p",
    describe: "Port to listen on (for http transport)",
    type: "number",
    default: 3000,
    nargs: 1,
  })
  .option("allowed-origins", {
    describe: "Allowed origins for CORS (for http transport). Defaults to restricted. Use '*' to allow all (not recommended for production).",
    type: "string",
    array: true,
  })
  .help()
  .parseSync();

const defaultOrgName = argv.organization as string | undefined;
const allowedOrigins = argv["allowed-origins"] as string[] | undefined;

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, orgUrl: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  const userAgentComposer = new UserAgentComposer(packageVersion);

  const createServerInstance = async (config: { organization: string; authentication: string; token?: string; tenant?: string; domains: string[] }) => {
    const orgUrl = "https://dev.azure.com/" + config.organization;
    const domainsManager = new DomainsManager(config.domains);
    const enabledDomains = domainsManager.getEnabledDomains();

    const tenantId = config.tenant ?? (await getOrgTenant(config.organization));

    // If a token is provided directly via CLI or header, use it.
    let authenticator;
    if (config.token) {
      const tokenValue = config.token;
      authenticator = async () => tokenValue;
    } else {
      authenticator = createAuthenticator(config.authentication, tenantId);
    }

    const server = new McpServer({
      name: "Azure DevOps MCP Server",
      version: packageVersion,
      icons: [
        {
          src: "https://cdn.vsassets.io/content/icons/favicon.ico",
        },
      ],
    });

    server.server.oninitialized = () => {
      userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
    };

    configureAllTools(
      server,
      authenticator,
      getAzureDevOpsClient(() => authenticator(), userAgentComposer, orgUrl),
      () => userAgentComposer.userAgent,
      enabledDomains,
      config.organization
    );
    return server;
  };

  logger.info("Starting Azure DevOps MCP Server", {
    defaultOrganization: defaultOrgName,
    defaultAuthentication: argv.authentication,
    defaultTenant: argv.tenant,
    defaultDomains: argv.domains,
    transport: argv.transport,
    port: argv.port,
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

  if (argv.transport === "stdio") {
    if (!defaultOrgName) {
      console.error("\nError: Organization name is required for stdio transport.");
      console.error("Usage: npx @azure-devops/mcp <organization>\n");
      process.exit(1);
    }
    const server = await createServerInstance({
      organization: defaultOrgName,
      authentication: argv.authentication as string,
      token: argv.token as string,
      tenant: argv.tenant,
      domains: argv.domains as string[],
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    const app = createMcpExpressApp();

    if (allowedOrigins) {
      app.use(cors({ origin: allowedOrigins.includes("*") ? true : allowedOrigins }));
    } else {
      app.use(cors());
    }

    const transports = new Map<string, StreamableHTTPServerTransport>();

    app.all("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        // Extract configuration from headers or fallback to CLI defaults
        const organization = (req.headers["x-ado-organization"] as string) ?? defaultOrgName;
        const authentication = (req.headers["x-ado-authentication"] as string) ?? (argv.authentication as string);
        const token = (req.headers["x-ado-token"] as string) ?? (argv.token as string);
        const tenant = (req.headers["x-ado-tenant"] as string) ?? argv.tenant;
        const domainsHeader = req.headers["x-ado-domains"] as string;
        const domains = domainsHeader ? domainsHeader.split(",").map((d) => d.trim()) : (argv.domains as string[]);

        if (!organization) {
          logger.error("Organization name is required. Provide it via CLI or x-ado-organization header.");
          res.status(400).send("Organization name is required. Provide it via x-ado-organization header.");
          return;
        }

        logger.info(`Creating new session`, {
          organization,
          authentication,
          hasToken: !!token,
          tenant,
          domains,
        });

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            logger.info(`Session initialized: ${id}`);
            if (transport) {
              transports.set(id, transport);
            }
          },
        });

        try {
          const server = await createServerInstance({
            organization,
            authentication,
            token,
            tenant,
            domains,
          });
          await server.connect(transport);

          transport.onclose = () => {
            logger.info(`Transport closed for session ${transport?.sessionId}`);
            if (transport?.sessionId) {
              transports.delete(transport.sessionId);
            }
          };
        } catch (error) {
          logger.error("Failed to create server instance for session", error);
          if (!res.headersSent) {
            res.status(500).send("Failed to initialize MCP session");
          }
          return;
        }
      }

      await transport.handleRequest(req, res, (req as any).body);
    });

    const port = argv.port as number;
    app.listen(port, () => {
      logger.info(`Azure DevOps MCP Server running on http://localhost:${port}/mcp`);
    });
  }
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
