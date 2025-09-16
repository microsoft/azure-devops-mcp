// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { orgName } from "../index.js";
import { apiVersion } from "../utils.js";

interface ClassificationNode {
  name: string;
  children?: ClassificationNode[];
}

const AREAPATH_TOOLS = {
  list_project_area_paths: "list_project_area_paths",
  create_area_path: "create_area_path",
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
        
        let url: string;
        if (parentPath) {
          // Create under specific parent path
          const encodedParentPath = encodeURIComponent(parentPath);
          url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Areas/${encodedParentPath}?api-version=${apiVersion}`;
        } else {
          // Create under root Areas
          url = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes/Areas?api-version=${apiVersion}`;
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
}

export { AREAPATH_TOOLS, configureAreaPathTools };