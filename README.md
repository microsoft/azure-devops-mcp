# Azure DevOps MCP Server

> [!WARNING]
> We recently completed a full tool consolidation that includes renaming of existing tools. Please see the [Toolset documentation](docs/TOOLSET.md) for the complete list of new tool names.
>
> If this is a breaking change for your agents or skills, you can temporarily pin the version to `@azure-devops/mcp@2.8.1`

This project gives AI agents access to Azure DevOps through the Model Context Protocol (MCP). Use the hosted remote server for the simplest setup, or run the local server when you need a `stdio` connection.

## Table of Contents

> [!IMPORTANT]
> We recommend using the [Remote MCP Server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) instead of this local server. It requires no installation and gets new features first.
>
> [Learn more](#remote-mcp-server-recommended)

1. [Overview](#overview)
2. [Design](#design)
3. [Remote MCP Server (Recommended)](#remote-mcp-server-recommended)
4. [Supported Tools](#supported-tools)
5. [Local MCP Server Installation (Optional)](#local-mcp-server-installation-optional)
6. [Using Domains (Local Server)](#using-domains-local-server)
7. [Project and Team Defaults (Local Server)](#project-and-team-defaults-local-server)
8. [Troubleshooting](#troubleshooting)
9. [Examples and Best Practices](#examples-and-best-practices)
10. [Frequently Asked Questions](#frequently-asked-questions)
11. [Contributing](#contributing)

## Overview

The Azure DevOps MCP Server brings Azure DevOps context to your agents. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"
- "List all wikis in the 'Contoso' project"
- "Create a wiki page '/Architecture/Overview' with content about system design"
- "Update the wiki page '/Getting Started' with new onboarding instructions"
- "Get the content of the wiki page '/API/Authentication' from the Documentation wiki"

## Design

Each tool handles a focused Azure DevOps task. The server provides a thin layer over the REST APIs, while the AI agent handles higher-level reasoning.

## Remote MCP Server (Recommended)

For complete instructions, see the [Remote MCP Server onboarding documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops).

The remote server will eventually replace the local server. The local server remains supported, but new development will focus on the remote server. Existing local server users should begin planning their migration.

If you encounter issues with tools, need support, or have a feature request, you can report an issue using the [Remote MCP Server issue template](https://github.com/microsoft/azure-devops-mcp/issues/new?template=remote-mcp-server-issue.md). During the preview period, we will track Remote MCP Server issues through this repository.

### Quick Start

Create `.vscode/mcp.json` in your project and add this configuration. Replace `{organization}` with your Azure DevOps organization name.

```json
{
  "servers": {
    "ado-remote-mcp": {
      "url": "https://mcp.dev.azure.com/{organization}",
      "type": "http"
    }
  },
  "inputs": []
}
```

See the [remote server configuration documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#mcpjson-configuration) for more options.

After saving `.vscode/mcp.json`, start the server from the MCP view in VS Code, then run a prompt like `List ADO projects`.

## Supported Tools

See the [Available Tools](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#available-tools) documentation for the complete list of available remote tools.

For the complete list of local tools, see [TOOLSET.md](./docs/TOOLSET.md).

## Local MCP Server Installation (Optional)

> [!IMPORTANT]
> Start with the Remote MCP Server first. Use the local MCP Server only if your scenario specifically requires a local `stdio` setup.

These steps use Visual Studio Code and GitHub Copilot. For other supported clients, including Visual Studio 2022, Codex, Claude Code, Cursor, OpenCode, and Kilo Code, see the [getting started guide](./docs/GETTINGSTARTED.md).

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders).
2. Install [Node.js 20 or later](https://nodejs.org/en/download).
3. Open your project in VS Code.

### Installation

#### Install from npm

🎥 [Watch this quick start video to get up and running in under two minutes!](https://youtu.be/EUmFM6qXoYk)

1. Create `.vscode/mcp.json` in your project.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}"]
    }
  }
}
```

3. Save the file, then start the `ado` server from the MCP view in VS Code.
4. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
5. Select the Azure DevOps tools, then try a prompt such as `List ADO projects`.
6. When prompted, sign in with a Microsoft account that has access to the selected Azure DevOps organization.

To use nightly builds, replace `@azure-devops/mcp` with `@azure-devops/mcp@next` in the configuration.

For better tool selection, add `.github/copilot-instructions.md` to your project with this instruction:

```text
This project uses Azure DevOps. Always check whether the Azure DevOps MCP server has a tool relevant to the user's request.
```

## Using Domains (Local Server)

The local server includes many tools. Domains let you load only the tool groups you need, which keeps the tool list manageable and helps clients with tool limits. Available domains are `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, and `advanced-security`.

Add `-d` followed by the domains to the server arguments. For example, this configuration loads only work item-related tools:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado_with_filtered_domains": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "-d", "core", "work", "work-items"]
    }
  }
}
```

Always include `core` so the agent can retrieve project information.

> If you omit `-d`, the server loads all domains.

## Project and Team Defaults (Local Server)

Set default Azure DevOps project and team values in `.vscode/mcp.json` so tools can skip selection prompts.

### Example `.vscode/mcp.json`

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "myorg", "--authentication", "azcli"],
      "env": {
        "ado_mcp_project": "Contoso",
        "ado_mcp_team": "Fabrikam Team"
      }
    }
  }
}
```

## Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## Examples

See the [examples](./docs/EXAMPLES.md) for sample prompts.

## Frequently Asked Questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## Contributing

We welcome contributions. During preview, file issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

- Development setup
- Adding new tools
- Code style and testing
- Pull request process

Read the [Contributions Guide](./CONTRIBUTING.md) before creating a pull request.

## Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## Hall of Fame

Thanks to all contributors who make this project awesome! ❤️

[![Contributors](https://contrib.rocks/image?repo=microsoft/azure-devops-mcp)](https://github.com/microsoft/azure-devops-mcp/graphs/contributors)

> Generated with [contrib.rocks](https://contrib.rocks)

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
