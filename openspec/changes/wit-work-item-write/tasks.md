## 1. Service Layer Setup

- [x] 1.1 Add `CreateWorkItemAsync(collection, project, workItemType, title, description)` method signature to `IWorkItemContextService` interface
- [x] 1.2 Implement `CreateWorkItemAsync` in `WorkItemContextService` using `WorkItemTrackingHttpClient`
- [x] 1.3 Add exception handling to return meaningful error messages for invalid types or Azure DevOps API failures

## 2. Tool Implementation

- [x] 2.1 Add `wit_work_item_write_create` method to `WorkItemTools` class with `[McpServerTool]` attribute
- [x] 2.2 Define tool parameters: collection, project, workItemType, title, description (optional)
- [x] 2.3 Add `[Description]` attribute with clear tool documentation
- [x] 2.4 Implement JSON response with workItemId, url, title, type, and success flag
- [x] 2.5 Add error handling to return JSON error response with meaningful message

## 3. Input Validation

- [x] 3.1 Validate that collection parameter is provided and non-empty
- [x] 3.2 Validate that project parameter is provided and non-empty
- [x] 3.3 Validate that workItemType parameter is provided and non-empty
- [x] 3.4 Validate that title parameter is provided and non-empty

## 4. Testing

- [x] 4.1 Create unit tests for `CreateWorkItemAsync` service method (success and error cases)
- [x] 4.2 Create unit tests for parameter validation
- [x] 4.3 Create integration test for `wit_work_item_write_create` tool with mock Azure DevOps connection
- [x] 4.4 Test that created work items have correct type and title
- [x] 4.5 Test error handling for invalid work item types

## 5. Documentation

- [x] 5.1 Add `wit_work_item_write_create` entry to `FORK_MATRIX.md` capability matrix
