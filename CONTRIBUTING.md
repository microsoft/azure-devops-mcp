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

We are accepting a limited number of pull requests during the public preview phase. If you notice something that should be changed or added, please create an issue first and provide details. Once reviewed, and if it makes sense to proceed, we will respond with a 👍.

Please include tests with your pull request. Pull requests will not be accepted until all relevant tests are updated and passing.

Code formatting is enforced by CI checks. Run `npm run format` to ensure your changes comply with the rules.

## 🖊️ Coding style

Follow the established patterns and styles in the repository. If you have suggestions for improvements, please open a new issue for discussion.

## 📑 Documentation

Update relevant documentation (e.g., README, existing code comments) to reflect new or altered functionality. Well-documented changes enable reviewers and future contributors to quickly understand the rationale and intended use of your code.

## 🤝 Code of conduct

You can find our code of conduct at the [Code of Conduct](./CODE_OF_CONDUCT.md) as a guideline for expected behavior in also at the contributions here. Please take a moment to review it before contributing.
