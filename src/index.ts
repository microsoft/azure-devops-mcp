#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";
import { PRESET_NAMES, resolvePreset } from "./shared/presets.js";
import { buildServerInstructions } from "./shared/server-instructions.js";
import { getRequestToken, startHttpServer } from "./transports/http.js";
import { startOAuthHttpServer } from "./transports/http-oauth.js";
import { EntraOAuthProvider } from "./shared/oauth/entra-oauth-provider.js";
import { OAuthStateStore } from "./shared/oauth/state-store.js";
import { TableOAuthStateStore } from "./shared/oauth/table-state-store.js";
import { DefaultAzureCredential } from "@azure/identity";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name",
      type: "string",
      demandOption: true,
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
    choices: ["interactive", "azcli", "env", "envvar", "pat"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("transport", {
    describe:
      "Transport to serve the MCP server over. 'stdio' (default) runs locally over stdin/stdout. 'http' serves a Streamable HTTP endpoint using token pass-through (each request must carry an Azure DevOps bearer token).",
    type: "string",
    choices: ["stdio", "http"],
    default: "stdio",
  })
  .option("auth", {
    describe:
      "Authentication mode for the 'http' transport. 'passthrough' (default) requires each request to carry an Azure DevOps bearer token. 'oauth' runs a full OAuth authorization server bridging sign-in to Microsoft Entra ID (requires ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, MCP_PUBLIC_URL).",
    type: "string",
    choices: ["passthrough", "oauth"],
    default: "passthrough",
  })
  .option("host", {
    describe: "Host/interface to bind when using the 'http' transport. Defaults to 127.0.0.1 (loopback only); expose externally via a reverse proxy.",
    type: "string",
    default: "127.0.0.1",
  })
  .option("port", {
    describe: "Port to listen on when using the 'http' transport.",
    type: "number",
    default: 3000,
  })
  .option("path", {
    describe: "URL path that serves the MCP endpoint when using the 'http' transport.",
    type: "string",
    default: "/mcp",
  })
  .option("allowed-hosts", {
    describe:
      "Hosts permitted in the Host header (DNS rebinding protection) for the 'http' transport. Defaults to the bound host/port plus localhost. Set this to your public hostname when running behind a reverse proxy.",
    type: "string",
    array: true,
  })
  .option("allowed-origins", {
    describe: "Origins permitted in the Origin header for the 'http' transport. By default only requests without an Origin (non-browser clients) are accepted.",
    type: "string",
    array: true,
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;
const orgUrl = "https://dev.azure.com/" + orgName;

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, authType: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    // For pat, accessToken is base64("{email}:{token}"). Decode to extract the token part,
    // since getPersonalAccessTokenHandler prepends ":" internally and just needs the raw token.
    const authHandler = authType === "pat" ? getPersonalAccessTokenHandler(Buffer.from(accessToken, "base64").toString("utf8").split(":").slice(1).join(":")) : getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

function createConfiguredServer(
  authenticator: () => Promise<string>,
  connectionProvider: () => Promise<WebApi>,
  userAgentComposer: UserAgentComposer,
  domains: Set<string> = enabledDomains,
  presetName?: string
): McpServer {
  const server = new McpServer(
    {
      name: "Azure DevOps MCP Server",
      version: packageVersion,
      icons: [
        {
          src: "https://cdn.vsassets.io/content/icons/favicon.ico",
        },
      ],
    },
    {
      // Clients hand this to the model together with the tool list. It is the
      // only place the server can explain its own shape, and it costs a
      // fraction of what the tool schemas do — see server-instructions.ts.
      instructions: buildServerInstructions(domains, { organization: orgName, preset: presetName }),
    }
  );

  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  instrumentToolErrors(server);

  // removing prompts untill further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, connectionProvider, () => userAgentComposer.userAgent, domains);

  return server;
}

// Wrap tool registration so every handler logs its failures server-side. MCP
// clients may render a returned `isError` result as a generic message (hiding
// the text we put in it), and our per-tool catch blocks only return the error,
// never log it — so without this the real Azure DevOps exception never reaches
// the container logs. Here we record both thrown exceptions and isError results
// (with the tool name) to stderr -> Log Analytics for tracing. No tokens or
// request bodies are touched.
function instrumentToolErrors(server: McpServer): void {
  const originalTool = server.tool.bind(server) as (...args: unknown[]) => unknown;

  const wrapped = (...args: unknown[]): unknown => {
    const toolName = typeof args[0] === "string" ? (args[0] as string) : "unknown";
    const cbIndex = args.length - 1;
    const callback = args[cbIndex];

    if (typeof callback === "function") {
      const original = callback as (...cbArgs: unknown[]) => unknown;
      args[cbIndex] = async (...cbArgs: unknown[]): Promise<unknown> => {
        try {
          const result = await original(...cbArgs);
          const r = result as { isError?: boolean; content?: { text?: string }[] } | undefined;
          if (r?.isError) {
            const detail = (r.content ?? [])
              .map((c) => c?.text)
              .filter(Boolean)
              .join(" ");
            logger.error("Tool returned error result", { tool: toolName, detail });
          }
          return result;
        } catch (error) {
          logger.error("Tool threw", { tool: toolName, error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
          throw error;
        }
      };
    }

    return originalTool(...args);
  };

  (server as unknown as { tool: (...args: unknown[]) => unknown }).tool = wrapped;
}

/**
 * Builds the store for the OAuth server's own state (client registrations,
 * pending authorizations, issued codes).
 *
 * With OAUTH_STATE_TABLE_ENDPOINT set, the state lives in Azure Table Storage
 * and survives restarts, so a deploy no longer invalidates every client's
 * registration and grant. Authentication uses the workload's managed identity
 * (AZURE_CLIENT_ID selects it when several are assigned) — no storage key.
 *
 * Without it the state stays in memory: fine for a single local process,
 * lossy for a deployed server, hence the warning.
 */
function createOAuthStateStore(): OAuthStateStore | undefined {
  const tableEndpoint = process.env.OAUTH_STATE_TABLE_ENDPOINT;
  if (!tableEndpoint) {
    logger.warn("OAuth state is kept in memory; a restart invalidates client registrations and issued grants. Set OAUTH_STATE_TABLE_ENDPOINT to persist it.");
    return undefined;
  }

  const tableName = process.env.OAUTH_STATE_TABLE_NAME || "oauthstate";
  const managedIdentityClientId = process.env.AZURE_CLIENT_ID;
  logger.info("OAuth state persisted in Azure Table Storage", { tableEndpoint, tableName, managedIdentityClientId });

  return new TableOAuthStateStore(tableEndpoint, tableName, new DefaultAzureCredential(managedIdentityClientId ? { managedIdentityClientId } : {}));
}

async function runHttpTransport(userAgentComposer: UserAgentComposer) {
  // In both HTTP auth modes the Azure DevOps bearer token is resolved per-request
  // from the in-flight context (token pass-through), so no credential is stored.
  const authenticator = () => Promise.resolve(getRequestToken());
  const connectionProvider = getAzureDevOpsClient(authenticator, userAgentComposer, "bearer");

  // A preset narrows the tool list for this one request. The transport is
  // stateless, so the choice can live in the URL path and nothing is shared
  // between callers; `undefined` means the endpoint's configured --domains.
  const createServer = (preset?: string) => {
    if (!preset) {
      return createConfiguredServer(authenticator, connectionProvider, userAgentComposer);
    }
    const domains = resolvePreset(preset);
    if (!domains) {
      throw new Error(`Unknown tool preset '${preset}'. Available presets: ${PRESET_NAMES.join(", ")}.`);
    }
    return createConfiguredServer(authenticator, connectionProvider, userAgentComposer, domains, preset);
  };

  const allowedHosts = argv.allowedHosts && argv.allowedHosts.length > 0 ? argv.allowedHosts : [`${argv.host}:${argv.port}`, `localhost:${argv.port}`, `127.0.0.1:${argv.port}`];

  if (argv.auth === "oauth") {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;
    const publicBaseUrl = process.env.MCP_PUBLIC_URL;
    if (!tenantId || !clientId || !clientSecret || !publicBaseUrl) {
      throw new Error("OAuth mode requires ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, and MCP_PUBLIC_URL environment variables.");
    }

    const provider = new EntraOAuthProvider({ tenantId, clientId, clientSecret, publicBaseUrl }, { stateStore: createOAuthStateStore() });
    logger.info("HTTP transport using OAuth (Entra ID bridge). Clients authenticate via browser sign-in; the '--authentication' option is ignored.");

    await startOAuthHttpServer({
      host: argv.host,
      port: argv.port,
      mcpPath: argv.path,
      publicBaseUrl,
      allowedHosts,
      allowedOrigins: argv.allowedOrigins,
      provider,
      createServer,
    });
    return;
  }

  logger.info("HTTP transport uses token pass-through; the '--authentication' option is ignored. Each request must supply an Azure DevOps bearer token in the 'Authorization' header.");

  await startHttpServer({
    host: argv.host,
    port: argv.port,
    mcpPath: argv.path,
    allowedHosts,
    allowedOrigins: argv.allowedOrigins,
    createServer,
  });
}

async function runStdioTransport(userAgentComposer: UserAgentComposer) {
  const tenantId = (await getOrgTenant(orgName)) ?? argv.tenant;
  const authenticator = createAuthenticator(argv.authentication, tenantId);

  if (argv.authentication === "pat") {
    const basicValue = await authenticator();
    // basicValue is already base64("{email}:{token}") — use it directly in the Authorization header
    const _originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.headers) {
        const headers = new Headers(init.headers as HeadersInit);
        if (headers.get("Authorization")?.startsWith("Bearer ")) {
          headers.set("Authorization", `Basic ${basicValue}`);
          init = { ...init, headers };
        }
      }
      return _originalFetch(input, init);
    };
    logger.debug("PAT mode: global fetch interceptor installed to rewrite Bearer -> Basic auth headers");
  }

  const server = createConfiguredServer(authenticator, getAzureDevOpsClient(authenticator, userAgentComposer, argv.authentication), userAgentComposer);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main() {
  logger.info("Starting Azure DevOps MCP Server", {
    organization: orgName,
    organizationUrl: orgUrl,
    transport: argv.transport,
    authentication: argv.authentication,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);

  if (argv.transport === "http") {
    await runHttpTransport(userAgentComposer);
  } else {
    await runStdioTransport(userAgentComposer);
  }
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
