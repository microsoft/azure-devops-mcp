module.exports = {
  // Use ts-jest preset for TypeScript support with ES modules
  preset: "ts-jest/presets/default-esm",

  // Specify the test environment (node for backend projects)
  testEnvironment: "node",

  // Enable ES modules
  extensionsToTreatAsEsm: [".ts"],

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
  moduleFileExtensions: ["ts", "js"],

  // Transform settings for ts-jest with ESM support
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "esnext",
        },
      },
    ],
  },

  // Module name mapping for .js imports to .ts files
  moduleNameMapper: {
    "^(.+)/version\\.js$": "$1/version.ts",
    "^(.+)/utils\\.js$": "$1/utils.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
};
