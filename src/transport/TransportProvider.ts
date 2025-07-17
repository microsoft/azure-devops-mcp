export interface TransportProvider {
  supports(type: string): boolean;
  create(config: any): unknown;
}
