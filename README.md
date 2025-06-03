# ⭐ Azure DevOps MCP Server

Easily install the Azure DevOps MCP Server for VS Code or VS Code Insiders:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40ado%2Fazure-devops-mcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40ado%2Fazure-devops-mcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

This TypeScript project defines the **local** MCP server for Azure DevOps, enabling you to perform a wide range of Azure DevOps tasks directly from your code editor.

> 🚨 **Public Preview:** This project is in public preview. Features and APIs may change before General Availability.

## 📄 Table of Contents

1. [📺 Overview](#-overview)
2. [⚙️ Supported Tools](#️-supported-tools)
3. [🔌 Installation & Getting Started](#-installation--getting-started)
4. [🔦 Usage](#-usage)
5. [📝 Troubleshooting](#-troubleshooting)
6. [🎩 Samples & Best Practices](#-samples--best-practices)
7. [📌 Contributing](#️-contributing)

## 📺 Overview

The Azure DevOps MCP Server brings Azure DevOps context to your agents. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Releases for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"

## ⚙️ Supported Tools

Interact with these Azure DevOps services:

### ⚒️ Core

- **ado_list_project_teams**: List teams for a project.
- **ado_list_projects**: List organization projects.
- **ado_list_team_iterations**: List iterations for a team.
- **ado_create_iterations**: Create project iterations.
- **ado_assign_iterations**: Assign iterations to a team.

### 📅 Work Items

- **ado_my_work_items**: List work items assigned to you.
- **ado_list_backlogs**: List backlogs for a project and team.
- **ado_list_backlog_work_items**: List work items for a team and backlog category.
- **ado_get_work_item**: Get a work item by ID.
- **ado_get_work_items_batch_by_ids**: Batch get work items by IDs.
- **ado_update_work_item**: Update a work item by ID.
- **ado_create_work_item**: Create a new work item.
- **ado_list_work_item_comments**: List comments for a work item.
- **ado_get_work_items_for_current_iteration**: List work items for the current iteration.
- **ado_get_work_items_for_iteration**: List work items for a specific iteration.
- **ado_add_work_item_comment**: Add a comment to a work item.
- **ado_add_child_work_item**: Create a child work item.
- **ado_update_work_item_assign**: Assign a work item.
- **ado_link_work_item_to_pull_request**: Link a work item to a pull request.
- **ado_get_work_item_type**: Get info about a work item type.
- **ado_get_query**: Get query details by ID or path.
- **ado_get_query_results_by_id**: Get query results by ID.
- **ado_update_work_items_batch**: Batch update work items.
- **ado_close_and_link_workitem_duplicates**: Close duplicate work items.

### 📁 Repositories

- **ado_list_repos_by_project**: List repositories for a project.
- **ado_list_pull_requests_by_repo**: List pull requests for a repository.
- **ado_list_pull_requests_by_project**: List pull requests for a project.
- **ado_list_branches_by_repo**: List branches for given repository.
- **ado_list_my_branches_by_repo**: List of my branches for a given repository.
- **ado_list_pull_request_threads**: List of comment threads for pull request.
- **ado_list_pull_request_thread_comments**: List of comments in a pull request thread.
- **ado_get_repo_by_id**: Get a repository by its id.
- **ado_get_repo_by_name**: Get a repository by its name.
- **ado_get_branch_by_name**: Get a branch by its name.
- **ado_get_pull_request_by_id**: Get a pull request by its id.
- **ado_create_pull_request**: Create a pull request.
- **ado_publish_pull_request**: Publish a pull request.
- **ado_abandon_pull_request**: Abandon a pull request.
- **ado_reply_to_comment**: Reply to a pull request comment.
- **ado_resolve_comment**: Resolve a pull request comment thread.

### 🛰️ Builds

- **ado_get_build_definitions**: List build definitions for a project.
- **ado_get_build_definition_revisions**: List build definition revisions.
- **ado_get_builds**: List builds for a project.
- **ado_get_build_log**: Get build logs.
- **ado_get_build_log_by_id**: Get a build log by ID.
- **ado_get_build_changes**: Get build changes.
- **ado_run_build**: Trigger a build.
- **ado_get_build_status**: Get build status.

### 🚀 Releases

- **ado_get_release_definitions**: List release definitions.
- **ado_get_releases**: List releases for a project.

### 🧪 Test Plans

- **ado_create_test_plan**: Create a test plan.
- **ado_create_test_case**: Create a test case.
- **ado_add_test_cases_to_suite**: Add test cases to a suite.
- **ado_show_test_results_from_build_id**: List test results for a build.
- **ado_list_test_cases**: List test cases in a test plan.
- **ado_list_test_plans**: List test plans by project.
- **ado_create_test_suite**: Creates a new test suite in a test plan.
- **ado_list_test_cases_in_test_suite**: Gets a detailed list of test cases in a test suite with filtering options.
- **ado_list_test_suites**: Gets a list of test suites for a test plan.
- **ado_update_test_case**: Updates an existing test case work item.
- **ado_update_test_suite**: Updates an existing test suite.
- **ado_update_test_plan**: Updates an existing test plan.

### 📄 Wiki

- **ado_list_wikis**: List wikis for an organization or project.
- **ado_get_wiki**: Get a wiki by identifier.
- **ado_list_wiki_pages**: List wiki pages.
- **ado_get_wiki_page**: Get a wiki page by identifier and path.

### 🔎 Search

- **ado_code_search**: Search code.
- **ado_wiki_search**: Search wikis.
- **ado_workitem_search**: Search work items.

## 🔌 Installation & Getting Started

Clone the repository, install dependencies, and add it to your MCP client configuration.

### Visual Studio Code & GitHub Copilot

For the best experience, use Visual Studio Code and GitHub Copilot.

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 20+
3. Open VS Code in an empty folder

### Azure Login

Ensure you are logged in to Azure DevOps via the Azure CLI:

```sh
az login
```

### Installation

#### ✨ One-Click Install

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40ado%2Fazure-devops-mcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40ado%2Fazure-devops-mcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

After installation, select GitHub Copilot Agent Mode and refresh the tools list. Learn more about Agent Mode in the [VS Code Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

#### 🎮 Codespace

Launch in a GitHub Codespace:

[![Open in GitHub Codespaces]](update_link)

#### 🛠️ Manual Install

1. Clone the repository.
2. Install dependencies:
   ```sh
   npm install
   npm install -g .
   ```
3. Edit or add `.vscode/mcp.json`:

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
            "command": "mcp-server-azuredevops",
            "args": ["${input:ado_org}"]
        }
     }
   }
   ```

4. Start the Azure DevOps MCP Server:

   <img src="./docs/media/start-mcp-server.gif" alt="start mcp server" width="250"/>

   Enter your Azure DevOps organization name (e.g. `contoso`).

5. In chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
6. Click "Select Tools" and choose the available `ado_` tools.

   <img src="./docs/media/configure-mcp-server-tools.gif" alt="configure mcp server tools" width="300"/>

#### Placeholder for Public Feed

Update for Public Feed

## 🔦 Usage

### Visual Studio Code + GitHub Copilot

1. Open GitHub Copilot in VS Code and switch to Agent mode.
2. Start the Azure DevOps MCP Server.
3. The server appears in the tools list.
4. Try prompts like "List ADO projects".

### Visual Studio + GitHub Copilot

> *Prerequisites:* Visual Studio 2022 v17.14+, Agent mode enabled in Tools > Options > GitHub > Copilot > Copilot Chat.

1. Switch to Agent mode in the Copilot Chat window.
2. Enter your Azure DevOps organization name.
3. Select desired `ado` tools.
4. Try prompts like "List ADO projects".

For more details, see [Visual Studio MCP Servers documentation](https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022) and [Getting Started Video](https://www.youtube.com/watch?v=oPFecZHBCkg).

## 📝 Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## 🎩 Samples & Best Practices

Find sample prompts and best practices in our [How-to Guide](./docs/HOWTO.md).

## 📌 Contributing

We welcome contributions! During preview, please file Issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

 - 🛠️ Development setup
 - ✨ Adding new tools
 - 📝 Code style & testing
 - 🔄 Pull request process

## 🤝 Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
