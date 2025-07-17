import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TransportProvider } from "transport/TransportProvider.js";

export class HttpTransportProvider implements TransportProvider {
  supports(type: string): boolean {
    return type === "httpStreamable";
  }

  create(_config: any): StreamableHTTPServerTransport {
    return new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // set to undefined for stateless servers
    });
  }
}
