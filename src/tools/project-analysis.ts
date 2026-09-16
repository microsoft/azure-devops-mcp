// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool } from "../shared/tool-registration.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";
import { AggregationType } from "azure-devops-node-api/interfaces/ProjectAnalysisInterfaces.js";
import { elicitProject } from "../shared/elicitations.js";
import { optionalProject } from "../shared/common-params.js";

const PROJECT_ANALYSIS_TOOLS = {
  get_language_analytics: "projectanalysis_get_language_analytics",
  get_project_activity: "projectanalysis_get_project_activity",
  list_repository_activity: "projectanalysis_list_repository_activity",
  get_repository_activity: "projectanalysis_get_repository_activity",
};

const AGGREGATION_TYPE_MAP: Record<string, AggregationType> = {
  hourly: AggregationType.Hourly,
  daily: AggregationType.Daily,
};

function configureProjectAnalysisTools(server: McpServer, _: () => Promise<string>, connectionProvider: () => Promise<WebApi>) {
  // Resolve the project (eliciting if not supplied).
  const resolveProject = async (connection: WebApi, project: string | undefined) => {
    if (project) return { project };
    const result = await elicitProject(server, connection, "Select the Azure DevOps project.");
    if ("response" in result) return result;
    return { project: result.resolved };
  };

  const projectField = optionalProject;
  const aggregationField = z.enum(["daily", "hourly"]).default("daily").describe("The aggregation granularity for the metrics.");

  registerTool(
    server,
    PROJECT_ANALYSIS_TOOLS.get_language_analytics,
    "Get the language analytics (language breakdown) for a project. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
    },
    async ({ project }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const projectAnalysisApi = await connection.getProjectAnalysisApi();
        const analytics = await projectAnalysisApi.getProjectLanguageAnalytics(ctx.project);

        return { content: [{ type: "text", text: JSON.stringify(analytics, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching language analytics: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PROJECT_ANALYSIS_TOOLS.get_project_activity,
    "Get the activity metrics (commits, pushes, pull requests) for a project since a given date. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      fromDate: z.string().describe("The start date for the metrics in ISO format (e.g. '2024-01-01T00:00:00Z')."),
      aggregation: aggregationField,
    },
    async ({ project, fromDate, aggregation }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const projectAnalysisApi = await connection.getProjectAnalysisApi();
        const metrics = await projectAnalysisApi.getProjectActivityMetrics(ctx.project, new Date(fromDate), AGGREGATION_TYPE_MAP[aggregation]);

        return { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching project activity metrics: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PROJECT_ANALYSIS_TOOLS.list_repository_activity,
    "List the activity metrics for the Git repositories in a project since a given date. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      fromDate: z.string().describe("The start date for the metrics in ISO format (e.g. '2024-01-01T00:00:00Z')."),
      aggregation: aggregationField,
      skip: z.coerce.number().default(0).describe("Number of repositories to skip."),
      top: z.coerce.number().default(100).describe("Maximum number of repositories to return."),
    },
    async ({ project, fromDate, aggregation, skip, top }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const projectAnalysisApi = await connection.getProjectAnalysisApi();
        const metrics = await projectAnalysisApi.getGitRepositoriesActivityMetrics(ctx.project, new Date(fromDate), AGGREGATION_TYPE_MAP[aggregation], skip, top);

        if (!metrics || metrics.length === 0) {
          return { content: [{ type: "text", text: "No repository activity metrics found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching repository activity metrics: ${errorMessage}` }], isError: true };
      }
    }
  );

  registerTool(
    server,
    PROJECT_ANALYSIS_TOOLS.get_repository_activity,
    "Get the activity metrics for a specific Git repository since a given date. If a project is not specified, you will be prompted to select one.",
    {
      project: projectField,
      repositoryId: z.string().describe("The ID of the Git repository."),
      fromDate: z.string().describe("The start date for the metrics in ISO format (e.g. '2024-01-01T00:00:00Z')."),
      aggregation: aggregationField,
    },
    async ({ project, repositoryId, fromDate, aggregation }) => {
      try {
        const connection = await connectionProvider();
        const ctx = await resolveProject(connection, project);
        if ("response" in ctx) return ctx.response;

        const projectAnalysisApi = await connection.getProjectAnalysisApi();
        const metrics = await projectAnalysisApi.getRepositoryActivityMetrics(ctx.project, repositoryId, new Date(fromDate), AGGREGATION_TYPE_MAP[aggregation]);

        return { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { content: [{ type: "text", text: `Error fetching repository activity metrics: ${errorMessage}` }], isError: true };
      }
    }
  );
}

export { PROJECT_ANALYSIS_TOOLS, configureProjectAnalysisTools };
