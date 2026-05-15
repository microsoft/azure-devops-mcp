## 1. Service Layer Setup

- [ ] 1.1 Add `CreateWorkItemAsync(collection, project, workItemType, title, description)` method signature to `IWorkItemContextService` interface
- [ ] 1.2 Implement `CreateWorkItemAsync` in `WorkItemContextService` using `WorkItemTrackingHttpClient`
- [ ] 1.3 Add exception handling to return meaningful error messages for invalid types or Azure DevOps API failures

## 2. Tool Implementation

- [ ] 2.1 Add `wit_work_item_write_create` method to `WorkItemTools` class with `[McpServerTool]` attribute
- [ ] 2.2 Define tool parameters: collection, project, workItemType, title, description (optional)
- [ ] 2.3 Add `[Description]` attribute with clear tool documentation
- [ ] 2.4 Implement JSON response with workItemId, url, title, type, and success flag
- [ ] 2.5 Add error handling to return JSON error response with meaningful message

## 3. Input Validation

- [ ] 3.1 Validate that collection parameter is provided and non-empty
- [ ] 3.2 Validate that project parameter is provided and non-empty
- [ ] 3.3 Validate that workItemType parameter is provided and non-empty
- [ ] 3.4 Validate that title parameter is provided and non-empty

## 4. Testing

- [ ] 4.1 Create unit tests for `CreateWorkItemAsync` service method (success and error cases)
- [ ] 4.2 Create unit tests for parameter validation
- [ ] 4.3 Create integration test for `wit_work_item_write_create` tool with mock Azure DevOps connection
- [ ] 4.4 Test that created work items have correct type and title
- [ ] 4.5 Test error handling for invalid work item types

## 5. Documentation

- [ ] 5.1 Update tool documentation or EXAMPLES.md with `wit_work_item_write_create` usage example
- [ ] 5.2 Document accepted workItemType values (reference Azure DevOps project settings)
