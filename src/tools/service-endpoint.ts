// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { adoFetch } from "../shared/ado-rest.js";
import { requiredProject } from "../shared/common-params.js";

const SERVICE_ENDPOINT_TOOLS = {
  list_service_endpoints: "serviceendpoint_list_service_endpoints",
  get_service_endpoint: "serviceendpoint_get_service_endpoint",
  create_service_endpoint: "serviceendpoint_create_service_endpoint",
  delete_service_endpoint: "serviceendpoint_delete_service_endpoint",
};

const serviceEndpointApiVersion = "7.1-preview.4";

function configureServiceEndpointTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  async function request(method: string, pathAndQuery: string, body?: unknown): Promise<Response> {
    const connection = await connectionProvider();
    const token = await tokenProvider();
    const baseUrl = connection.serverUrl.replace(/\/$/, "");
    return adoFetch({ url: `${baseUrl}/${pathAndQuery}`, method, token, userAgent: userAgentProvider(), body });
  }

  registerTool(
    server,
    SERVICE_ENDPOINT_TOOLS.list_service_endpoints,
    "List service connections (service endpoints) in a project, e.g. connections to Azure, GitHub, Docker registries, or other services used by pipelines.",
    {
      project: requiredProject,
      type: z.string().optional().describe("Filter by endpoint type, e.g. 'azurerm', 'github', 'dockerregistry'."),
      includeFailed: z.boolean().optional().describe("Include endpoints that failed to be created/authorized."),
    },
    async ({ project, type, includeFailed }) => {
      try {
        const params = new URLSearchParams({ "api-version": serviceEndpointApiVersion });
        if (type) params.append("type", type);
        if (includeFailed !== undefined) params.append("includeFailed", String(includeFailed));

        const response = await request("GET", `${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to list service endpoints (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error listing service endpoints: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    SERVICE_ENDPOINT_TOOLS.get_service_endpoint,
    "Get a single service connection (service endpoint) by its ID within a project.",
    {
      project: requiredProject,
      endpointId: z.string().describe("The ID (GUID) of the service endpoint."),
    },
    async ({ project, endpointId }) => {
      try {
        const response = await request("GET", `${encodeURIComponent(project)}/_apis/serviceendpoint/endpoints/${encodeURIComponent(endpointId)}?api-version=${serviceEndpointApiVersion}`);
        if (response.status === 404) {
          return { content: [{ type: "text", text: `Service endpoint '${endpointId}' not found` }], isError: true };
        }
        if (!response.ok) {
          throw new Error(`Failed to get service endpoint (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching service endpoint: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    SERVICE_ENDPOINT_TOOLS.create_service_endpoint,
    "Create a service connection (service endpoint). The endpoint object is passed through to the REST API; it must include name, type, url, authorization, and serviceEndpointProjectReferences (project scoping). See the Azure DevOps 'Endpoints - Create' REST API for the schema of each connection type.",
    {
      endpoint: z.record(z.unknown()).describe("The full service endpoint definition object (name, type, url, authorization, serviceEndpointProjectReferences, ...)."),
    },
    async ({ endpoint }) => {
      try {
        const response = await request("POST", `_apis/serviceendpoint/endpoints?api-version=${serviceEndpointApiVersion}`, endpoint);
        if (!response.ok) {
          throw new Error(`Failed to create service endpoint (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: await response.text() }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error creating service endpoint: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    SERVICE_ENDPOINT_TOOLS.delete_service_endpoint,
    "Delete a service connection (service endpoint) from the given projects. This is a destructive operation.",
    {
      endpointId: z.string().describe("The ID (GUID) of the service endpoint to delete."),
      projectIds: z.array(z.string()).min(1).describe("The IDs (GUIDs) of the projects from which to remove the endpoint."),
    },
    async ({ endpointId, projectIds }) => {
      try {
        const params = new URLSearchParams({ "api-version": serviceEndpointApiVersion, "projectIds": projectIds.join(",") });
        const response = await request("DELETE", `_apis/serviceendpoint/endpoints/${encodeURIComponent(endpointId)}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to delete service endpoint (${response.status}): ${await response.text()}`);
        }

        return { content: [{ type: "text", text: `Service endpoint '${endpointId}' deleted from project(s): ${projectIds.join(", ")}.` }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error deleting service endpoint: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { SERVICE_ENDPOINT_TOOLS, configureServiceEndpointTools };
