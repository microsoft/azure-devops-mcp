// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { apiVersion } from "../utils.js";
import { z } from "zod";

import { mkdirSync, createWriteStream } from "fs";
import { join, resolve } from "path";

const ARTIFACT_TOOLS = {
  list_pipeline_artifacts: "list_pipeline_artifacts",
  download_pipeline_artifact: "download_pipeline_artifact",
  read_pipeline_artifact_file: "read_pipeline_artifact_file",
};

function configureArtifactTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  server.tool(
    ARTIFACT_TOOLS.list_pipeline_artifacts,
    "List artifacts for a given build.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.number().describe("The ID of the build."),
    },
    async ({ project, buildId }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const artifacts = await buildApi.getArtifacts(project, buildId);

      return {
        content: [{ type: "text", text: JSON.stringify(artifacts, null, 2) }],
      };
    }
  );

  server.tool(
    ARTIFACT_TOOLS.download_pipeline_artifact,
    "Download a pipeline artifact.",
    {
      project: z.string().describe("The name or ID of the project."),
      buildId: z.number().describe("The ID of the build."),
      artifactName: z.string().describe("The name of the artifact to download."),
      destinationPath: z.string().optional().describe("The local path to download the artifact to. If not provided, returns binary content as base64."),
    },
    async ({ project, buildId, artifactName, destinationPath }) => {
      const connection = await connectionProvider();
      const buildApi = await connection.getBuildApi();
      const artifact = await buildApi.getArtifact(project, buildId, artifactName);

      if (!artifact) {
        return {
          content: [{ type: "text", text: `Artifact ${artifactName} not found in build ${buildId}.` }],
        };
      }

      const fileStream = await buildApi.getArtifactContentZip(project, buildId, artifactName);

      // If destinationPath is provided, save to disk
      if (destinationPath) {
        const fullDestinationPath = resolve(destinationPath);

        mkdirSync(fullDestinationPath, { recursive: true });
        const tempFilePath = join(fullDestinationPath, `${artifactName}.zip`);

        const writeStream = createWriteStream(tempFilePath);
        await new Promise<void>((resolve, reject) => {
          fileStream.pipe(writeStream);
          fileStream.on("end", () => resolve());
          fileStream.on("error", (err) => reject(err));
        });

        return {
          content: [{ type: "text", text: `Artifact ${artifactName} downloaded to ${destinationPath}.` }],
        };
      }

      // Otherwise, return binary content as base64
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        fileStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        fileStream.on("end", () => resolve());
        fileStream.on("error", (err) => reject(err));
      });

      const buffer = Buffer.concat(chunks);
      const base64Data = buffer.toString("base64");

      return {
        content: [
          {
            type: "resource",
            resource: {
              uri: `data:application/zip;base64,${base64Data}`,
              mimeType: "application/zip",
              text: base64Data,
            },
          },
        ],
      };
    }
  );

  server.tool(
    ARTIFACT_TOOLS.read_pipeline_artifact_file,
    "Read a file from a pipeline artifact.",
    {
      containerId: z.string().describe("The container ID of the artifact."),
      itemPath: z.string().describe("The path of the file within the artifact."),
      isShallow: z.boolean().optional().describe("Whether to perform a shallow read."),
      asText: z.boolean().optional().describe("Whether to read the file as text."),
    },
    async ({ containerId, itemPath, isShallow = false, asText = true }) => {
      const connection = await connectionProvider();
      const orgUrl = connection.serverUrl;
      const artifactUrl = `${orgUrl}/_apis/resources/Containers/${containerId}?itemPath=${encodeURIComponent(itemPath)}&isShallow=${isShallow}&api-version=${apiVersion}`;

      const token = await tokenProvider();
      const response = await fetch(artifactUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch artifact item: ${response.statusText}`);
      }

      if (asText) {
        const text = await response.text();
        return {
          content: [{ type: "text", text }],
        };
      } else {
        const buffer = await response.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        return {
          content: [{ type: "resource", resource: { uri: `data:application/octet-stream;base64,${base64Data}`, mimeType: "application/octet-stream", text: base64Data } }],
        };
      }
    }
  );
}

export { ARTIFACT_TOOLS, configureArtifactTools };
