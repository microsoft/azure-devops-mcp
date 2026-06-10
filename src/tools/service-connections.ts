// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { AadLoginPromptOption, OAuthConfigurationActionFilter, ServiceEndpointActionFilter } from "azure-devops-node-api/interfaces/ServiceEndpointInterfaces.js";
import { z } from "zod";
import { getEnumKeys, mapStringToEnum } from "../utils.js";

const SERVICE_CONNECTION_TOOLS = {
  list_service_connections: "service_connections_list",
  get_service_connection_details: "service_connections_get_details",
  list_by_type_and_owner: "service_connections_list_by_type_and_owner",
  list_with_refreshed_authentication: "service_connections_refresh_authentication",
  create_service_connection: "service_connections_create",
  update_service_connection: "service_connections_update",
  update_service_connections: "service_connections_update_many",
  delete_service_connection: "service_connections_delete",
  share_service_connection: "service_connections_share",
  share_endpoint_with_project: "service_connections_share_with_project",
  query_shared_projects: "service_connections_query_shared_projects",
  list_execution_records: "service_connections_list_execution_records",
  add_execution_records: "service_connections_add_execution_records",
  execute_request: "service_connections_execute_request",
  query: "service_connections_query",
  list_types: "service_connections_list_types",
  list_filtered_types: "service_connections_list_filtered_types",
  list_azure_subscriptions: "service_connections_list_azure_subscriptions",
  list_azure_management_groups: "service_connections_list_azure_management_groups",
  get_aad_tenant_id: "service_connections_get_aad_tenant_id",
  create_aad_oauth_request: "service_connections_create_aad_oauth_request",
  oauth_create: "service_connections_oauth_create",
  oauth_update: "service_connections_oauth_update",
  oauth_delete: "service_connections_oauth_delete",
  oauth_get: "service_connections_oauth_get",
  oauth_list: "service_connections_oauth_list",
};

const passthroughObject = z.record(z.unknown());

