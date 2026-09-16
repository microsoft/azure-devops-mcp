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
  // Set just below the level the suite actually reaches, so a regression fails
  // CI instead of silently eroding coverage. Raise these as coverage improves.
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 94,
      lines: 88,
      statements: 86,
    },
  },

  // Module file extensions for importing
  moduleFileExtensions: ["ts", "js"],

  // Transform settings for ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
      },
    ],
  },

  moduleNameMapper: {
    "^(.+)/version\\.js$": "$1/version.ts",
    "^(.+)/utils\\.js$": "$1/utils.ts",
    "^(.+)/auth\\.js$": "$1/auth.ts",
    "^(.+)/logger\\.js$": "$1/logger.ts",
    "^(.+)/elicitations\\.js$": "$1/elicitations.ts",
    "^(.+)/content-safety\\.js$": "$1/content-safety.ts",
    "^(.+)/tool-registration\\.js$": "$1/tool-registration.ts",
    "^(.+)/ado-rest\\.js$": "$1/ado-rest.ts",
    "^(.+)/state-store\\.js$": "$1/state-store.ts",
    "^(.+)/table-state-store\\.js$": "$1/table-state-store.ts",
    "^(.+)/presets\\.js$": "$1/presets.ts",
    "^(.+)/common-params\\.js$": "$1/common-params.ts",
    "^(.+)/server-instructions\\.js$": "$1/server-instructions.ts",
    "^(.+)/domains\\.js$": "$1/domains.ts",
  },
};
