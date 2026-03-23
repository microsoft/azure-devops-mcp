// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { StreamableHTTPServerTransport, type StreamableHTTPServerTransportOptions } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { JSONRPCMessage, RequestId } from "@modelcontextprotocol/sdk/types.js";

import { logOutgoingMcpMessage } from "./logger.js";

export class LoggingStreamableHTTPServerTransport extends StreamableHTTPServerTransport {
  constructor(options?: StreamableHTTPServerTransportOptions) {
    super(options);
  }

  override async send(message: JSONRPCMessage, options?: { relatedRequestId?: RequestId }): Promise<void> {
    logOutgoingMcpMessage("http", message, {
      sessionId: this.sessionId,
      relatedRequestId: options?.relatedRequestId,
      payloadBytes: Buffer.byteLength(JSON.stringify(message), "utf8"),
    });

    return super.send(message, options);
  }
}
