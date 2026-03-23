// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import winston from "winston";
import { setLogLevel, AzureLogLevel } from "@azure/logger";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

const logLevel = process.env.LOG_LEVEL?.toLowerCase();
if (logLevel && ["verbose", "debug", "info", "warning", "error"].includes(logLevel)) {
  // Map Winston log levels to Azure log levels
  const logLevelMap: Record<string, AzureLogLevel> = {
    verbose: "verbose",
    debug: "info",
    info: "info",
    warning: "warning",
    error: "error",
  };

  const azureLogLevel: AzureLogLevel = logLevelMap[logLevel];
  setLogLevel(azureLogLevel);
}

/**
 * Logger utility for MCP server
 *
 * Since MCP servers use stdio transport for communication on stdout,
 * we log to stderr to avoid interfering with the MCP protocol.
 */

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: [
    new winston.transports.Stream({
      stream: process.stderr,
    }),
  ],
  // Prevent Winston from exiting on error
  exitOnError: false,
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getArgumentKeys(argumentsValue: unknown): string[] | undefined {
  if (!isObject(argumentsValue)) {
    return undefined;
  }

  return Object.keys(argumentsValue).sort();
}

function getObjectKeys(value: unknown): string[] | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  return Object.keys(value).sort();
}

function getContentSummary(contentValue: unknown): Record<string, unknown> {
  if (!Array.isArray(contentValue)) {
    return {};
  }

  const contentTypes = Array.from(
    new Set(
      contentValue
        .filter(isObject)
        .map((item) => item.type)
        .filter((type): type is string => typeof type === "string")
    )
  ).sort();

  return {
    contentItems: contentValue.length,
    contentTypes: contentTypes.length > 0 ? contentTypes : undefined,
  };
}

export function summarizeMcpMessage(message: JSONRPCMessage): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    jsonrpc: "jsonrpc" in message ? message.jsonrpc : undefined,
  };

  if ("id" in message) {
    summary.id = message.id;
  }

  if ("method" in message) {
    summary.method = message.method;
  }

  if ("params" in message && isObject(message.params)) {
    if (typeof message.params.name === "string") {
      summary.name = message.params.name;
    }

    if (typeof message.params.uri === "string") {
      summary.uri = message.params.uri;
    }

    if (isObject(message.params.ref) && typeof message.params.ref.type === "string") {
      summary.refType = message.params.ref.type;
    }

    const argumentKeys = getArgumentKeys(message.params.arguments);
    if (argumentKeys) {
      summary.argumentKeys = argumentKeys;
    }

    if ("task" in message.params && typeof message.params.task !== "undefined") {
      summary.hasTask = true;
    }
  }

  if ("result" in message && isObject(message.result)) {
    summary.resultKeys = getObjectKeys(message.result);

    if (typeof message.result.isError === "boolean") {
      summary.isError = message.result.isError;
    }

    Object.assign(summary, getContentSummary(message.result.content));
  }

  if ("error" in message && isObject(message.error)) {
    if (typeof message.error.code === "number") {
      summary.errorCode = message.error.code;
    }

    if (typeof message.error.message === "string") {
      summary.errorMessage = message.error.message;
    }
  }

  return Object.fromEntries(Object.entries(summary).filter(([, value]) => typeof value !== "undefined"));
}

export function logIncomingMcpMessage(transport: "stdio" | "http", message: JSONRPCMessage, extra?: Record<string, unknown>): void {
  logger.info("MCP request received", {
    transport,
    ...extra,
    ...summarizeMcpMessage(message),
  });
}

export function logOutgoingMcpMessage(transport: "stdio" | "http", message: JSONRPCMessage, extra?: Record<string, unknown>): void {
  logger.info("MCP response sent", {
    transport,
    ...extra,
    ...summarizeMcpMessage(message),
  });
}
