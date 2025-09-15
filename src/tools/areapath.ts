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

const AREAPATH_TOOLS = {
  list_project_area_paths: "list_project_area_paths",
  create_area_path: "create_area_path",
  area_suggest_for_workitem: "area_suggest_for_workitem",
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
    AREAPATH_TOOLS.area_suggest_for_workitem,
    "LLM-powered area path suggestions based on work item content - analyzing work item descriptions, titles, and context to intelligently recommend the most appropriate area path",
    {
      project: z.string().describe("Project name or ID"),
      workItemId: z.number().describe("Work item ID to analyze"),
      maxSuggestions: z.number().default(3).describe("Maximum number of area path suggestions to return (default: 3)"),
    },
    async ({ project, workItemId, maxSuggestions }) => {
      try {
        const accessToken = await tokenProvider();
        const connection = await connectionProvider();
        
        let workItemTitle: string | undefined;
        let workItemDescription: string | undefined;
        let workItemType: string | undefined;
        let workItemTags: string[] | undefined;

        // Fetch the work item details
        try {
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItem = await workItemApi.getWorkItem(workItemId, undefined, undefined, undefined, project);
          
          if (workItem && workItem.fields) {
            workItemTitle = workItem.fields["System.Title"];
            workItemDescription = workItem.fields["System.Description"];
            workItemType = workItem.fields["System.WorkItemType"];
            
            // Parse tags if they exist
            const tagsField = workItem.fields["System.Tags"];
            if (tagsField) {
              workItemTags = tagsField.split(";").map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
            }
          }
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Error fetching work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}` 
            }],
            isError: true,
          };
        }

        // Validate we have work item content
        if (!workItemTitle) {
          return {
            content: [{ 
              type: "text", 
              text: `Work item ${workItemId} not found or has no title` 
            }],
            isError: true,
          };
        }

        // Get all available area paths for the project
        const areaPathsUrl = `https://dev.azure.com/${orgName}/${project}/_apis/wit/classificationnodes?$depth=10&api-version=7.0`;
        
        const areaPathsResponse = await fetch(areaPathsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken.token}`,
            "User-Agent": userAgentProvider(),
          },
        });

        if (!areaPathsResponse.ok) {
          const errorText = await areaPathsResponse.text();
          return {
            content: [{ 
              type: "text", 
              text: `Error fetching area paths: ${areaPathsResponse.status} ${areaPathsResponse.statusText} - ${errorText}` 
            }],
            isError: true,
          };
        }

        const areaPathsData = await areaPathsResponse.json();
        
        // Extract area paths
        const areaPaths: string[] = [];
        
        function extractAreaPaths(node: ClassificationNode, parentPath = "", nodeType = "Area") {
          const currentPath = parentPath ? `${parentPath}\\${node.name}` : node.name;
          
          if (parentPath && nodeType === "Area") {
            areaPaths.push(currentPath);
          }
          
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              extractAreaPaths(child, currentPath, nodeType);
            }
          }
        }
        
        if (areaPathsData.value && Array.isArray(areaPathsData.value)) {
          for (const rootNode of areaPathsData.value) {
            if (rootNode.name === "Area") {
              extractAreaPaths(rootNode, "", "Area");
            }
          }
        }

        // Prepare content for LLM analysis
        const analysisPrompt = `
        You are an expert Azure DevOps consultant helping to assign the most appropriate area path for a work item.

        **Work Item Details:**
        - Title: ${workItemTitle || "Not provided"}
        - Description: ${workItemDescription || "Not provided"}
        - Type: ${workItemType || "Not specified"}
        - Tags: ${workItemTags && workItemTags.length > 0 ? workItemTags.join(", ") : "None"}

        **Available Area Paths in Project "${project}":**
        ${areaPaths.length > 0 ? areaPaths.map(path => `- ${path}`).join('\n') : "No area paths found"}

        **Instructions:**
        1. Analyze the work item title, description, type, and tags
        2. Consider keywords, technology stack, feature areas, team responsibilities, and component mentions
        3. Match the work item content to the most appropriate area path(s)
        4. Provide ${maxSuggestions} suggestions ranked by relevance
        5. For each suggestion, provide a confidence score (0-100) and reasoning

        **Response Format (JSON):**
        {
        "suggestions": [
            {
            "areaPath": "ProjectName\\TeamName\\Component",
            "confidence": 95,
            "reasoning": "Clear match because..."
            }
        ],
        "analysis": {
            "keyWords": ["extracted", "keywords"],
            "primaryTopic": "Main topic identified",
            "recommendedMatch": "Brief explanation of best match"
        }
        }

        Provide only the JSON response, no additional text.
        `;

        return {
          content: [
            { 
              type: "text", 
              text: JSON.stringify({
                success: true,
                workItem: {
                  id: workItemId,
                  title: workItemTitle,
                  description: workItemDescription ? workItemDescription.substring(0, 200) + "..." : undefined,
                  type: workItemType,
                  tags: workItemTags,
                },
                project: project,
                availableAreaPaths: areaPaths,
                totalAreaPaths: areaPaths.length,
                llmPrompt: analysisPrompt,
                instructions: "Use the provided LLM prompt to get AI-powered area path suggestions. The prompt contains all necessary context including work item details and available area paths.",
                note: "This tool provides the analysis prompt. Use an LLM service to process the prompt and get intelligent area path recommendations."
              }, null, 2) 
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating area path suggestions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { AREAPATH_TOOLS, configureAreaPathTools };