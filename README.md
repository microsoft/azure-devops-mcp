# ⭐ Azure DevOps MCP Server

Easily install the Azure DevOps MCP Server for VS Code or VS Code Insiders:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

This TypeScript project provides a **local** MCP server for Azure DevOps, enabling you to perform a wide range of Azure DevOps tasks directly from your code editor.

## 📄 Table of Contents

1. [📺 Overview](#-overview)
2. [🏆 Expectations](#-expectations)
3. [⚙️ Supported Tools](#️-supported-tools)
4. [🔌 Installation & Getting Started](#-installation--getting-started)
5. [🌏 Using Domains](#-using-domains)
6. [📖 Read-Only Mode](#-read-only-mode)
7. [📝 Troubleshooting](#-troubleshooting)
8. [🎩 Examples & Best Practices](#-examples--best-practices)
9. [🙋‍♀️ Frequently Asked Questions](#️-frequently-asked-questions)
10. [📌 Contributing](#-contributing)

## 📺 Overview

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

## 🏆 Expectations

The Azure DevOps MCP Server is built from tools that are concise, simple, focused, and easy to use—each designed for a specific scenario. We intentionally avoid complex tools that try to do too much. The goal is to provide a thin abstraction layer over the REST APIs, making data access straightforward and letting the language model handle complex reasoning.

## ⚙️ Supported Tools

Interact with these Azure DevOps services:

### 🧿 Core

- **core_list_project_teams**: Retrieve a list of teams for the specified Azure DevOps project.
- **core_list_projects**: Retrieve a list of projects in your Azure DevOps organization.
- **core_get_identity_ids**: Retrieve Azure DevOps identity IDs for a list of unique names.

### ⚒️ Work

- **work_list_team_iterations**: Retrieve a list of iterations for a specific team in a project.
- **work_create_iterations**: Create new iterations in a specified Azure DevOps project.
- **work_assign_iterations**: Assign existing iterations to a specific team in a project.

### 📅 Work Items

- **wit_my_work_items**: Retrieve a list of work items relevant to the authenticated user.
- **wit_list_backlogs**: Retrieve a list of backlogs for a given project and team.
- **wit_list_backlog_work_items**: Retrieve a list of backlogs for a given project, team, and backlog category.
- **wit_get_work_item**: Get a single work item by ID.
- **wit_get_work_items_batch_by_ids**: Retrieve a list of work items by IDs in batch.
- **wit_update_work_item**: Update a work item by ID with specified fields.
- **wit_create_work_item**: Create a new work item in a specified project and work item type.
- **wit_list_work_item_comments**: Retrieve a list of comments for a work item by ID.
- **wit_get_work_items_for_iteration**: Retrieve a list of work items for a specified iteration.
- **wit_add_work_item_comment**: Add a comment to a work item by ID.
- **wit_add_child_work_items**: Create one or more child work items of a specific work item type for the given parent ID.
- **wit_link_work_item_to_pull_request**: Link a single work item to an existing pull request.
- **wit_get_work_item_type**: Get a specific work item type.
- **wit_get_query**: Get a query by its ID or path.
- **wit_get_query_results_by_id**: Retrieve the results of a work item query given the query ID.
- **wit_update_work_items_batch**: Update work items in batch.
- **wit_work_items_link**: Link work items together in batch.
- **wit_work_item_unlink**: Unlink one or many links from a work item.
- **wit_add_artifact_link**: Link to artifacts like branch, pull request, commit, and build.

### 📁 Repositories

- **repo_list_repos_by_project**: Retrieve a list of repositories for a given project.
- **repo_list_pull_requests_by_repo_or_project**: Retrieve a list of pull requests for a given repository or project.
- **repo_list_branches_by_repo**: Retrieve a list of branches for a given repository.
- **repo_list_my_branches_by_repo**: Retrieve a list of your branches for a given repository ID.
- **repo_list_pull_requests_by_commits**: List pull requests associated with commits.
- **repo_list_pull_request_threads**: Retrieve a list of comment threads for a pull request.
- **repo_list_pull_request_thread_comments**: Retrieve a list of comments in a pull request thread.
- **repo_get_repo_by_name_or_id**: Get the repository by project and repository name or ID.
- **repo_get_branch_by_name**: Get a branch by its name.
- **repo_get_pull_request_by_id**: Get a pull request by its ID.
- **repo_create_pull_request**: Create a new pull request.
- **repo_create_branch**: Create a new branch in the repository.
- **repo_update_pull_request**: Update various fields of an existing pull request (title, description, draft status, target branch).
- **repo_update_pull_request_reviewers**: Add or remove reviewers for an existing pull request.
- **repo_reply_to_comment**: Replies to a specific comment on a pull request.
- **repo_resolve_comment**: Resolves a specific comment thread on a pull request.
- **repo_search_commits**: Searches for commits.
- **repo_create_pull_request_thread**: Creates a new comment thread on a pull request.

### 🚀 Pipelines

- **pipelines_get_build_definitions**: Retrieve a list of build definitions for a given project.
- **pipelines_get_build_definition_revisions**: Retrieve a list of revisions for a specific build definition.
- **pipelines_get_builds**: Retrieve a list of builds for a given project.
- **pipelines_get_build_log**: Retrieve the logs for a specific build.
- **pipelines_get_build_log_by_id**: Get a specific build log by log ID.
- **pipelines_get_build_changes**: Get the changes associated with a specific build.
- **pipelines_get_build_status**: Fetch the status of a specific build.
- **pipelines_update_build_stage**: Update the stage of a specific build.
- **pipelines_get_run**: Gets a run for a particular pipeline.
- **pipelines_list_runs**: Gets top 10000 runs for a particular pipeline.
- **pipelines_run_pipeline**: Starts a new run of a pipeline.

### Advanced Security

- **advsec_get_alerts**: Retrieve Advanced Security alerts for a repository.
- **advsec_get_alert_details**: Get detailed information about a specific Advanced Security alert.

### 🧪 Test Plans

- **testplan_create_test_plan**: Create a new test plan in the project.
- **testplan_create_test_case**: Create a new test case work item.
- **testplan_update_test_case_steps**: Update an existing test case work item's steps.
- **testplan_add_test_cases_to_suite**: Add existing test cases to a test suite.
- **testplan_list_test_plans**: Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.
- **testplan_list_test_cases**: Get a list of test cases in the test plan.
- **testplan_show_test_results_from_build_id**: Get a list of test results for a given project and build ID.
- **testplan_create_test_suite**: Creates a new test suite in a test plan.

### 📖 Wiki

- **wiki_list_wikis**: Retrieve a list of wikis for an organization or project.
- **wiki_get_wiki**: Get the wiki by wikiIdentifier.
- **wiki_list_pages**: Retrieve a list of wiki pages for a specific wiki and project.
- **wiki_get_page**: Retrieve wiki page metadata by path.
- **wiki_get_page_content**: Retrieve wiki page content by wikiIdentifier and path.
- **wiki_create_or_update_page**: Create or update wiki pages with full content support.

### 🔎 Search

- **search_code**: Get code search results for a given search text.
- **search_wiki**: Get wiki search results for a given search text.
- **search_workitem**: Get work item search results for a given search text.

## 🔌 Installation & Getting Started

For the best experience, use Visual Studio Code and GitHub Copilot. See the [getting started documentation](./docs/GETTINGSTARTED.md) to use our MCP Server with other tools such as Visual Studio 2022, Claude Code, and Cursor.

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 20+
3. Open VS Code in an empty folder

### Installation

#### ✨ One-Click Install

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

After installation, select GitHub Copilot Agent Mode and refresh the tools list. Learn more about Agent Mode in the [VS Code Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

#### 🧨 Install from Public Feed (Recommended)

This installation method is the easiest for all users of Visual Studio Code.

🎥 [Watch this quick start video to get up and running in under two minutes!](https://youtu.be/EUmFM6qXoYk)

##### Steps

In your project, add a `.vscode\mcp.json` file with the following content:

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

🔥 To stay up to date with the latest features, you can use our nightly builds. Simply update your `mcp.json` configuration to use `@azure-devops/mcp@next`. Here is an updated example:

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
      "args": ["-y", "@azure-devops/mcp@next", "${input:ado_org}"]
    }
  }
}
```

Save the file, then click 'Start'.

![start mcp server](./docs/media/start-mcp-server.gif)

In chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).

Click "Select Tools" and choose the available tools.

![configure mcp server tools](./docs/media/configure-mcp-server-tools.gif)

Open GitHub Copilot Chat and try a prompt like `List ADO projects`. The first time an ADO tool is executed browser will open prompting to login with your Microsoft account. Please ensure you are using credentials matching selected Azure DevOps organization.

> 💥 We strongly recommend creating a `.github\copilot-instructions.md` in your project. This will enhance your experience using the Azure DevOps MCP Server with GitHub Copilot Chat.
> To start, just include "`This project uses Azure DevOps. Always check to see if the Azure DevOps MCP server has a tool relevant to the user's request`" in your copilot instructions file.

See the [getting started documentation](./docs/GETTINGSTARTED.md) to use our MCP Server with other tools such as Visual Studio 2022, Claude Code, and Cursor.

## 🌏 Using Domains

Azure DevOps exposes a large surface area. As a result, our Azure DevOps MCP Server includes many tools. To keep the toolset manageable, avoid confusing the model, and respect client limits on loaded tools, use Domains to load only the areas you need. Domains are named groups of related tools (for example: core, work, work-items, repositories, wiki). Add the `-d` argument and the domain names to the server args in your `mcp.json` to list the domains to enable.

For example, use `"-d", "core", "work", "work-items"` to load only Work Item related tools (see the example below).

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

Domains that are available are: `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, `advanced-security`

We recommend that you always enable `core` tools so that you can fetch project level information.

> By default all domains are loaded

## 📖 Read-Only Mode

For environments where you want to prevent any modifications to your Azure DevOps resources, use the `--read-only` flag. This mode exposes only read-only tools (like listing projects, getting work items, viewing pull requests) while hiding all tools that create, update, or delete data.

Add the `--read-only` argument to the server args in your `mcp.json`:

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
    "ado_readonly": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_org}", "--read-only"]
    }
  }
}
```

## 📝 Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## 🎩 Examples & Best Practices

Explore example prompts in our [Examples documentation](./docs/EXAMPLES.md).

For best practices and tips to enhance your experience with the MCP Server, refer to the [How-To guide](./docs/HOWTO.md).

## 🙋‍♀️ Frequently Asked Questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## 📌 Contributing

We welcome contributions! During preview, please file issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

- 🛠️ Development setup
- ✨ Adding new tools
- 📝 Code style & testing
- 🔄 Pull request process

## 🤝 Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## 📈 Project Stats

[![Star History Chart](https://api.star-history.com/svg?repos=microsoft/azure-devops-mcp&type=Date)](https://star-history.com/#microsoft/azure-devops-mcp)

## 🏆 Hall of Fame

Thanks to all contributors who make this project awesome! ❤️

[![Contributors](https://contrib.rocks/image?repo=microsoft/azure-devops-mcp)](https://github.com/microsoft/azure-devops-mcp/graphs/contributors)

> Generated with [contrib.rocks](https://contrib.rocks)

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
