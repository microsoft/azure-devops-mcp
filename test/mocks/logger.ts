// Mock logger for Jest tests
// Avoids importing @azure/logger (ESM) in CommonJS test environment
export const logger = {
  info: (..._args: any[]) => {},
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  debug: (..._args: any[]) => {},
};
