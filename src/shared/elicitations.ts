// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

interface ElicitResolved {
  resolved: string;
}

interface ElicitResponse {
  response: { content: { type: "text"; text: string }[]; isError?: boolean };
}

export type ElicitResult = ElicitResolved | ElicitResponse;

export async function elicitProject(server: McpServer, connection: WebApi, message?: string): Promise<ElicitResult> {
  // Check for default project from environment variable
  const defaultProject = process.env.project;
  if (defaultProject) {
    return { resolved: defaultProject };
  }

  const coreApi = await connection.getCoreApi();
  const projects = await coreApi.getProjects("wellFormed", 100, 0, undefined, false);

  if (!projects || projects.length === 0) {
    return { response: { content: [{ type: "text", text: "No projects found to select from." }], isError: true } };
  }

  const result = await server.server.elicitInput({
    mode: "form",
    message: message ?? "Select the Azure DevOps project.",
    requestedSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          title: "Project",
          description: "The Azure DevOps project.",
          oneOf: projects.map((p) => ({
            const: p.name ?? p.id ?? "",
            title: p.name ?? p.id ?? "Unknown project",
          })),
        },
      },
      required: ["project"],
    },
  });

  if (result.action !== "accept" || !result.content?.project) {
    return { response: { content: [{ type: "text", text: "Project selection cancelled." }] } };
  }

  return { resolved: String(result.content.project) };
}

export async function elicitTeam(server: McpServer, connection: WebApi, project: string, message?: string): Promise<ElicitResult> {
  // Check for default team from environment variable
  const defaultTeam = process.env.team;
  if (defaultTeam) {
    return { resolved: defaultTeam };
  }

  const coreApi = await connection.getCoreApi();
  const teams = await coreApi.getTeams(project, undefined, undefined, undefined, false);

  if (!teams || teams.length === 0) {
    return { response: { content: [{ type: "text", text: "No teams found to select from." }], isError: true } };
  }

  const result = await server.server.elicitInput({
    mode: "form",
    message: message ?? "Select the team.",
    requestedSchema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          title: "Team",
          description: "The team from a specific Azure DevOps project.",
          oneOf: teams.map((t) => ({
            const: t.name ?? t.id ?? "",
            title: t.name ?? t.id ?? "Unknown team",
          })),
        },
      },
      required: ["team"],
    },
  });

  if (result.action !== "accept" || !result.content?.team) {
    return { response: { content: [{ type: "text", text: "Team selection cancelled." }] } };
  }

  return { resolved: String(result.content.team) };
}
