module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: "ts-jest",

  // Specify the test environment (node for backend projects)
  testEnvironment: "node",

  // Root directory for test files
  roots: ["<rootDir>/test"],

  // Glob patterns for test files
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Collect code coverage information
  collectCoverage: true,

  // Output directory for coverage reports
  coverageDirectory: "coverage",

  // Coverage report formats
  coverageReporters: ["text", "lcov", "json-summary"],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },

  // Module file extensions for importing
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],

  // Transform settings for ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
        diagnostics: { ignoreDiagnostics: ["1343"] },
        astTransformers: {
          before: [
            {
              path: "ts-jest-import-meta-transformer.cjs",
            },
          ],
        },
      },
    ],
  },

  moduleNameMapper: {
    // Mock ext-apps/server for CommonJS test compatibility
    "^@modelcontextprotocol/ext-apps/server$": "<rootDir>/test/mocks/mcp-apps/ext-apps-server.ts",
    "^(.+)/version\\.js$": "$1/version.ts",
    "^(.+)/utils\\.js$": "$1/utils.ts",
    "^(.+)/auth\\.js$": "$1/auth.ts",
    "^(.+)/logger\\.js$": "$1/logger.ts",
    "^(.+)/work-item-filters\\.js$": "$1/work-item-filters.ts",
    "^(.+)/elicitations\\.js$": "$1/elicitations.ts",
    "^(.+)/content-safety\\.js$": "$1/content-safety.ts",
    // Apps module mocks for React component testing
    "@modelcontextprotocol/ext-apps/react$": "<rootDir>/test/mocks/mcp-apps/ext-apps-react.ts",
    "^@modelcontextprotocol/ext-apps$": "<rootDir>/test/mocks/mcp-apps/ext-apps.ts",
    "^react-quill-new$": "<rootDir>/test/mocks/mcp-apps/react-quill-new.tsx",
    "\\.css$": "<rootDir>/test/mocks/mcp-apps/style-mock.ts",
  },
};
