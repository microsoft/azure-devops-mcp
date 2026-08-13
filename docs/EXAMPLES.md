# Examples

Use these example prompts to get started with the Azure DevOps MCP Server. Replace names such as `Contoso` and IDs such as `1234` with values from your organization.

> [!NOTE]
> These examples have been tested only in English. If you have problems using another language, [open an issue](https://github.com/microsoft/azure-devops-mcp/issues).

- [Get List of Projects](#get-list-of-projects)
- [Get List of Teams](#get-list-of-teams)
- [Get My Work Items](#get-my-work-items)
- [Get Work Items in a Backlog](#get-all-work-items-in-a-backlog)
- [Retrieve and Edit Work Items](#retrieve-and-edit-work-items)
- [Create and Link Test Cases](#create-and-link-test-cases)
- [Triage Work](#triage-work)
- [Use Markdown for Work Item Fields](#use-markdown-for-work-item-fields)
- [Remove Links from a Work Item](#remove-one-or-more-links-from-a-work-item)
- [Add Artifact Links](#add-artifact-links)
- [Read, Create, and Update Wiki Pages](#read-create-and-update-wiki-pages)

## Projects and Teams

### Get List of Projects

**Tool:** `core_list_projects`

List the projects you can access:

```text
List my Azure DevOps projects.
```

### Get List of Teams

**Tool:** `core_list_project_teams`

After choosing a project, list its teams:

```text
List teams for the Contoso project.
```

## Work Items

### Get My Work Items

**Tools:** `wit_work_item` with `my`, followed by `wit_work_item` with `get_batch` for details

List work items assigned to you in a project:

```text
List my work items in the Contoso project.
```

The `my` action returns work item references. The agent can pass those IDs to `get_batch` to retrieve work item fields.

### Get All Work Items in a Backlog

**Tools:** `wit_backlog` with `list` and `list_work_items`, followed by `wit_work_item` with `get_batch` for details

First, list the backlog levels for a project and team:

```text
List backlog levels for the Contoso project and Fabrikam team.
```

Then select a backlog level and list its work items:

```text
List work items in the Features backlog.
```

The `list_work_items` action requires the backlog ID returned by `list`. The agent can pass the resulting work item IDs to `get_batch` to retrieve fields.

### Retrieve and Edit Work Items

**Tools:** `wit_work_item` with `get` and `list_comments`; `wit_work_item_write` with `update`; `wit_work_item_comment_write` with `add`

You can retrieve a work item and its comments, update fields, assign it, and add a comment.

```text
Get work item 12345. Show its ID, type, state, repro steps, story points, and priority. Summarize all comments.
```

Continue in the same conversation to update it:

```text
Rewrite the repro steps with clearer details, then update the work item. Also set Story Points to 5 and State to Active.
```

You can then assign the item and add a comment:

```text
Assign this work item to myemail@outlook.com and add this comment: "I will own this bug and get it fixed."
```

### Create and Link Test Cases

**Tools:** `wit_work_item` with `get`; `testplan_test_case_write` with `create`

Ask the agent to draft test cases from a user story and link the approved cases to it:

```text
Open work item 1234 in the Contoso project. Draft one to three test cases based on its description. Include an action and expected result for each step. Show me a preview before creating them. After I approve, create the test cases and link them to user story 1234.
```

The `create` action links each test case to the story when it receives the story ID as `testsWorkItemId`.

### Triage Work

**Tools:** `work` with `list_team_iterations`; `wit_backlog` with `list` and `list_work_items`; `wit_work_item` with `get_batch`; `wit_work_item_write` with `update_batch`

First, retrieve the team's iterations and backlog levels:

```text
List iterations for the Fabrikam team in the Contoso project.
```

```text
List backlog levels for the Fabrikam team in the Contoso project.
```

Then provide clear triage rules and ask for confirmation before changing work items:

```text
List work items in the Stories backlog. Identify security-related bugs and high-priority user stories. Propose assigning the first four security bugs and up to three high-priority user stories to the current iteration, and any remaining security bugs to the next iteration. Show me the proposed changes before updating the work items.
```

### Use Markdown for Work Item Fields

**Tool:** `wit_work_item_write`

Markdown formatting is configured on individual values rather than as a top-level tool parameter:

- `create`: set `fields[].format` to `Markdown`.
- `update_batch`: set `batchUpdates[].format` to `Markdown`.
- `add_child`: set `items[].format` to `Markdown`; this action defaults to Markdown.

> [!NOTE]
> For `create` and `update_batch`, Azure DevOps treats large text fields as HTML unless you set their format to Markdown. The single-item `update` action does not expose a format option.

```text
Update work item 12345 with the following description. Use Markdown format and a batch update: [description]
```

### Remove One or More Links from a Work Item

**Tools:** `wit_work_item` with `get` and `expand: Relations`; `wit_work_item_link_write` with `unlink`

First, retrieve the work item and inspect its links:

```text
Get work item 1234 in the Contoso project and show its links.
```

The `unlink` action accepts one relation type and, optionally, one exact relation URL per call. Without a URL, it removes every relation of that type. Use separate calls for different relation types:

```text
Remove all links with type `related` from work item 1234. Then remove the link with type `artifact` whose exact relation URL points to pull request 121314. Use a separate unlink operation for each type.
```

### Add Artifact Links

**Tools:** `repo_repository` with `get`; `repo_pull_request` with `list`; `wit_work_item_link_write` with `link_to_pull_request` or `add_artifact_link`

The dedicated `link_to_pull_request` action requires the project GUID, repository GUID, pull request ID, and work item ID. Pull request results include the project and repository names, so retrieve the repository details to resolve both GUIDs before linking:

```text
Get the Fabrikam repository in the Contoso project, then list its pull requests. Link the first pull request to work item 12345 using the project and repository GUIDs from the repository details.
```

Use `add_artifact_link` for branches, commits, pull requests, builds, and wiki pages. Provide the artifact components or a complete `vstfs` URI. These are the Git artifact URI formats:

- Branch: `vstfs:///Git/Ref/{projectId}%2F{repositoryId}%2FGB{branchName}`
- Fixed in Commit: `vstfs:///Git/Commit/{projectId}%2F{repositoryId}%2F{commitId}`
- Pull request: `vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}`

For example:

```text
Add a branch artifact link to work item 1234 in the Contoso project. Use URI "vstfs:///Git/Ref/12341234-1234-1234-1234-123412341234%2F12341234-1234-1234-1234-123412341234%2FGBmain", link type "Branch", and comment "Linked to main branch for GitHub Copilot integration."
```

## Wiki

### Read, Create, and Update Wiki Pages

**Tools:** `wiki` with `list_wikis`, `list_pages`, and `get_page_content`; `wiki_upsert_page` to create or update a page

You can complete the whole workflow in one prompt:

```text
List wikis in the Contoso project. In the Fabrikam wiki, list the pages and get the content of 'sample-page-name'. Suggest improvements and show me a preview before updating the page.
```

You can also perform each step separately:

```text
List wikis in the Contoso project.
```

```text
List pages in the Fabrikam wiki.
```

```text
Get the content of 'sample-page-name' in the Fabrikam wiki.
```

```text
Create a wiki page at '/How-to-bake-a-cake' in the Fabrikam wiki in the Contoso project with this content: [content]
```
