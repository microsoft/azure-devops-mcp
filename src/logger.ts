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

  return Object.fromEntries(Object.entries(summary).filter(([, value]) => typeof value !== "undefined"));
}

export function logIncomingMcpMessage(transport: "stdio" | "http", message: JSONRPCMessage, extra?: Record<string, unknown>): void {
  logger.info("MCP request received", {
    transport,
    ...extra,
    ...summarizeMcpMessage(message),
  });
}
