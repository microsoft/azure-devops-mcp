// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { orgName } from "../index.js";

interface ClassificationNode {
  name: string;
  children?: ClassificationNode[];
}

interface IterationNode {
  id: number;
  name: string;
  path: string;
  structureType: string;
  hasChildren: boolean;
  attributes?: Record<string, string>;
  url: string;
  children?: IterationNode[];
}

interface IterationResult {
  status: "success" | "error";
  iteration: string;
  message: string;
  data?: {
    id: number;
    name: string;
    path: string;
    parentPath?: string;
    attributes?: Record<string, string>;
  };
}

interface IterationRequestBody {
  name: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
  };
}

const AREAPATH_TOOLS = {
  list_project_area_paths: "list_project_area_paths",
  create_area_path: "create_area_path",
  area_suggest_for_workitem: "area_suggest_for_workitem",
  classification_manage_iterations: "classification_manage_iterations",
};

function configureAreaPathTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    AREAPATH_TOOLS.list_project_area_paths,
    "Get all area paths for a project in Azure DevOps",
    {
      project: z.string().describe("Project name or ID"),
      depth: z.number().default(2).describe("Maximum depth of area path hierarchy to retrieve. Defaults to 2."),
    },
    async ({ project, depth }) => {
      try {
        const accessToken = await tokenProvider();
        
        // Use the Work Item Tracking REST API to get classification nodes
        const url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes?$depth=${depth}&api-version=7.0`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [{ 
              type: "text", 
              text: `Error fetching classification nodes: ${response.status} ${response.statusText} - ${errorText}` 
            }],
            isError: true,
          };
        }

        const data = await response.json();
        
        // Extract area paths from the hierarchical structure
        const areaPaths: string[] = [];
        const iterationPaths: string[] = [];
        
        function extractPaths(node: ClassificationNode, parentPath = "", nodeType = "Area") {
          const currentPath = parentPath ? `${parentPath}\\${node.name}` : node.name;
          
          // Add current path if it's not the root project node
          if (parentPath) {
            if (nodeType === "Area") {
              areaPaths.push(currentPath);
            } else if (nodeType === "Iteration") {
              iterationPaths.push(currentPath);
            }
          }
          
          // Recursively process children
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              extractPaths(child, currentPath, nodeType);
            }
          }
        }
        
        // Process both Area and Iteration classification nodes
        if (data.value && Array.isArray(data.value)) {
          for (const rootNode of data.value) {
            if (rootNode.name === "Area") {
              extractPaths(rootNode, "", "Area");
            } else if (rootNode.name === "Iteration") {
              extractPaths(rootNode, "", "Iteration");
            }
          }
        }
        
        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                project: project,
                depth: depth,
                totalAreaPaths: areaPaths.length,
                totalIterationPaths: iterationPaths.length,
                areaPaths: areaPaths.sort(),
                iterationPaths: iterationPaths.sort(),
                rawResponse: data
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving area paths: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    AREAPATH_TOOLS.create_area_path,
    "Create a new area path in Azure DevOps project",
    {
      project: z.string().describe("Project name or ID"),
      name: z.string().describe("Name of the new area path"),
      parentPath: z.string().optional().describe("Parent area path (optional, creates under root if not specified)"),
    },
    async ({ project, name, parentPath }) => {
      try {
        const accessToken = await tokenProvider();
        
        // Build the URL based on whether parent path is specified
        let url: string;
        if (parentPath) {
          // Create under specific parent path
          // Need to encode the parent path for URL
          const encodedParentPath = encodeURIComponent(parentPath);
          url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Areas/${encodedParentPath}?api-version=7.2-preview.2`;
        } else {
          // Create under root Areas
          url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Areas?api-version=7.2-preview.2`;
        }

        const requestBody = {
          name: name,
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [{ 
              type: "text", 
              text: `Error creating area path: ${response.status} ${response.statusText} - ${errorText}` 
            }],
            isError: true,
          };
        }

        const createdAreaPath = await response.json();
        
        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                success: true,
                message: `Area path "${name}" created successfully`,
                areaPath: {
                  id: createdAreaPath.id,
                  name: createdAreaPath.name,
                  path: createdAreaPath.path,
                  parentPath: parentPath || "Root",
                  hasChildren: createdAreaPath.hasChildren || false,
                  structureType: createdAreaPath.structureType,
                  url: createdAreaPath.url,
                },
                fullResponse: createdAreaPath
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating area path: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    AREAPATH_TOOLS.classification_manage_iterations,
    "Bulk operations for iteration paths - allowing efficient management of sprint and iteration structures",
    {
      project: z.string().describe("Project name or ID"),
      operation: z.enum(["create", "list", "delete", "update"]).describe("Bulk operation to perform on iterations"),
      iterations: z.array(z.object({
        name: z.string().describe("Name of the iteration"),
        parentPath: z.string().optional().describe("Parent iteration path (optional, creates under root if not specified)"),
        startDate: z.string().optional().describe("Start date of the iteration in ISO format (YYYY-MM-DD)"),
        finishDate: z.string().optional().describe("Finish date of the iteration in ISO format (YYYY-MM-DD)"),
        id: z.number().optional().describe("ID of the iteration (required for update/delete operations)"),
        path: z.string().optional().describe("Full path of the iteration (alternative to parentPath + name)")
      })).optional().describe("Array of iterations for bulk create/update/delete operations"),
      depth: z.number().default(3).describe("Maximum depth for list operation. Defaults to 3."),
    },
    async ({ project, operation, iterations = [], depth }) => {
      try {
        const accessToken = await tokenProvider();
        const results: IterationResult[] = [];
        
        if (operation === "list") {
          // List all iteration paths
          const url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Iterations?$depth=${depth}&api-version=7.2-preview.2`;
          
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken.token}`,
              "User-Agent": userAgentProvider(),
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [{ 
                type: "text", 
                text: `Error fetching iterations: ${response.status} ${response.statusText} - ${errorText}` 
              }],
              isError: true,
            };
          }

          const data = await response.json();
          
          // Extract iteration paths from hierarchical structure
          const iterationPaths: IterationNode[] = [];
          
          function extractIterations(node: IterationNode, parentPath = "") {
            const currentPath = parentPath ? `${parentPath}\\${node.name}` : node.name;
            
            if (parentPath || node.name !== "Iteration") { // Skip root "Iteration" node
              iterationPaths.push({
                id: node.id,
                name: node.name,
                path: currentPath,
                structureType: node.structureType,
                hasChildren: node.hasChildren || false,
                attributes: node.attributes || {},
                url: node.url
              });
            }
            
            if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) {
                extractIterations(child, node.name === "Iteration" ? "" : currentPath);
              }
            }
          }
          
          extractIterations(data);
          
          return {
            content: [
              { 
                type: "text", 
                text: JSON.stringify({
                  operation: "list",
                  project: project,
                  totalIterations: iterationPaths.length,
                  iterations: iterationPaths.sort((a, b) => a.path.localeCompare(b.path))
                }, null, 2) 
              }
            ],
          };
        }
        
        if (operation === "create") {
          // Bulk create iterations
          for (const iteration of iterations) {
            try {
              let url: string;
              if (iteration.parentPath) {
                const encodedParentPath = encodeURIComponent(iteration.parentPath);
                url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Iterations/${encodedParentPath}?api-version=7.2-preview.2`;
              } else {
                url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Iterations?api-version=7.2-preview.2`;
              }

              const requestBody: IterationRequestBody = {
                name: iteration.name,
              };

              // Add attributes for start and finish dates if provided
              if (iteration.startDate || iteration.finishDate) {
                requestBody.attributes = {};
                if (iteration.startDate) {
                  requestBody.attributes.startDate = iteration.startDate;
                }
                if (iteration.finishDate) {
                  requestBody.attributes.finishDate = iteration.finishDate;
                }
              }

              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken.token}`,
                  "User-Agent": userAgentProvider(),
                },
                body: JSON.stringify(requestBody),
              });

              if (response.ok) {
                const createdIteration = await response.json();
                results.push({
                  status: "success",
                  iteration: iteration.name,
                  message: `Iteration "${iteration.name}" created successfully`,
                  data: {
                    id: createdIteration.id,
                    name: createdIteration.name,
                    path: createdIteration.path,
                    parentPath: iteration.parentPath || "Root",
                    attributes: createdIteration.attributes || {}
                  }
                });
              } else {
                const errorText = await response.text();
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: `Failed to create iteration: ${response.status} ${response.statusText} - ${errorText}`
                });
              }
            } catch (error) {
              results.push({
                status: "error",
                iteration: iteration.name,
                message: `Error creating iteration: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          }
        }
        
        if (operation === "update") {
          // Bulk update iterations
          for (const iteration of iterations) {
            try {
              if (!iteration.id && !iteration.path) {
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: "Either 'id' or 'path' is required for update operation"
                });
                continue;
              }

              const identifier = iteration.id ? iteration.id.toString() : (iteration.path ? encodeURIComponent(iteration.path) : "");
              if (!identifier) {
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: "Valid 'id' or 'path' is required for update operation"
                });
                continue;
              }
              
              const url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Iterations/${identifier}?api-version=7.2-preview.2`;

              const requestBody: IterationRequestBody = {
                name: iteration.name,
              };

              // Add attributes for start and finish dates if provided
              if (iteration.startDate || iteration.finishDate) {
                requestBody.attributes = {};
                if (iteration.startDate) {
                  requestBody.attributes.startDate = iteration.startDate;
                }
                if (iteration.finishDate) {
                  requestBody.attributes.finishDate = iteration.finishDate;
                }
              }

              const response = await fetch(url, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken.token}`,
                  "User-Agent": userAgentProvider(),
                },
                body: JSON.stringify(requestBody),
              });

              if (response.ok) {
                const updatedIteration = await response.json();
                results.push({
                  status: "success",
                  iteration: iteration.name,
                  message: `Iteration "${iteration.name}" updated successfully`,
                  data: {
                    id: updatedIteration.id,
                    name: updatedIteration.name,
                    path: updatedIteration.path,
                    attributes: updatedIteration.attributes || {}
                  }
                });
              } else {
                const errorText = await response.text();
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: `Failed to update iteration: ${response.status} ${response.statusText} - ${errorText}`
                });
              }
            } catch (error) {
              results.push({
                status: "error",
                iteration: iteration.name,
                message: `Error updating iteration: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          }
        }
        
        if (operation === "delete") {
          // Bulk delete iterations
          for (const iteration of iterations) {
            try {
              if (!iteration.id && !iteration.path) {
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: "Either 'id' or 'path' is required for delete operation"
                });
                continue;
              }

              const identifier = iteration.id ? iteration.id.toString() : (iteration.path ? encodeURIComponent(iteration.path) : "");
              if (!identifier) {
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: "Valid 'id' or 'path' is required for delete operation"
                });
                continue;
              }
              
              const url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Iterations/${identifier}?api-version=7.2-preview.2`;

              const response = await fetch(url, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken.token}`,
                  "User-Agent": userAgentProvider(),
                },
              });

              if (response.ok || response.status === 204) {
                results.push({
                  status: "success",
                  iteration: iteration.name,
                  message: `Iteration "${iteration.name}" deleted successfully`
                });
              } else {
                const errorText = await response.text();
                results.push({
                  status: "error",
                  iteration: iteration.name,
                  message: `Failed to delete iteration: ${response.status} ${response.statusText} - ${errorText}`
                });
              }
            } catch (error) {
              results.push({
                status: "error",
                iteration: iteration.name,
                message: `Error deleting iteration: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          }
        }
        
        const successCount = results.filter(r => r.status === "success").length;
        const errorCount = results.filter(r => r.status === "error").length;
        
        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                operation: operation,
                project: project,
                summary: {
                  total: results.length,
                  successful: successCount,
                  failed: errorCount
                },
                results: results
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error performing bulk iteration operation: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  
}

export { AREAPATH_TOOLS, configureAreaPathTools };