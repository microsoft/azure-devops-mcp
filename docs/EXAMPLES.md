# Azure DevOps MCP Server: Example Usage

This guide offers step-by-step examples for using the Azure DevOps MCP Server to interact with your Azure DevOps organization. For additional tips and best practices, see the [How To guide](./HOWTO.md).

> 📝 These examples have been tested and validated only in English. If you encounter issues when using a different language, please open an issue in the repository so we can investigate.

- [Get List of Projects](#get-list-of-projects)
- [Get List of Teams](#get-list-of-teams)
- [Get My Work Items](#get-my-work-items)
- [Get Work Items in a Backlog](#get-all-work-items-in-a-backlog)
- [Retrieve and Edit Work Items](#retrieve-and-edit-work-items)
- [Create and Link Test Cases](#create-and-link-test-cases)
- [Triage Work](#triage-work)
- [Using Markdown Format](#adding-and-updating-work-items-using-the-format-paramater)
- [Remove Links from a Work Item](#remove-one-or-more-links-from-a-work-item)
- [Adding Artifact Links](#adding-artifact-links)
- [Reading, Creating, and Updating Wiki Page Content](#reading-creating-and-updating-wiki-page-content)

## 🙋‍♂️ Projects and Teams

### Get List of Projects

Most work item tools require project context. You can retrieve the list of projects and specify the desired project:

```text
get list of ado projects
```

### Get List of Teams

This command returns all Azure DevOps projects for the organization defined in the `mcp.json` file. Similarly, you can retrieve the team context:

```text
get list of teams for project contoso
```

📽️ [Azure DevOps MCP Server: Get list of projects and teams](https://youtu.be/x579E4_jNtY)

## 📅 Work Items

### Get My Work Items

Retrieve a list of work items assigned to you. This tool requires project context:

```text
get my work items for project contoso
```

The model should automatically use the `wit_get_work_items_batch_by_ids` tool to fetch work item details.

📽️ [Azure DevOps MCP Server: Get my work items](https://youtu.be/y_ri8n7mBlg)

### Get All Work Items in a Backlog

You need project, team and backlog (Epics, Stories, Features) context in order to get a list of all the work items in a backlog.

```text
get backlogs for Contoso project and Fabrikam team
```

Once you have the backlog levels, you can then get work items for that backlog.

```text
get list of work items for Features backlog
```

The model should automatically use the `wit_get_work_items_batch_by_ids` tool to fetch work item details.

📽️ [Azure DevOps MCP Server: Get backlog](https://youtu.be/LouuyoscNrI)

### Retrieve and Edit Work Items

Get a work item, get the work item comments, update the work item fields, and add a new comment.

```text
Get work item 12345 and show me fields ID, Type, State, Repro Steps, Story Points, and Priority. Get all comments for the work item and summarize them for me.
```

The model now has context of the work item. You can then update specific fields. In this case, we want the LLM to generate a better set of Repro Steps and then update the work item with those new steps. Along with updating the Story Points and State fields.

```text
Polish the Repro Steps with more information and details. Then take that value and update the work item. Also update StoryPoints = 5 and State = Active.
```

Assign the work item to me and add a new comment.

```text
Assign this work item to myemail@outlook.com and add a comment "I will own this Bug and get it fixed"
```

📽️ [Azure DevOps MCP Server: Work with Work Items](https://youtu.be/tT7wqSIPKdA)

### Create and Link Test Cases

Open a user story and automatically generate test cases with detailed steps based on the story's description. Link the generated test cases back to the original user story.

```text
Open work item 1234 in 'Contoso' project. Then look at the description and create 1-3 Test Cases with test steps. But show me a preview first before creating the Test Case in Azure DevOps. Be sure to link the new Test Case to the User Story 1234 when you do.
```

📽️ [Azure DevOps MCP Server: Creating Test Cases from Work Item](https://youtu.be/G7fnYjlSh_w)

### Triage Work

Retrieve all work items in a backlog and triage them according to your own criteria. For example, you can fetch all bugs and user stories, identify security-related bugs, and assign them to the current team iteration. Similarly, you can select a few high-priority user stories and assign them to the most recent iteration.

Retrieve the team's iterations and backlog levels to provide the LLM with the necessary context for accurate work item management.

```text
list iterations for Contoso team
```

```text
list backlog levels for Contoso team
```

Retrieve the work items and their details, then instruct the LLM to identify security-related bugs and high-priority user stories. Assign the identified items to the current iteration and, if needed, to the next iteration.

```text
List of work items for Stories backlog. But then go thru and find all the security related bugs. Assign the first 4 to the current iteration. If there are more than four, assign the rest to the next iteration. Then find 2-3 high priority user stories and assign them to the current iteration. Do it!
```

📽️ [Azure DevOps MCP Server: Triage Work](https://youtu.be/gCI_pPS76C8)

### Adding and Updating Work Items Using the `format` Paramater

You can use the `format` paramater to indicate markdown formatting for large text fields. It is now available on the following tools:

- **wit_update_work_items_batch**
- **wit_add_child_work_items**
- **wit_create_work_item**

> 🚩 HTML is the default unless `Markdown` is explicity set.

```text
Update work item 12345 with a new description and use Markdown text. Use Markdown format param. Use bulk update.
```

📽️ [Azure DevOps MCP Server: Using Markdown format for create and update work items](https://youtu.be/OD4c2m7Fj9U)

### Remove One or More Links from a Work Item

Use this tool to remove one or more links from a work item, either by specifying individual links or by link type.

First, retrieve the work item whose links you want to remove:

```text
Get work item 1234 in Contoso project and show me the relations
```

Next, remove a specific link to a work item, pull request, etc. or remove links by type (for example, "related"):

```text
Remove link 5678 and 91011 from work item 1234. Also remove any related links and links to pull request 121314
```

### 🔗 Adding Artifact Links

### Add Artifact Links to Work Items

Use this tool to associate work items with repository artifacts such as branches, commits, and pull requests.

You have two options for linking artifacts:

Supply the complete artifact `vstfs` URI in the required format. For example:

**Branch**:
`vstfs:///Git/Ref/{projectId}%2F{repositoryId}%2FGB{branchName}`

**Commit**:
`vstfs:///Git/Commit/{projectId}%2F{repositoryId}%2F{commitId}`

**Pull Request**:
`vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}`

```text
Add a branch artifact link to work item 1234 in project "Contoso" with URI "vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain" and link type "Branch" with comment "Linked to main branch for GitHub Copilot integration"
```

Alternatively, you can simply provide the branch, commit, pull request, or build identifiers directly, and the tool will automatically construct the required artifact URI for you.

For example:

```text
Get me the list of pull requests for Constoso project and Frabrikam repo. Then link the first pull request to work item 12345.
```

📽️ [Azure Devops MCP Server: Adding artifact links](https://youtu.be/t8HqEt8cZtY)

## 📖 Wiki

### Reading, Creating, and Updating Wiki Page Content

You can read, create, and update wiki pages in Azure DevOps. Follow these steps:

1. Retrieve the list of wikis in your project.
2. Get the pages available in a specific wiki.
3. Read the content of an existing wiki page.
4. Update the content of a wiki page or create a new page.

```text
Get list of wikis in project Contoso.
```

```text
Get list of pages for Fabrikam wiki.
```

```text
Get wiki page 'sample-page-name' content. Review and suggest improvements, then update the page with the revised content.
```

```text
Create new wiki page called 'how to bake a cake' and add the following content:

<content>
```

📽️ [Azure Devops MCP Server: Reading, creating, and updating wiki pages](https://youtu.be/z_WQ_QefpGU)
