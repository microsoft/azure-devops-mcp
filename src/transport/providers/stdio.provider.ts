import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TransportProvider } from "transport/TransportProvider.js";

export class StdioTransportProvider implements TransportProvider {
  supports(type: string): boolean {
    return type === "stdio";
  }

  create(_config: any): StdioServerTransport {
    return new StdioServerTransport();
  }
}
