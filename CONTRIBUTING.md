# Contributing to Azure DevOps MCP Server

Thank you for your interest in contributing to the Azure DevOps MCP Server! Your participation—whether through discussions, reporting issues, or suggesting improvements—helps us make the project better for everyone.

## 🪲 Bugs and feature requests

Before submitting a new issue or suggestion, please search the existing issues to check if it has already been reported. If you find a matching issue, upvote (👍) it and consider adding a comment describing your specific scenario or requirements. This helps us prioritize based on community impact.

If your concern is not already tracked, feel free to [log a new issue](https://github.com/microsoft/azure-devops-mcp/issues). The code owners team will review your submission and may approve, request clarification, or reject it. Once approved, you can proceed with your contribution.

## 📝 Creating issues

When creating an issue:

- **DO** use a clear, descriptive title that identifies the problem or requested feature.
- **DO** provide a detailed description of the issue or feature request.
- **DO** include any relevant REST endpoints you wish to integrate with. Refer to the [public REST API documentation](https://learn.microsoft.com/en-us/rest/api/azure/devops).

For reference, see [this example of a well-formed issue](<repo>_issues/41).

## 👩‍💻 Writing code

We are **not currently accepting pull requests** during the public preview phase. If you notice something that should be changed or added, please create an issue and provide details.

## 🖊️ Coding style

Follow the established patterns and styles in the repository. If you have suggestions for improvements, please open a new issue for discussion.

## 📑 Documentation

Update relevant documentation (e.g., README, existing code comments) to reflect new or altered functionality. Well-documented changes enable reviewers and future contributors to quickly understand the rationale and intended use of your code.

## 🛠️ Development setup

For contributors working on the codebase, follow these development-specific guidelines:

### Local development environment

You should open this project in local Visual Studio Code so that the authentication works well.
You can do this from within this web interface.

You can contribute to our server in the matter of minutes.
Simply ask GitHub Copilot to add the tools you want by referencing a specific Azure DevOps REST API resource you want to use.
This repository contains the instructions for the GitHub Copilot to operate effectively, so don't worry about the prompt specifics.

### Testing your work

You should use MCP Server Inspector to check whether your contribution works correctly in isolation.
You can run `npm run inspect` which will bring up the MCP server inspector web interface.
This is by far the most convenient way of evaluating our MCP server behavior without running actual completions.
Just navigate to `http://localhost:5173` to use it.

Then, you should validate it with in a MCP client. The easiest way is just to open GitHub Copilot and select the right set of tools.
Remember to open the file `.vscode/mcp.json` and press restart icon after you make your changes for them to be available in GitHub Copilot!

#### Manual inspection

You can also make requests to the MCP server directly, if you wish:

##### Check the tools exposed by this server

`echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npx -y mcp-server-azuredevops buildcanary | jq`

##### Check the resources exposed by this server

`echo '{"jsonrpc":"2.0","method":"resources/list","id":3}' | npx -y mcp-server-azuredevops buildcanary | jq`

##### Check the prompts exposed by this server

`echo '{"jsonrpc":"2.0","method":"prompts/list","id":3}' | npx -y mcp-server-azuredevops buildcanary | jq`

## 🤝 Code of conduct

You can find our code of conduct at the [Code of Conduct](./CODE_OF_CONDUCT.md) as a guideline for expected behavior in also at the contributions here. Please take a moment to review it before contributing.