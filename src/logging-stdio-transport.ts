// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import process from "node:process";
import type { Readable, Writable } from "node:stream";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { logIncomingMcpMessage } from "./logger.js";

export class LoggingStdioServerTransport {
  private readonly readBuffer = new ReadBuffer();
  private started = false;

  constructor(
    private readonly stdin: Readable = process.stdin,
    private readonly stdout: Writable = process.stdout
  ) {}

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private readonly onData = (chunk: Buffer) => {
    this.readBuffer.append(chunk);
    this.processReadBuffer();
  };

  private readonly onError = (error: Error) => {
    this.onerror?.(error);
  };

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("LoggingStdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }

    this.started = true;
    this.stdin.on("data", this.onData);
    this.stdin.on("error", this.onError);
  }

  private processReadBuffer(): void {
    while (true) {
      try {
        const message = this.readBuffer.readMessage();
        if (message === null) {
          break;
        }

        logIncomingMcpMessage("stdio", message);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }
  }

  async close(): Promise<void> {
    this.stdin.off("data", this.onData);
    this.stdin.off("error", this.onError);

    const remainingDataListeners = this.stdin.listenerCount("data");
    if (remainingDataListeners === 0) {
      this.stdin.pause();
    }

    this.readBuffer.clear();
    this.onclose?.();
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve) => {
      const json = serializeMessage(message);
      if (this.stdout.write(json)) {
        resolve();
      } else {
        this.stdout.once("drain", resolve);
      }
    });
  }
}
