import { StdioTransportProvider } from "./providers/stdio.provider.js";
import { HttpTransportProvider } from "./providers/http.provider.js";
import { TransportProvider } from "./TransportProvider.js";

export const transportProviders: TransportProvider[] = [
  new StdioTransportProvider(),
  new HttpTransportProvider(),
];
