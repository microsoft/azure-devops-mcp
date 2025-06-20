# ⭐ Azure DevOps MCP Server

Easily install the Azure DevOps MCP Server for VS Code or VS Code Insiders:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

This TypeScript project defines the **local** MCP server for Azure DevOps, enabling you to perform a wide range of Azure DevOps tasks directly from your code editor.

> 🚨 **Public Preview:** This project is in public preview. You can expect that the tools will change before general availability.

## 📄 Table of contents

1. [📺 Overview](#-overview)
2. [⚙️ Supported tools](#️-supported-tools)
3. [🔌 Installation & getting started](#-installation--getting-started)
4. [🔦 Usage](#-usage)
5. [📝 Troubleshooting](#-troubleshooting)
6. [🎩 Samples & best practices](#-samples--best-practices)
7. [🙋‍♀️ Frequently asked questions](#️-frequently-asked-questions)
8. [📌 Contributing](#️-contributing)

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

## ⚙️ Supported tools

Interact with these Azure DevOps services:

### 🧿 Core

- **core_list_project_teams**: Retrieve a list of teams for the specified Azure DevOps project.
- **core_list_projects**: Retrieve a list of projects in your Azure DevOps organization.

### ⚒️ Work

- **work_list_team_iterations**: Retrieve a list of iterations for a specific team in a project.
- **work_create_iterations**: Create new iterations in a specified Azure DevOps project.
- **work_assign_iterations**: Assign existing iterations to a specific team in a project.

### 📅 Work Items

- **wit_my_work_items**: Retrieve a list of work items relevent to the authenticated user.
- **wit_list_backlogs**: Revieve a list of backlogs for a given project and team.
- **wit_list_backlog_work_items**: Retrieve a list of backlogs of for a given project, team, and backlog category.
- **wit_get_work_item**: Get a single work item by ID.
- **wit_get_work_items_batch_by_ids**: Retrieve list of work items by IDs in batch.
- **wit_update_work_item**: Update a work item by ID with specified fields.
- **wit_create_work_item**: Create a new work item in a specified project and work item type.
- **wit_list_work_item_comments**: Retrieve list of comments for a work item by ID.
- **wit_get_work_items_for_iteration**: Retrieve a list of work items for a specified iteration.
- **wit_add_work_item_comment**: Add comment to a work item by ID.
- **wit_add_child_work_item**: Create a child work item from a parent by ID.
- **wit_link_work_item_to_pull_request**: Link a single work item to an existing pull request.
- **wit_get_work_item_type**: Get a specific work item type.
- **wit_get_query**: Get a query by its ID or path.
- **wit_get_query_results_by_id**: Retrieve the results of a work item query given the query ID.
- **wit_update_work_items_batch**: Update work items in batch.
- **wit_close_and_link_workitem_duplicates**: Close duplicate work items by id.
- **wit_work_items_link**: Link work items together in batch.

### 📁 Repositories

- **repo_list_repos_by_project**: Retrieve a list of repositories for a given project.
- **repo_list_pull_requests_by_repo**: Retrieve a list of pull requests for a given repository.
- **repo_list_pull_requests_by_project**: Retrieve a list of pull requests for a given project Id or Name.
- **repo_list_branches_by_repo**: Retrieve a list of branches for a given repository.
- **repo_list_my_branches_by_repo**: Retrieve a list of my branches for a given repository Id.
- **repo_list_pull_request_threads**: Retrieve a list of comment threads for a pull request.
- **repo_list_pull_request_thread_comments**: Retrieve a list of comments in a pull request thread.
- **repo_get_repo_by_name_or_id**: Get the repository by project and repository name or ID.
- **repo_get_branch_by_name**: Get a branch by its name.
- **repo_get_pull_request_by_id**: Get a pull request by its ID.
- **repo_create_pull_request**: Create a new pull request.
- **repo_update_pull_request_status**: Update status of an existing pull request to active or abandoned.
- **repo_reply_to_comment**: Replies to a specific comment on a pull request.
- **repo_resolve_comment**: Resolves a specific comment thread on a pull request.

### 🛰️ Builds

- **build_get_definitions**: Retrieves a list of build definitions for a given project.
- **build_get_definition_revisions**: Retrieves a list of revisions for a specific build definition.
- **build_get_builds**: Retrieves a list of builds for a given project.
- **build_get_log**: Retrieves the logs for a specific build.
- **build_get_log_by_id**: Get a specific build log by log ID.
- **build_get_changes**: Get the changes associated with a specific build.
- **build_run_build**: Triggers a new build for a specified definition.
- **build_get_status**: Fetches the status of a specific build.

### 🚀 Releases

- **release_get_definitions**: Retrieves list of release definitions for a given project.
- **release_get_releases**: Retrieves a list of releases for a given project.

### 🧪 Test Plans

- **testplan_create_test_plan**: Creates a new test plan in the project.
- **testplan_create_test_case**: Creates a new test case work item.
- **testplan_add_test_cases_to_suite**: Adds existing test cases to a test suite.
- **testplan_list_test_plans**: Retrieve a paginated list of test plans from an Azure DevOps project. Allows filtering for active plans and toggling detailed information.
- **testplan_list_test_cases**: Gets a list of test cases in the test plan.
- **testplan_show_test_results_from_build_id**: Gets a list of test results for a given project and build ID.

### 🔎 Search

- **search_code**: Get the code search results for a given search text.
- **search_wiki**: Get wiki search results for a given search text.
- **search_workitem**: Get work item search results for a given search text.

## 🔌 Installation & getting started

Clone the repository, install dependencies, and add it to your MCP client configuration.

### Visual Studio Code & GitHub Copilot

For the best experience, use Visual Studio Code and GitHub Copilot.

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 20+
3. Install [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)
4. Open VS Code in an empty folder

### Azure Login

Ensure you are logged in to Azure DevOps via the Azure CLI:

```sh
az login
```

### Installation

#### ✨ One-Click install

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_AzureDevops_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)
[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_AzureDevops_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ado&quality=insiders&config=%7B%20%22type%22%3A%20%22stdio%22%2C%20%22command%22%3A%20%22npx%22%2C%20%22args%22%3A%20%5B%22-y%22%2C%20%22%40azure-devops%2Fmcp%22%2C%20%22%24%7Binput%3Aado_org%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%20%22ado_org%22%2C%20%22type%22%3A%20%22promptString%22%2C%20%22description%22%3A%20%22Azure%20DevOps%20organization%20name%20%20%28e.g.%20%27contoso%27%29%22%7D%5D)

After installation, select GitHub Copilot Agent Mode and refresh the tools list. Learn more about Agent Mode in the [VS Code Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

#### 🧨 Installing from public feed (recommended)

This installation method is the easiest for all users using Visual Studio Code.

🎥 [Watch this quick start video to get up and running in under two minutes!](https://youtu.be/EUmFM6qXoYk)

##### Steps

1. In your project, add a `.vscode\mcp.json` file and add the following:

   ``` json
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
            "args": [
                "-y",
                "@azure-devops/mcp",
                "${input:ado_org}"
            ]
         }
      }
   }
   ```
2. Save the file and click 'Start`

   <img src="./docs/media/start-mcp-server.gif" alt="start mcp server" width="250"/>

3. In chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
4. Click "Select Tools" and choose the available tools.
5. We strongly recommend that you create a `.github\copilot-instructions.md` in your project and copy and paste the contents from this [copilot-instructions.md](./.github/copilot-instructions.md) file. This will help your experience when it comes to using the Azure DevOps MCP Server in GitHub Copilot Chat.

#### 🛠️ Installing from source (dev mode)

This installation method is recommended for advanced users and contributors who want immediate access to the latest updates from the main branch. It is ideal if you are developing new tools, enhancing existing features, or maintaining a custom fork.

> **Note:** For most users, installing from the public feed is simpler and preferred. Use source installation only if you need the latest changes or are actively contributing to the project.

##### Steps

1. Clone the repository.
2. Install dependencies:
   ```sh
   npm install
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

4. Start the Azure DevOps MCP Server

   <img src="./docs/media/start-mcp-server.gif" alt="start mcp server" width="250"/>
  
5. In chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
6. Click "Select Tools" and choose the available tools.
7. We strongly recommend that you create a `.github\copilot-instructions.md` in your project and copy and paste the contents from this [copilot-instructions.md](./.github/copilot-instructions.md) file. This will help your experience when it comes to using the Azure DevOps MCP Server in GitHub Copilot Chat.

See [How To](./docs/HOWTO.md) section for details

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

## 🎩 Samples & best practices

Find sample prompts and best practices in our [How-to Guide](./docs/HOWTO.md).

## 🙋‍♀️ Frequently asked questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## 📌 Contributing

We welcome contributions! During preview, please file Issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

 - 🛠️ Development setup
 - ✨ Adding new tools
 - 📝 Code style & testing
 - 🔄 Pull request process

## 🤝 Code of conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
