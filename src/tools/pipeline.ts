import { AccessToken } from "@azure/identity";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { z } from "zod";

const PIPELINE_TOOLS = {
    list_pipelines: "list_pipelines",
    get_pipeline: "get_pipeline",
    list_pipeline_runs: "list_pipeline_runs",
    list_run_logs: "list_run_logs",
    get_log_content: "get_log_content",
    preview: "preview",
    run_pipeline: "run_pipeline",
};

function configurePipelineTools(
    server: McpServer,
    tokenProvider: () => Promise<AccessToken>,
    connectionProvider: () => Promise<WebApi>
) {

    server.tool(
        PIPELINE_TOOLS.list_pipelines,
        "Retrieve a list of pipelines for the specified Azure DevOps project.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
        },
        async ({ project }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const pipelines = await pipelineApi.listPipelines(project);
            return { content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.list_pipeline_runs,
        "List runs for a specific pipeline in a project.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
        },
        async ({ project, pipelineId }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const runs = await pipelineApi.listRuns(project, pipelineId);
            return { content: [{ type: "text", text: JSON.stringify(runs, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.list_run_logs,
        "List logs for a specific run in a pipeline.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
            runId: z.number().describe("The ID of the run."),
        },
        async ({ project, pipelineId, runId }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const logs = await pipelineApi.listLogs(project, pipelineId, runId);
            return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.get_log_content,
        "Get the content of a specific log for a run.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
            runId: z.number().describe("The ID of the run."),
            logId: z.number().describe("The ID of the log."),
        },
        async ({ project, pipelineId, runId, logId }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const logContentObj = await pipelineApi.getLog(project, pipelineId, runId, logId);
            return { content: [{ type: "text", text: JSON.stringify(logContentObj, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.get_pipeline,
        "Get a pipeline by its ID for a given Azure DevOps project.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
        },
        async ({ project, pipelineId }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const pipeline = await pipelineApi.getPipeline(project, pipelineId);
            return { content: [{ type: "text", text: JSON.stringify(pipeline, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.preview,
        "Preview the final YAML for a pipeline without running it.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
            runParameters: z.object({
                previewRun: z.boolean().optional(),
                resources: z.any().optional(),
                stagesToSkip: z.array(z.string()).optional(),
                templateParameters: z.record(z.string()).optional(),
                variables: z.record(z.any()).optional(),
                yamlOverride: z.string().optional(),
            }).describe("Parameters for the preview run. See Azure DevOps RunPipelineParameters."),
            pipelineVersion: z.number().optional().describe("Optional pipeline version."),
        },
        async ({ project, pipelineId, runParameters, pipelineVersion }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const preview = await pipelineApi.preview(runParameters, project, pipelineId, pipelineVersion);
            return { content: [{ type: "text", text: JSON.stringify(preview, null, 2) }] };
        }
    );

    server.tool(
        PIPELINE_TOOLS.run_pipeline,
        "Run a pipeline for a given Azure DevOps project.",
        {
            project: z.string().describe("The name or ID of the Azure DevOps project."),
            pipelineId: z.number().describe("The ID of the pipeline."),
            runParameters: z.object({
                previewRun: z.boolean().optional(),
                resources: z.any().optional(),
                stagesToSkip: z.array(z.string()).optional(),
                templateParameters: z.record(z.string()).optional(),
                variables: z.record(z.any()).optional(),
                yamlOverride: z.string().optional(),
            }).describe("Parameters for the run. See Azure DevOps RunPipelineParameters."),
            pipelineVersion: z.number().optional().describe("Optional pipeline version."),
        },
        async ({ project, pipelineId, runParameters, pipelineVersion }) => {
            const connection = await connectionProvider();
            const pipelineApi = await connection.getPipelinesApi();
            const run = await pipelineApi.runPipeline(runParameters, project, pipelineId, pipelineVersion);
            return { content: [{ type: "text", text: JSON.stringify(run, null, 2) }] };
        }
    );

}

export { PIPELINE_TOOLS, configurePipelineTools };