function configureServiceConnectionTools(server: McpServer, _tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  server.tool(
    SERVICE_CONNECTION_TOOLS.list_service_connections,
    "List service connections (service endpoints) in an Azure DevOps project. Supports filtering by type, authorization scheme, owner, endpoint IDs, and endpoint names. Secret/credential fields are never returned by the API.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      type: z.string().optional().describe("Filter by service connection type (e.g., 'azurerm', 'github', 'dockerregistry')."),
      authSchemes: z.array(z.string()).optional().describe("Filter by authorization schemes (e.g., 'ServicePrincipal', 'WorkloadIdentityFederation', 'PersonalAccessToken')."),
      endpointIds: z.array(z.string()).optional().describe("Filter by specific service endpoint IDs (GUIDs)."),
      endpointNames: z.array(z.string()).optional().describe("Filter by service endpoint names. When provided, uses the get-by-names API."),
      owner: z.string().optional().describe("Filter by owner of the service connection."),
      includeFailed: z.boolean().optional().describe("Whether to include service connections with failed authentication."),
      actionFilter: z
        .enum(getEnumKeys(ServiceEndpointActionFilter) as [string, ...string[]])
        .optional()
        .describe("Filter endpoints by the action the caller is allowed to perform: 'None', 'Manage', 'Use', or 'View'."),
    },
    async ({ project, type, authSchemes, endpointIds, endpointNames, owner, includeFailed, actionFilter }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const endpoints =
          endpointNames && endpointNames.length > 0
            ? await api.getServiceEndpointsByNames(project, endpointNames, type, authSchemes, owner, includeFailed, false)
            : await api.getServiceEndpoints(project, type, authSchemes, endpointIds, owner, includeFailed, false, mapStringToEnum(actionFilter, ServiceEndpointActionFilter));

        if (!endpoints || endpoints.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No service connections found.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(endpoints, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing service connections: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.get_service_connection_details,
    "Get details of a specific service connection (service endpoint) by its ID within a project. Secret/credential fields are never returned by the API.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      endpointId: z.string().describe("The GUID of the service connection (service endpoint)."),
      actionFilter: z
        .enum(getEnumKeys(ServiceEndpointActionFilter) as [string, ...string[]])
        .optional()
        .describe("Filter by the action the caller is allowed to perform: 'None', 'Manage', 'Use', or 'View'."),
    },
    async ({ project, endpointId, actionFilter }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const endpoint = await api.getServiceEndpointDetails(project, endpointId, mapStringToEnum(actionFilter, ServiceEndpointActionFilter));

        if (!endpoint) {
          return {
            content: [
              {
                type: "text",
                text: `Service connection '${endpointId}' not found in project '${project}'.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(endpoint, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting service connection details: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.list_by_type_and_owner,
    "Get organization-scoped service connections by type and owner. Returns only id, name, and url (used internally by licensing).",
    {
      type: z.string().describe("Type of the service connections (e.g., 'azurerm')."),
      owner: z.string().describe("Owner of the service connections."),
    },
    async ({ type, owner }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const endpoints = await api.getServiceEndpointsByTypeAndOwner(type, owner);

        if (!endpoints || endpoints.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No service connections found.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(endpoints, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing service connections by type and owner: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.list_with_refreshed_authentication,
    "Get service connections with refreshed authentication parameters (e.g., short-lived OAuth tokens).",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      endpointIds: z.array(z.string()).describe("IDs of the service connections to refresh."),
      refreshAuthenticationParameters: z
        .array(
          z.object({
            endpointId: z.string().optional().describe("Endpoint ID which needs new authentication params."),
            scope: z.array(z.number()).optional().describe("Scope of the token requested."),
            tokenValidityInMinutes: z.number().optional().describe("Requested validity window for the token in minutes."),
          })
        )
        .describe("Per-endpoint refresh parameters."),
    },
    async ({ project, endpointIds, refreshAuthenticationParameters }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const endpoints = await api.getServiceEndpointsWithRefreshedAuthentication(refreshAuthenticationParameters, project, endpointIds);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(endpoints, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error refreshing service connection authentication: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.create_service_connection,
    "Create a new service connection (service endpoint). The 'endpoint' body must match the ServiceEndpoint schema for the target type and include authorization fields.",
    {
      endpoint: passthroughObject.describe("Full ServiceEndpoint payload (name, type, url, authorization, serviceEndpointProjectReferences, etc.)."),
    },
    async ({ endpoint }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const created = await api.createServiceEndpoint(endpoint as never);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating service connection: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.update_service_connection,
    "Update an existing service connection (service endpoint).",
    {
      endpointId: z.string().describe("ID of the service connection to update."),
      endpoint: passthroughObject.describe("Updated ServiceEndpoint payload."),
      operation: z.string().optional().describe("Optional operation type (e.g., 'rename')."),
    },
    async ({ endpointId, endpoint, operation }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const updated = await api.updateServiceEndpoint(endpoint as never, endpointId, operation);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating service connection: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.update_service_connections,
    "Update multiple service connections in a single call.",
    {
      endpoints: z.array(passthroughObject).describe("Array of ServiceEndpoint payloads to update."),
    },
    async ({ endpoints }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const updated = await api.updateServiceEndpoints(endpoints as never);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating service connections: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.delete_service_connection,
    "Delete a service connection from one or more projects.",
    {
      endpointId: z.string().describe("ID of the service connection to delete."),
      projectIds: z.array(z.string()).describe("Project IDs from which the service connection should be deleted."),
      deep: z.boolean().optional().describe("If true, also delete the underlying service principal (where applicable)."),
    },
    async ({ endpointId, projectIds, deep }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        await api.deleteServiceEndpoint(endpointId, projectIds, deep);
        return {
          content: [
            {
              type: "text",
              text: `Service connection '${endpointId}' deleted from project(s): ${projectIds.join(", ")}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting service connection: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.share_service_connection,
    "Share a service connection across one or more projects using project references.",
    {
      endpointId: z.string().describe("ID of the service connection to share."),
      endpointProjectReferences: z
        .array(
          z
            .object({
              name: z.string().optional().describe("Name to give the connection in the target project."),
              description: z.string().optional().describe("Description for the shared connection."),
              projectReference: z.object({ id: z.string().optional(), name: z.string().optional() }).passthrough().optional().describe("Reference to the target project (id and/or name)."),
            })
            .passthrough()
        )
        .describe("Target project references."),
    },
    async ({ endpointId, endpointProjectReferences }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        await api.shareServiceEndpoint(endpointProjectReferences as never, endpointId);
        return {
          content: [
            {
              type: "text",
              text: `Service connection '${endpointId}' shared with ${endpointProjectReferences.length} project(s).`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sharing service connection: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.share_endpoint_with_project,
    "Share a service connection from one project with another project.",
    {
      endpointId: z.string().describe("ID of the service connection to share."),
      fromProject: z.string().describe("Source project (id or name) currently owning the connection."),
      withProject: z.string().describe("Target project (id or name) to share the connection with."),
    },
    async ({ endpointId, fromProject, withProject }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        await api.shareEndpointWithProject(endpointId, fromProject, withProject);
        return {
          content: [
            {
              type: "text",
              text: `Service connection '${endpointId}' shared from '${fromProject}' with '${withProject}'.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sharing service connection with project: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.query_shared_projects,
    "List the projects a service connection is shared with.",
    {
      endpointId: z.string().describe("ID of the service connection."),
      project: z.string().describe("Source project (id or name) owning the connection."),
    },
    async ({ endpointId, project }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const projects = await api.querySharedProjects(endpointId, project);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying shared projects: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.list_execution_records,
    "Get execution records for a service connection (paginated).",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      endpointId: z.string().describe("ID of the service connection."),
      top: z.coerce.number().optional().describe("Maximum number of execution records to return."),
      continuationToken: z.coerce.number().optional().describe("Continuation token from a previous call."),
    },
    async ({ project, endpointId, top, continuationToken }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const records = await api.getServiceEndpointExecutionRecords(project, endpointId, top, continuationToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(records, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing service connection execution records: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.add_execution_records,
    "Add execution records for one or more service connections.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      input: z
        .object({
          endpointIds: z.array(z.string()).optional().describe("IDs of the service connections to attribute the execution to."),
          data: passthroughObject.optional().describe("ServiceEndpointExecutionData payload (planId, definitionId, result, etc.)."),
        })
        .passthrough()
        .describe("ServiceEndpointExecutionRecordsInput payload."),
    },
    async ({ project, input }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const records = await api.addServiceEndpointExecutionRecords(input as never, project);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(records, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding service connection execution records: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.execute_request,
    "Proxy a GET request through a service connection. The request is authorized using the connection's credentials.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      endpointId: z.string().describe("ID of the service connection."),
      serviceEndpointRequest: passthroughObject.describe("ServiceEndpointRequest payload (dataSourceDetails, resultTransformationDetails, serviceEndpointDetails)."),
    },
    async ({ project, endpointId, serviceEndpointRequest }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const result = await api.executeServiceEndpointRequest(serviceEndpointRequest as never, project, endpointId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing service connection request: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.query,
    "Proxy a GET defined by a data source binding on a service connection. The response is filtered via XPath/JSON selector.",
    {
      project: z.string().describe("The name or ID of the Azure DevOps project."),
      binding: passthroughObject.describe("DataSourceBinding payload (target, endpointId, dataSourceName, parameters, etc.)."),
    },
    async ({ project, binding }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const result = await api.queryServiceEndpoint(binding as never, project);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying service connection: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.list_types,
    "Get available service connection (endpoint) types.",
    {
      type: z.string().optional().describe("Optional type filter (e.g., 'azurerm')."),
      scheme: z.string().optional().describe("Optional authentication scheme filter."),
    },
    async ({ type, scheme }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const types = await api.getServiceEndpointTypes(type, scheme);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(types, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing service connection types: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.list_filtered_types,
    "Get service connection types filtered to a specific list of type names.",
    {
      typesFilter: z.array(z.string()).describe("Type names to include."),
    },
    async ({ typesFilter }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const types = await api.getFilteredServiceEndpointTypes(typesFilter);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(types, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing filtered service connection types: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(SERVICE_CONNECTION_TOOLS.list_azure_subscriptions, "List Azure subscriptions discoverable by the organization for use in Azure-based service connections.", {}, async () => {
    try {
      const api = await (await connectionProvider()).getServiceEndpointApi();
      const result = await api.getAzureSubscriptions();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing Azure subscriptions: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.tool(SERVICE_CONNECTION_TOOLS.list_azure_management_groups, "List Azure management groups discoverable by the organization.", {}, async () => {
    try {
      const api = await (await connectionProvider()).getServiceEndpointApi();
      const result = await api.getAzureManagementGroups();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing Azure management groups: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.tool(SERVICE_CONNECTION_TOOLS.get_aad_tenant_id, "Get the AAD tenant ID associated with the organization.", {}, async () => {
    try {
      const api = await (await connectionProvider()).getServiceEndpointApi();
      const tenantId = await api.getVstsAadTenantId();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tenantId }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting AAD tenant ID: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.tool(
    SERVICE_CONNECTION_TOOLS.create_aad_oauth_request,
    "Create an AAD OAuth authorization request URL for use during service connection setup.",
    {
      tenantId: z.string().describe("AAD tenant ID."),
      redirectUri: z.string().describe("Redirect URI for the OAuth flow."),
      promptOption: z
        .enum(getEnumKeys(AadLoginPromptOption) as [string, ...string[]])
        .optional()
        .describe("Login prompt option: 'NoOption', 'Login', 'SelectAccount', 'FreshLogin', or 'FreshLoginWithMfa'."),
      completeCallbackPayload: z.string().optional().describe("Optional callback payload to round-trip through the OAuth flow."),
      completeCallbackByAuthCode: z.boolean().optional().describe("If true, the callback completes by auth code instead of token."),
    },
    async ({ tenantId, redirectUri, promptOption, completeCallbackPayload, completeCallbackByAuthCode }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const url = await api.createAadOAuthRequest(tenantId, redirectUri, mapStringToEnum(promptOption, AadLoginPromptOption), completeCallbackPayload, completeCallbackByAuthCode);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ url }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating AAD OAuth request: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // OAuth configuration tools (organization-scoped)

  const oauthConfigurationParamsSchema = z
    .object({
      clientId: z.string().describe("OAuth client ID."),
      clientSecret: z.string().describe("OAuth client secret."),
      endpointType: z.string().describe("Endpoint type the configuration is for (e.g., 'github')."),
      name: z.string().describe("Display name of the OAuth configuration."),
      url: z.string().optional().describe("Authorization URL."),
    })
    .passthrough();

  server.tool(
    SERVICE_CONNECTION_TOOLS.oauth_create,
    "Create a new OAuth configuration (organization-scoped).",
    {
      configurationParams: oauthConfigurationParamsSchema.describe("OAuthConfigurationParams payload."),
    },
    async ({ configurationParams }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const created = await api.createOAuthConfiguration(configurationParams as never);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating OAuth configuration: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.oauth_update,
    "Update an existing OAuth configuration.",
    {
      configurationId: z.string().describe("ID of the OAuth configuration to update."),
      configurationParams: oauthConfigurationParamsSchema.describe("Updated OAuthConfigurationParams payload."),
    },
    async ({ configurationId, configurationParams }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const updated = await api.updateOAuthConfiguration(configurationParams as never, configurationId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating OAuth configuration: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.oauth_delete,
    "Delete an OAuth configuration.",
    {
      configurationId: z.string().describe("ID of the OAuth configuration to delete."),
    },
    async ({ configurationId }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const deleted = await api.deleteOAuthConfiguration(configurationId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(deleted, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting OAuth configuration: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.oauth_get,
    "Get an OAuth configuration by ID.",
    {
      configurationId: z.string().describe("ID of the OAuth configuration."),
    },
    async ({ configurationId }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const configuration = await api.getOAuthConfiguration(configurationId);

        if (!configuration) {
          return {
            content: [
              {
                type: "text",
                text: `OAuth configuration '${configurationId}' not found.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(configuration, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting OAuth configuration: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    SERVICE_CONNECTION_TOOLS.oauth_list,
    "List OAuth configurations, optionally filtered by endpoint type and/or action filter.",
    {
      endpointType: z.string().optional().describe("Filter by endpoint type (e.g., 'github')."),
      actionFilter: z
        .enum(getEnumKeys(OAuthConfigurationActionFilter) as [string, ...string[]])
        .optional()
        .describe("Action filter: 'None', 'Manage', or 'Use'."),
    },
    async ({ endpointType, actionFilter }) => {
      try {
        const api = await (await connectionProvider()).getServiceEndpointApi();
        const configurations = await api.getOAuthConfigurations(endpointType, mapStringToEnum(actionFilter, OAuthConfigurationActionFilter));

        if (!configurations || configurations.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No OAuth configurations found.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(configurations, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing OAuth configurations: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { SERVICE_CONNECTION_TOOLS, configureServiceConnectionTools };
