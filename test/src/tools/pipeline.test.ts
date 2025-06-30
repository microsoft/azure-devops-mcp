import { AccessToken } from "@azure/identity";
import { describe, expect, it } from '@jest/globals';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configurePipelineTools } from '../../../src/tools/pipeline';
import { IPipelinesApi } from "azure-devops-node-api/PipelinesApi";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configurePipelineTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getPipelinesApi: () => Promise<IPipelinesApi>;
  };
  let mockPipelinesApi: IPipelinesApi;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockPipelinesApi = {
      listPipelines: jest.fn(),
      getPipeline: jest.fn(),
      listRuns: jest.fn(),
      listLogs: jest.fn(),
      getLog: jest.fn(),
      preview: jest.fn(),
      runPipeline: jest.fn(),
    } as unknown as IPipelinesApi;
    mockConnection = {
      getPipelinesApi: jest.fn().mockResolvedValue(mockPipelinesApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers pipeline tools on the server", () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      expect((server.tool as jest.Mock).mock.calls.map(call => call[0])).toEqual(
        expect.arrayContaining([
          "list_pipelines",
          "get_pipeline",
          "list_pipeline_runs",
          "list_run_logs",
          "get_log_content",
          "preview",
          "run_pipeline",
        ])
      );
    });
  });

  describe("list_pipelines tool", () => {
    it("should call listPipelines with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "list_pipelines"
      );
      if (!call) throw new Error("list_pipelines tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.listPipelines as jest.Mock).mockResolvedValue([{ id: 1, name: "Pipeline 1" }]);
      const params = {
        project: "proj1",
      };
      const result = await handler(params);

      expect(mockPipelinesApi.listPipelines).toHaveBeenCalledWith("proj1");
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "Pipeline 1" }], null, 2));
    });
  });

  describe("get_pipeline tool", () => {
    it("should call getPipeline with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "get_pipeline"
      );
      if (!call) throw new Error("get_pipeline tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.getPipeline as jest.Mock).mockResolvedValue({ id: 1, name: "Pipeline 1" });
      const params = {
        project: "proj1",
        pipelineId: 1,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.getPipeline).toHaveBeenCalledWith("proj1", 1);
      expect(result.content[0].text).toBe(JSON.stringify({ id: 1, name: "Pipeline 1" }, null, 2));
    });
  });

  describe("list_pipeline_runs tool", () => {
    it("should call listRuns with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "list_pipeline_runs"
      );
      if (!call) throw new Error("list_pipeline_runs tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.listRuns as jest.Mock).mockResolvedValue([{ id: 1, name: "Run 1" }]);
      const params = {
        project: "proj1",
        pipelineId: 1,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.listRuns).toHaveBeenCalledWith("proj1", 1);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "Run 1" }], null, 2));
    });
  });

  describe("list_run_logs tool", () => {
    it("should call listLogs with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "list_run_logs"
      );
      if (!call) throw new Error("list_run_logs tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.listLogs as jest.Mock).mockResolvedValue([{ id: 1, name: "Log 1" }]);
      const params = {
        project: "proj1",
        pipelineId: 1,
        runId: 123,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.listLogs).toHaveBeenCalledWith("proj1", 1, 123);
      expect(result.content[0].text).toBe(JSON.stringify([{ id: 1, name: "Log 1" }], null, 2));
    });
  });

  describe("get_log_content tool", () => {
    it("should call getLog with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "get_log_content"
      );
      if (!call) throw new Error("get_log_content tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.getLog as jest.Mock).mockResolvedValue({ content: "Log content" });
      const params = {
        project: "proj1",
        pipelineId: 1,
        runId: 123,
        logId: 456,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.getLog).toHaveBeenCalledWith("proj1", 1, 123, 456);
      expect(result.content[0].text).toBe(JSON.stringify({ content: "Log content" }, null, 2));
    });
  });

  describe("preview tool", () => {
    it("should call preview with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "preview"
      );
      if (!call) throw new Error("preview tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.preview as jest.Mock).mockResolvedValue({ finalYaml: "pipeline: yaml" });
      const params = {
        project: "proj1",
        pipelineId: 1,
        runParameters: {
          previewRun: true,
          variables: { key: { value: "value" } },
        },
        pipelineVersion: 2,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.preview).toHaveBeenCalledWith(
        {
          previewRun: true,
          variables: { key: { value: "value" } },
        },
        "proj1",
        1,
        2
      );
      expect(result.content[0].text).toBe(JSON.stringify({ finalYaml: "pipeline: yaml" }, null, 2));
    });
  });

  describe("run_pipeline tool", () => {
    it("should call runPipeline with the correct parameters and return the expected result", async () => {
      configurePipelineTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === "run_pipeline"
      );
      if (!call) throw new Error("run_pipeline tool not registered");
      const [, , , handler] = call;

      (mockPipelinesApi.runPipeline as jest.Mock).mockResolvedValue({ id: 789, state: "queued" });
      const params = {
        project: "proj1",
        pipelineId: 1,
        runParameters: {
          variables: { env: { value: "prod" } },
          templateParameters: { param1: "value1" },
        },
        pipelineVersion: 3,
      };
      const result = await handler(params);

      expect(mockPipelinesApi.runPipeline).toHaveBeenCalledWith(
        {
          variables: { env: { value: "prod" } },
          templateParameters: { param1: "value1" },
        },
        "proj1",
        1,
        3
      );
      expect(result.content[0].text).toBe(JSON.stringify({ id: 789, state: "queued" }, null, 2));
    });
  });
});
