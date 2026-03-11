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
6. [🏢 On-Premises / TFS Support](#-on-premises--tfs-support)
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

See [TOOLSET.md](./docs/TOOLSET.md) for a comprehensive list.

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

## 🏢 On-Premises / TFS Support

The Azure DevOps MCP Server supports both **Azure DevOps Services (cloud)** and **on-premises installations** (Azure DevOps Server / Team Foundation Server).

### Configuration for On-Premises Installations

- Pass the full URL to the on-premises Azure DevOps Server instance in the `organization` argument
- Provide the PAT token via the environment variable `AZURE_DEVOPS_PAT`
- Instruct the mcp server to authenticate via the environment with `-a env`

```json
{
  "servers": {
    "ado_onprem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "https://tfs.company.com/DefaultCollection", "-a", "env"],
      "env": {
        "AZURE_DEVOPS_PAT": "<PAT>"
      }
    }
  }
}
```

- Optional: You may want to additionally set `AZURE_DEVOPS_IGNORE_SSL_ERRORS` in case the server uses internal SSL certificates

```json
{
  ...
      "env": {
        "AZURE_DEVOPS_PAT": "<PAT>",
        "AZURE_DEVOPS_IGNORE_SSL_ERRORS": "true"
      }
  ...
}
```

### ✅ On-Premises Verification Test Report

The following report summarises read-only verification test runs executed against a fairly recent version of an **Azure DevOps Server** instance.

Verification was performed twice: first against the modified `2.4.0` branch containing the on-premises support changes, and then re-run successfully against the current `HEAD`.

> **Legend:** ✅ Pass · ⏭️ Skipped (write op or n/a) · 🚫 Not supported on-premises (by design)

#### Core & Work

| #   | Tool                            | Result | Notes           |
| --- | ------------------------------- | ------ | --------------- |
| 1   | `core_list_projects`            | ✅     |                 |
| 2   | `core_list_project_teams`       | ✅     |                 |
| 3   | `core_get_identity_ids`         | ✅     |                 |
| 4   | `work_list_iterations`          | ✅     |                 |
| 5   | `work_list_team_iterations`     | ✅     |                 |
| 6   | `work_get_team_capacity`        | ✅     |                 |
| 7   | `work_get_iteration_capacities` | ✅     |                 |
| 8   | `work_create_iterations`        | ⏭️     | Write — not run |
| 9   | `work_assign_iterations`        | ⏭️     | Write — not run |
| 10  | `work_update_team_capacity`     | ⏭️     | Write — not run |

#### Pipelines

| #   | Tool                                       | Result | Notes           |
| --- | ------------------------------------------ | ------ | --------------- |
| 11  | `pipelines_get_build_definitions`          | ✅     |                 |
| 12  | `pipelines_get_builds`                     | ✅     |                 |
| 13  | `pipelines_get_build_status`               | ✅     |                 |
| 14  | `pipelines_get_build_changes`              | ✅     |                 |
| 15  | `pipelines_get_build_log`                  | ✅     |                 |
| 16  | `pipelines_get_build_log_by_id`            | ✅     |                 |
| 17  | `pipelines_get_build_definition_revisions` | ✅     |                 |
| 18  | `pipelines_list_runs`                      | ✅     |                 |
| 19  | `pipelines_get_run`                        | ✅     |                 |
| 20  | `pipelines_run_pipeline`                   | ⏭️     | Write — not run |
| 21  | `pipelines_update_build_stage`             | ⏭️     | Write — not run |

#### Repositories

| #   | Tool                                         | Result | Notes           |
| --- | -------------------------------------------- | ------ | --------------- |
| 22  | `repo_list_repos_by_project`                 | ✅     |                 |
| 23  | `repo_get_repo_by_name_or_id`                | ✅     |                 |
| 24  | `repo_list_branches_by_repo`                 | ✅     |                 |
| 25  | `repo_list_my_branches_by_repo`              | ✅     |                 |
| 26  | `repo_get_branch_by_name`                    | ✅     |                 |
| 27  | `repo_list_pull_requests_by_repo_or_project` | ✅     |                 |
| 28  | `repo_get_pull_request_by_id`                | ✅     |                 |
| 29  | `repo_list_pull_request_threads`             | ✅     |                 |
| 30  | `repo_list_pull_request_thread_comments`     | ✅     |                 |
| 31  | `repo_search_commits`                        | ✅     |                 |
| 32  | `repo_list_pull_requests_by_commits`         | ✅     |                 |
| 33  | `repo_create_branch`                         | ⏭️     | Write — not run |
| 34  | `repo_create_pull_request`                   | ⏭️     | Write — not run |
| 35  | `repo_update_pull_request`                   | ⏭️     | Write — not run |
| 36  | `repo_update_pull_request_reviewers`         | ⏭️     | Write — not run |
| 37  | `repo_reply_to_comment`                      | ⏭️     | Write — not run |
| 38  | `repo_create_pull_request_thread`            | ⏭️     | Write — not run |
| 39  | `repo_update_pull_request_thread`            | ⏭️     | Write — not run |

#### Search

| #   | Tool              | Result | Notes |
| --- | ----------------- | ------ | ----- |
| 40  | `search_code`     | ✅     |       |
| 41  | `search_wiki`     | ✅     |       |
| 42  | `search_workitem` | ✅     |       |

#### Wiki

| #   | Tool                         | Result | Notes           |
| --- | ---------------------------- | ------ | --------------- |
| 43  | `wiki_list_wikis`            | ✅     |                 |
| 44  | `wiki_get_wiki`              | ✅     |                 |
| 45  | `wiki_list_pages`            | ✅     |                 |
| 46  | `wiki_get_page`              | ✅     |                 |
| 47  | `wiki_get_page_content`      | ✅     |                 |
| 48  | `wiki_create_or_update_page` | ⏭️     | Write — not run |

#### Work Items

| #   | Tool                                 | Result | Notes           |
| --- | ------------------------------------ | ------ | --------------- |
| 49  | `wit_my_work_items`                  | ✅     |                 |
| 50  | `wit_list_backlogs`                  | ✅     |                 |
| 51  | `wit_list_backlog_work_items`        | ✅     |                 |
| 52  | `wit_get_work_item`                  | ✅     |                 |
| 53  | `wit_get_work_items_batch_by_ids`    | ✅     |                 |
| 54  | `wit_list_work_item_comments`        | ✅     |                 |
| 55  | `wit_list_work_item_revisions`       | ✅     |                 |
| 56  | `wit_get_work_items_for_iteration`   | ✅     |                 |
| 57  | `wit_get_work_item_type`             | ✅     |                 |
| 58  | `wit_get_query`                      | ✅     |                 |
| 59  | `wit_get_query_results_by_id`        | ✅     |                 |
| 60  | `wit_add_work_item_comment`          | ⏭️     | Write — not run |
| 61  | `wit_update_work_item`               | ⏭️     | Write — not run |
| 62  | `wit_create_work_item`               | ⏭️     | Write — not run |
| 63  | `wit_add_child_work_items`           | ⏭️     | Write — not run |
| 64  | `wit_link_work_item_to_pull_request` | ⏭️     | Write — not run |
| 65  | `wit_update_work_items_batch`        | ⏭️     | Write — not run |
| 66  | `wit_work_items_link`                | ⏭️     | Write — not run |
| 67  | `wit_work_item_unlink`               | ⏭️     | Write — not run |
| 68  | `wit_add_artifact_link`              | ⏭️     | Write — not run |

#### Test Plans

| #   | Tool                                       | Result | Notes                               |
| --- | ------------------------------------------ | ------ | ----------------------------------- |
| 69  | `testplan_list_test_plans`                 | ✅     |                                     |
| 70  | `testplan_list_test_suites`                | ✅     |                                     |
| 71  | `testplan_list_test_cases`                 | ⏭️     | Skipped — requires active test plan |
| 72  | `testplan_show_test_results_from_build_id` | ✅     |                                     |
| 73  | `testplan_create_test_plan`                | ⏭️     | Write — not run                     |
| 74  | `testplan_create_test_suite`               | ⏭️     | Write — not run                     |
| 75  | `testplan_create_test_case`                | ⏭️     | Write — not run                     |
| 76  | `testplan_add_test_cases_to_suite`         | ⏭️     | Write — not run                     |
| 77  | `testplan_update_test_case_steps`          | ⏭️     | Write — not run                     |

#### Advanced Security

| #   | Tool                       | Result | Notes                                                          |
| --- | -------------------------- | ------ | -------------------------------------------------------------- |
| 78  | `advsec_get_alerts`        | 🚫     | Returns friendly on-premises not-supported message (by design) |
| 79  | `advsec_get_alert_details` | 🚫     | Not applicable — no alert IDs available on-premises            |

#### Summary

| Category                                 | Count  |
| ---------------------------------------- | ------ |
| ✅ Passed (read)                         | 47     |
| ⏭️ Skipped (write / n/a)                 | 30     |
| 🚫 Not supported on-premises (by design) | 2      |
| **Total tools**                          | **79** |

All 47 read-only tools passed against Azure DevOps Server (on-premises).  
Advanced Security tools are cloud-only by design and return a descriptive error on-premises.

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

> ⚠️ Please read the [Contributions Guide](./CONTRIBUTING.md) before creating a pull request.

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
