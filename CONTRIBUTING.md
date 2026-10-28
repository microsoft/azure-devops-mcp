# Contributing to Azure DevOps MCP Server

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/microsoft/azure-devops-mcp)

Thank you for your interest in contributing to the Azure DevOps MCP Server! Your participation—whether through discussions, reporting issues, or suggesting improvements—helps us make the project better for everyone.

> 🚨 If you would like to contribute, please carefully follow the guidelines below. Pull requests that do not adhere to this process will be closed without review.

## 🏆 Expectations

As noted in the `README.md`, we aim to keep the tools in this MCP Server simple and focused on specific scenarios. If you wish to contribute or suggest new tools, please keep this in mind. We do not plan to introduce complex tools that require extensive logic. Our goal is to provide a straightforward abstraction layer over the REST API to accomplish targeted tasks.

## 🪲 Bugs and feature requests

Before submitting a new issue or suggestion, please search the existing issues to check if it has already been reported. If you find a matching issue, upvote (👍) it and consider adding a comment describing your specific scenario or requirements. This helps us prioritize based on community impact.

If your concern is not already tracked, feel free to [log a new issue](https://github.com/microsoft/azure-devops-mcp/issues). The code owners team will review your submission and may approve, request clarification, or reject it. Once approved, you can proceed with your contribution.

## 📝 Creating issues

When creating an issue:

- **DO** use a clear, descriptive title that identifies the problem or requested feature.
- **DO** provide a detailed description of the issue or feature request.
- **DO** include any relevant REST endpoints you wish to integrate with. Refer to the [public REST API documentation](https://learn.microsoft.com/en-us/rest/api/azure/devops).

For reference, see [this example of a well-formed issue](https://github.com/microsoft/azure-devops-mcp/issues/70).

## 👩‍💻 Writing code

We’re currently accepting a limited number of pull requests, provided they follow the established process and remain simple in scope. If you notice something that should be changed or added, please **create an issue first** and provide details. Once reviewed, and if it makes sense to proceed, we will respond with a 👍.

Please include tests with your pull request. Pull requests will not be accepted until all relevant tests are updated and passing.

Code formatting is enforced by CI checks. Run `npm run format` to ensure your changes comply with the rules.

### Testing

This project uses Jest with `ts-jest` for testing TypeScript code. Tests are located in the `test/` directory and mirror the structure of the `src/` directory.

#### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test test/src/utils.test.ts

# Run tests with coverage report
npm test -- --coverage
```

#### Jest Configuration

The project uses a modern Jest + ts-jest configuration:

- **jest.config.cjs**: Main Jest configuration using the modern transform array syntax
- **tsconfig.jest.json**: Test-specific TypeScript configuration that extends the base `tsconfig.json`

Key features of our test configuration:

- **isolatedModules: true** - Enabled in `tsconfig.jest.json` to eliminate ts-jest "hybrid module kind" warnings. This ensures each file is transpiled independently, which is more performant and aligns with how `ts-jest` processes files.
- **CommonJS modules** - Tests use CommonJS (`module: "CommonJS"`) to ensure compatibility with Jest's test environment.

#### Tool schema compatibility

Tool schemas use Zod 4. Use `z.toJSONSchema(schema, { io: "input", target: "draft-7" })` for input-schema assertions rather than the v3-only `zod-to-json-schema` converter.

For date parameters, reuse `dateInputSchema` from `src/shared/tool-schemas.ts`. It preserves date coercion while advertising a date-time string; bare `z.coerce.date()` cannot be converted to JSON Schema by the MCP SDK's Zod 4 converter. Use `.prefault()` when a default must pass through a transform and remain visible in the input schema.

The protocol tests in `test/src/tool-schemas.test.ts` exercise real MCP tool discovery and calls without contacting Azure DevOps. Run them when changing schemas or upgrading Zod or the MCP SDK. Zod 4 input schemas can use references for recursive values and omit `additionalProperties: false` for objects that strip unknown keys; test runtime behavior as well as schema output. Integer schemas also enforce JavaScript's safe-integer range.

## 🖊️ Coding style

Follow the established patterns and styles in the repository. If you have suggestions for improvements, please open a new issue for discussion.

## 📑 Documentation

Update relevant documentation (e.g., README, existing code comments) to reflect new or altered functionality. Well-documented changes enable reviewers and future contributors to quickly understand the rationale and intended use of your code.

## 🐛 Debugging

MCP servers use `stdio` to communicate with the client. Logs must never appear in `stdout` (which would break the protocol contract) and should be directed to `stderr` instead.

All `winston` logs in this project are automatically redirected to `stderr`. To view debug logs:

1. Set the `LOG_LEVEL` environment variable in your MCP client configuration (e.g., in your `mcp.json` file):

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

2. Alternatively, set `LOG_LEVEL` as an environment variable in your shell before starting the MCP client.

Available log levels: `error`, `warn`, `info`, `debug`.

You can examine these logs at the `output` panel under `MCP:ado` (or whatever name you used in `mcp.json` file).

## 🤝 Code of conduct

You can find our code of conduct at the [Code of Conduct](./CODE_OF_CONDUCT.md) as a guideline for expected behavior in also at the contributions here. Please take a moment to review it before contributing.
