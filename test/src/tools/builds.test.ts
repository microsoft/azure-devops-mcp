import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configureBuildTools } from "../../../src/tools/builds";
import { WebApi } from "azure-devops-node-api";
import { _mockBuildTemplates, _mockBuildLogsZipResult } from "../../mocks/builds";

// Mock the utils module
jest.mock('../../../src/utils', () => ({
  streamToBuffer: jest.fn(),
  createLogPaths: jest.fn(),
  ensureDownloadsDirectory: jest.fn(),
  extractNestedZips: jest.fn(),
  createAnalysisPrompt: jest.fn(),
  openInVSCode: jest.fn(),
  cleanupZipFile: jest.fn(),
}));

// Mock fs module
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
}));

// Mock AdmZip
jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    extractAllTo: jest.fn(),
  }));
});

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

interface BuildApiMock {
  getTemplates: jest.Mock;
  getBuildLogsZip: jest.Mock;
}

describe("configureBuildTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: {
    getBuildApi: jest.Mock;
  };
  let mockBuildApi: BuildApiMock;

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();

    mockBuildApi = {
      getTemplates: jest.fn(),
      getBuildLogsZip: jest.fn(),
    };

    mockConnection = {
      getBuildApi: jest.fn().mockResolvedValue(mockBuildApi),
    };

    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers build tools on the server", () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
      const toolNames = (server.tool as jest.Mock).mock.calls.map((call: any) => call[0]);
      expect(toolNames).toContain("build_get_logs_zip");
      expect(toolNames).toContain("build_get_templates");
    });
  });

  describe("build_get_templates tool", () => {
    it("should call getTemplates with the correct parameters", async () => {
      configureBuildTools(server, tokenProvider, connectionProvider);
      
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]: any) => toolName === "build_get_templates"
      );
      if (!call) throw new Error("build_get_templates tool not registered");
      const [, , , handler] = call;

      (mockBuildApi.getTemplates as jest.Mock).mockResolvedValue(_mockBuildTemplates);
      
      const params = {
        project: "MyProject",
      };

      const result = await handler(params);

      expect(mockBuildApi.getTemplates).toHaveBeenCalledWith(params.project);
      expect(result.content[0].text).toBe(
        JSON.stringify(_mockBuildTemplates, null, 2)
      );
    });
  });

  describe("build_get_logs_zip tool", () => {
    it("should download build logs ZIP and process it correctly", async () => {
      const utils = require('../../../src/utils');
      
      configureBuildTools(server, tokenProvider, connectionProvider);
      
      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]: any) => toolName === "build_get_logs_zip"
      );
      if (!call) throw new Error("build_get_logs_zip tool not registered");
      const [, , , handler] = call;

      // Mock the stream and buffer
      const mockStream = {} as NodeJS.ReadableStream;
      const mockBuffer = Buffer.from("mock zip content");
      (mockBuildApi.getBuildLogsZip as jest.Mock).mockResolvedValue(mockStream);
      utils.streamToBuffer.mockResolvedValue(mockBuffer);
      utils.createLogPaths.mockReturnValue({
        filename: "build-12345-logs-myproject.zip",
        folderName: "build-12345-logs-myproject",
        zipFilePath: "C:\\Users\\test\\Downloads\\build-12345-logs-myproject.zip",
        extractDir: "C:\\Users\\test\\Downloads\\build-12345-logs-myproject"
      });
      utils.ensureDownloadsDirectory.mockReturnValue("C:\\Users\\test\\Downloads");

      const params = {
        project: "MyProject",
        buildId: 12345,
      };

      const result = await handler(params);

      expect(mockBuildApi.getBuildLogsZip).toHaveBeenCalledWith(
        params.project,
        params.buildId
      );
      expect(utils.streamToBuffer).toHaveBeenCalledWith(mockStream);
      expect(utils.createLogPaths).toHaveBeenCalledWith(params.buildId);
      expect(utils.ensureDownloadsDirectory).toHaveBeenCalled();

      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.buildId).toBe(12345);
      expect(resultJson.project).toBe("MyProject");
    });
  });
});
