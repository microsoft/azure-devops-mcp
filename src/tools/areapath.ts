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
};

function configureAreaPathTools(server: McpServer, tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // server.tool(
  //   AREAPATH_TOOLS.list_project_area_paths,
  //   "Get all area paths for a project in Azure DevOps",
  //   {
  //     project: z.string().describe("Project name or ID"),
  //     depth: z.number().default(10).describe("Maximum depth of area path hierarchy to retrieve. Defaults to 10."),
  //   },
  //   async ({ project, depth }) => {
  //     // Implementation for listing project area paths
  //   }
  // );
}

export { AREAPATH_TOOLS, configureAreaPathTools };