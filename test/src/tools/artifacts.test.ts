// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureArtifactTools } from "../../../src/tools/artifacts";
import { Readable } from "stream";
import { resolve } from "path";
import { mkdirSync, createWriteStream } from "fs";
import { mockArtifact, mockMultipleArtifacts } from "../../mocks/artifacts";
import { apiVersion } from "../../../src/utils.js";

jest.mock("fs");

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<string>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureArtifactTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let userAgentProvider: () => string;
  let mockConnection: { getBuildApi: jest.Mock; serverUrl: string };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    userAgentProvider = () => "Jest";
    mockConnection = {
      getBuildApi: jest.fn(),
      serverUrl: "https://dev.azure.com/test-org",
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers all artifact tools on the server", () => {
      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("list_pipeline_artifacts", () => {
    it("should list artifacts for a given build", async () => {
      const mockGetArtifacts = jest.fn().mockResolvedValue(mockMultipleArtifacts);
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "list_pipeline_artifacts");
      if (!call) throw new Error("list_pipeline_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 12345 };
      const result = await handler(params);

      expect(mockGetArtifacts).toHaveBeenCalledWith("test-project", 12345);
      expect(result.content[0].text).toContain("drop");
      expect(result.content[0].text).toContain("logs");
      expect(result.content[0].text).toContain("Container");
    });

    it("should handle empty artifact list", async () => {
      const mockGetArtifacts = jest.fn().mockResolvedValue([]);
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "list_pipeline_artifacts");
      if (!call) throw new Error("list_pipeline_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 99999 };

      const result = await handler(params);

      expect(mockGetArtifacts).toHaveBeenCalledWith("test-project", 99999);
      expect(result.content[0].text).toBe("[]");
    });

    it("should handle errors when listing artifacts", async () => {
      const mockGetArtifacts = jest.fn().mockRejectedValue(new Error("Build not found"));
      mockConnection.getBuildApi.mockResolvedValue({ getArtifacts: mockGetArtifacts } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "list_pipeline_artifacts");
      if (!call) throw new Error("list_pipeline_artifacts tool not registered");
      const [, , , handler] = call;

      const params = { project: "test-project", buildId: 12345 };
      await expect(handler(params)).rejects.toThrow("Build not found");
    });
  });

  describe("download_pipeline_artifact", () => {
    let mockWriteStream: any;
    let mockFileStream: Readable;

    beforeEach(() => {
      mockWriteStream = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      };
      (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
      (mkdirSync as jest.Mock).mockReturnValue(undefined);

      // Create a mock readable stream
      mockFileStream = new Readable({
        read() {
          this.push(Buffer.from("fake zip content"));
          this.push(null);
        },
      });
    });

    it("should download and save an artifact", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);
      const mockGetArtifactContentZip = jest.fn().mockResolvedValue(mockFileStream);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "download_pipeline_artifact");
      if (!call) throw new Error("download_pipeline_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      const result = await handler(params);

      expect(mockGetArtifact).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mockGetArtifactContentZip).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mkdirSync).toHaveBeenCalledWith(resolve("D:\\temp\\artifacts"), { recursive: true });
      expect(createWriteStream).toHaveBeenCalledWith(expect.stringContaining("drop.zip"));
      expect(result.content[0].text).toContain("Artifact drop downloaded");
    });

    it("should handle artifact not found", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(null);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
      } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "download_pipeline_artifact");
      if (!call) throw new Error("download_pipeline_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      const result = await handler(params);

      expect(result.content[0].text).toContain("Artifact drop not found");
    });

    it("should handle download errors correctly", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);
      const mockGetArtifactContentZip = jest.fn().mockRejectedValue(new Error("Network error"));

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "download_pipeline_artifact");
      if (!call) throw new Error("download_pipeline_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        destinationPath: "D:\\temp\\artifacts",
      };

      await expect(handler(params)).rejects.toThrow("Network error");
    });

    it("should return artifact as base64 binary when destinationPath is not provided", async () => {
      const mockGetArtifact = jest.fn().mockResolvedValue(mockArtifact);

      // Create a mock readable stream with test content
      const testContent = Buffer.from("fake zip content for binary test");
      const mockFileStream = new Readable({
        read() {
          this.push(testContent);
          this.push(null);
        },
      });

      const mockGetArtifactContentZip = jest.fn().mockResolvedValue(mockFileStream);

      mockConnection.getBuildApi.mockResolvedValue({
        getArtifact: mockGetArtifact,
        getArtifactContentZip: mockGetArtifactContentZip,
      } as any);

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "download_pipeline_artifact");
      if (!call) throw new Error("download_pipeline_artifact tool not registered");
      const [, , , handler] = call;

      const params = {
        project: "test-project",
        buildId: 12345,
        artifactName: "drop",
        // No destinationPath provided - should return binary
      };

      const result = await handler(params);

      expect(mockGetArtifact).toHaveBeenCalledWith("test-project", 12345, "drop");
      expect(mockGetArtifactContentZip).toHaveBeenCalledWith("test-project", 12345, "drop");

      // Verify the result contains base64 encoded binary content
      expect(result.content[0].type).toBe("resource");
      expect(result.content[0].resource.mimeType).toBe("application/zip");
      expect(result.content[0].resource.uri).toContain("data:application/zip;base64,");

      // Verify the base64 content matches the original
      const expectedBase64 = testContent.toString("base64");
      expect(result.content[0].resource.text).toBe(expectedBase64);
      expect(result.content[0].resource.uri).toContain(expectedBase64);
    });
  });

  describe("read_pipeline_artifact_file", () => {
    it("should read a text file from an artifact", async () => {
      const mockFileContent = "This is the content of the file";
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockFileContent),
        statusText: "OK",
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);
      (tokenProvider as jest.Mock).mockResolvedValue("test-token");

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "read_pipeline_artifact_file");
      if (!call) throw new Error("read_pipeline_artifact_file tool not registered");
      const [, , , handler] = call;
      const params = {
        containerId: "123456",
        itemPath: "/logs/build.log",
        isShallow: false,
        asText: true,
      };

      const result = await handler(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/test-org/_apis/resources/Containers/123456?itemPath=${encodeURIComponent("/logs/build.log")}&isShallow=false&api-version=${apiVersion}`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(mockFileContent);
    });

    it("should read a binary file from an artifact", async () => {
      const mockFileBuffer = Buffer.from("binary content");
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockFileBuffer.buffer),
        statusText: "OK",
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);
      (tokenProvider as jest.Mock).mockResolvedValue("test-token");

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "read_pipeline_artifact_file");
      if (!call) throw new Error("read_pipeline_artifact_file tool not registered");
      const [, , , handler] = call;

      const params = {
        containerId: "123456",
        itemPath: "/bin/app.exe",
        isShallow: false,
        asText: false,
      };

      const result = await handler(params);

      expect(result.content[0].type).toBe("resource");
      expect(result.content[0].resource.mimeType).toBe("application/octet-stream");
      expect(result.content[0].resource.uri).toContain("data:application/octet-stream;base64,");
    });

    it("should handle fetch errors correctly", async () => {
      const mockResponse = {
        ok: false,
        statusText: "Not Found",
      };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse as any);
      (tokenProvider as jest.Mock).mockResolvedValue("test-token");

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "read_pipeline_artifact_file");
      if (!call) throw new Error("read_pipeline_artifact_file tool not registered");
      const [, , , handler] = call;

      const params = {
        containerId: "123456",
        itemPath: "/missing.txt",
        isShallow: false,
        asText: true,
      };

      await expect(handler(params)).rejects.toThrow("Failed to fetch artifact item: Not Found");
    });

    it("should handle network errors correctly", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error("Network connection failed"));
      (tokenProvider as jest.Mock).mockResolvedValue("test-token");

      configureArtifactTools(server, tokenProvider, connectionProvider, userAgentProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "read_pipeline_artifact_file");
      if (!call) throw new Error("read_pipeline_artifact_file tool not registered");
      const [, , , handler] = call;

      const params = {
        containerId: "123456",
        itemPath: "/file.txt",
        isShallow: false,
        asText: true,
      };

      await expect(handler(params)).rejects.toThrow("Network connection failed");
    });
  });
});
