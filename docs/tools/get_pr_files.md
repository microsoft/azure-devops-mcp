# `get_pr_files` — Get files changed in a pull request

## Overview

Returns file-level change metadata (path, original path, change type) for a pull request iteration. Supports pagination and iteration-to-iteration comparison.

**Tool name (as registered):** `mcp_ado_repo_get_pr_files`

**Underlying Azure DevOps REST API:**

```
GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/pullRequests/{pullRequestId}/iterations/{iterationId}/changes?api-version=7.1
```

---

## Parameters

| Parameter       | Type     | Required | Description                                                                                   |
| --------------- | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `repositoryId`  | `string` | ✅       | The ID of the repository where the pull request is located.                                   |
| `pullRequestId` | `number` | ✅       | The ID of the pull request to retrieve changed files for.                                     |
| `projectId`     | `string` | ✅       | Project ID or project name.                                                                   |
| `iterationId`   | `number` | ❌       | The iteration ID to get changes for. If not specified, gets changes for the latest iteration. |
| `top`           | `number` | ❌       | Maximum number of changes to return.                                                          |
| `skip`          | `number` | ❌       | Number of changes to skip for pagination.                                                     |
| `compareTo`     | `number` | ❌       | Iteration ID to compare against. If specified, returns changes between the two iterations.    |

---

## Response

Returns a `GitPullRequestIterationChanges` object containing:

- **`changeEntries`**: Array of changed files, each with:
  - `item.path` — path of the changed file
  - `item.originalPath` — original path (populated for renames)
  - `changeType` — type of change (Add, Edit, Delete, Rename, etc.)
  - `changeTrackingId` — ID used to track the file across multiple changes
- **`nextSkip`** — value to pass as `skip` for the next page (0 when no more pages)
- **`nextTop`** — value to pass as `top` for the next page (0 when no more pages)

---

## Examples

### Get all changed files for the latest iteration

```json
{
  "repositoryId": "my-repo",
  "pullRequestId": 42,
  "projectId": "my-project"
}
```

### Get changed files for a specific iteration

```json
{
  "repositoryId": "my-repo",
  "pullRequestId": 42,
  "projectId": "my-project",
  "iterationId": 3
}
```

### Compare two iterations (diff between iteration 2 and iteration 4)

```json
{
  "repositoryId": "my-repo",
  "pullRequestId": 42,
  "projectId": "my-project",
  "iterationId": 4,
  "compareTo": 2
}
```

### Paginate through a large list of changes

```json
{
  "repositoryId": "my-repo",
  "pullRequestId": 42,
  "projectId": "my-project",
  "iterationId": 1,
  "top": 50,
  "skip": 50
}
```
