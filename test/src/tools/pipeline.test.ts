import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configurePipelineTools } from "../../../src/tools/pipeline";
import { WebApi } from "azure-devops-node-api";
import { 
  _mockPipelines, 
  _mockPipeline, 
  _mockPipelineRuns, 
  _mockRunLogs, 
  _mockLogContent, 
  _mockPipelinePreview, 
  _mockPipelineRun 
} from "../../mocks/pipelines";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface PipelineApiMock {
  listPipelines: jest.Mock;
  getPipeline: jest.Mock;
  listRuns: jest.Mock;
  listLogs: jest.Mock;
  getLog: jest.Mock;
  preview: jest.Mock;
  runPipeline: jest.Mock;
}

describe("configurePipelineTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getPipelinesApi: jest.Mock;
  };
  let mockPipelineApi: PipelineApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockPipelineApi = {
      listPipelines: jest.fn(),
      getPipeline: jest.fn(),
      listRuns: jest.fn(),
      listLogs: jest.fn(),
      getLog: jest.fn(),
      preview: jest.fn(),
      runPipeline: jest.fn(),
    };

    mockConnection = {
      getPipelinesApi: jest.fn().mockResolvedValue(mockPipelineApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers pipeline tools on the server", () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock).mock.calls.map(call => call[0])).toEqual(
        expect.arrayContaining([
          "pipeline_list_pipelines",
          "pipeline_get_pipeline",
          "pipeline_list_pipeline_runs",
          "pipeline_list_run_logs",
          "pipeline_get_log_content",
          "pipeline_preview",
          "pipeline_run_pipeline",
        ])
      );
    });
  });

  describe("pipeline_list_pipelines tool", () => {
    it("should call listPipelines API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_list_pipelines"
      );
      if (!call) throw new Error("pipeline_list_pipelines tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.listPipelines as jest.Mock).mockResolvedValue(_mockPipelines);

      const params = {
        project: "MyProject",
      };

      const result = await handler(params);

      expect(mockPipelineApi.listPipelines).toHaveBeenCalledWith(params.project);
      expect(result.content[0].text).toBe(JSON.stringify(_mockPipelines, null, 2));
    });
  });

  describe("pipeline_get_pipeline tool", () => {
    it("should call getPipeline API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_get_pipeline"
      );
      if (!call) throw new Error("pipeline_get_pipeline tool not registered");
      const [, , , handler] = call;      (mockPipelineApi.getPipeline as jest.Mock).mockResolvedValue(_mockPipeline);

      const params = {
        project: "MyProject",
        pipelineId: 1,
      };

      const result = await handler(params);

      expect(mockPipelineApi.getPipeline).toHaveBeenCalledWith(
        params.project,
        params.pipelineId
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockPipeline, null, 2));
    });
  });

  describe("pipeline_list_pipeline_runs tool", () => {
    it("should call listRuns API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_list_pipeline_runs"
      );
      if (!call) throw new Error("pipeline_list_pipeline_runs tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.listRuns as jest.Mock).mockResolvedValue(_mockPipelineRuns);

      const params = {
        project: "MyProject",
        pipelineId: 1,
      };

      const result = await handler(params);

      expect(mockPipelineApi.listRuns).toHaveBeenCalledWith(
        params.project,
        params.pipelineId
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockPipelineRuns, null, 2));
    });
  });

  describe("pipeline_list_run_logs tool", () => {
    it("should call listLogs API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_list_run_logs"
      );
      if (!call) throw new Error("pipeline_list_run_logs tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.listLogs as jest.Mock).mockResolvedValue(_mockRunLogs);

      const params = {
        project: "MyProject",
        pipelineId: 1,
        runId: 101,
      };

      const result = await handler(params);

      expect(mockPipelineApi.listLogs).toHaveBeenCalledWith(
        params.project,
        params.pipelineId,
        params.runId
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockRunLogs, null, 2));
    });
  });

  describe("pipeline_get_log_content tool", () => {
    it("should call getLog API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_get_log_content"
      );
      if (!call) throw new Error("pipeline_get_log_content tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.getLog as jest.Mock).mockResolvedValue(_mockLogContent);

      const params = {
        project: "MyProject",
        pipelineId: 1,
        runId: 101,
        logId: 2,
      };

      const result = await handler(params);

      expect(mockPipelineApi.getLog).toHaveBeenCalledWith(
        params.project,
        params.pipelineId,
        params.runId,
        params.logId
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockLogContent, null, 2));
    });
  });

  describe("pipeline_preview tool", () => {
    it("should call preview API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_preview"
      );
      if (!call) throw new Error("pipeline_preview tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.preview as jest.Mock).mockResolvedValue(_mockPipelinePreview);

      const params = {
        project: "MyProject",
        pipelineId: 1,
        runParameters: {
          previewRun: true,
          templateParameters: {
            environment: "staging"
          }
        },
        pipelineVersion: 1,
      };

      const result = await handler(params);

      expect(mockPipelineApi.preview).toHaveBeenCalledWith(
        params.runParameters,
        params.project,
        params.pipelineId,
        params.pipelineVersion
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockPipelinePreview, null, 2));
    });
  });

  describe("pipeline_run_pipeline tool", () => {
    it("should call runPipeline API with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "pipeline_run_pipeline"
      );
      if (!call) throw new Error("pipeline_run_pipeline tool not registered");
      const [, , , handler] = call;

      (mockPipelineApi.runPipeline as jest.Mock).mockResolvedValue(_mockPipelineRun);

      const params = {
        project: "MyProject",
        pipelineId: 1,
        runParameters: {
          templateParameters: {
            environment: "production"
          },
          variables: {
            buildConfiguration: "Release"
          }
        },
        pipelineVersion: 1,
      };

      const result = await handler(params);

      expect(mockPipelineApi.runPipeline).toHaveBeenCalledWith(
        params.runParameters,
        params.project,
        params.pipelineId,
        params.pipelineVersion
      );
      expect(result.content[0].text).toBe(JSON.stringify(_mockPipelineRun, null, 2));
    });
  });
});
