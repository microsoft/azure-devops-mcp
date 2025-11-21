// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import winston from "winston";

/**
 * Logger utility for MCP server
 *
 * Since MCP servers use stdio transport for communication on stdout,
 * we log to stderr to avoid interfering with the MCP protocol.
 */

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Stream({
      stream: process.stderr,
    }),
  ],
  // Prevent Winston from exiting on error
  exitOnError: false,
});
