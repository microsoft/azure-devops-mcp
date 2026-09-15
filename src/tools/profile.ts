// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";

const PROFILE_TOOLS = {
  get_me: "profile_get_me",
};

function configureProfileTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  registerTool(
    server,
    PROFILE_TOOLS.get_me,
    "Get the identity of the currently authenticated user (id, descriptor, display name) and the organization this server is connected to. Use it to resolve 'me'/'my'/'I' in a request before calling tools that take an identity, instead of guessing who the caller is.",
    {},
    async () => {
      try {
        const connection = await connectionProvider();
        // ConnectionData carries the identity behind the current token, so this
        // works for every authentication mode (PAT, bearer pass-through, OAuth).
        const connectionData = await connection.connect();

        if (!connectionData?.authenticatedUser) {
          return { content: [{ type: "text", text: "Could not resolve the authenticated user from the connection data." }], isError: true };
        }

        const result = {
          authenticatedUser: connectionData.authenticatedUser,
          authorizedUser: connectionData.authorizedUser,
          serverUrl: connection.serverUrl,
          deploymentType: connectionData.deploymentType,
          instanceId: connectionData.instanceId,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching the authenticated user: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { PROFILE_TOOLS, configureProfileTools };
