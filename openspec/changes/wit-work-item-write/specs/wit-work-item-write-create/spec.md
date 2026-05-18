## ADDED Requirements

### Requirement: Create work item with core parameters
The MCP tool `wit_work_item_write_create` SHALL create a new work item in an Azure DevOps project with a specified type, title, and optional description.

#### Scenario: Successful work item creation with required fields
- **WHEN** the tool is called with valid collection, project, workItemType, and title parameters
- **THEN** a new work item SHALL be created in the specified project
- **AND** the tool SHALL return the newly created work item ID and URL
- **AND** the work item type SHALL match the specified workItemType
- **AND** the work item title SHALL match the specified title

#### Scenario: Work item creation with description
- **WHEN** the tool is called with collection, project, workItemType, title, and description parameters
- **THEN** a new work item SHALL be created with all provided fields
- **AND** the work item description SHALL contain the provided text
- **AND** the work item SHALL be retrievable immediately after creation

#### Scenario: Invalid work item type rejection
- **WHEN** the tool is called with a workItemType that does not exist in the project
- **THEN** the tool SHALL return an error response
- **AND** no work item SHALL be created
- **AND** the error message SHALL indicate the invalid work item type

### Requirement: Contextual parameter specification
The tool SHALL accept Azure DevOps collection and project parameters to contextualize the work item creation operation.

#### Scenario: Work item created in correct project context
- **WHEN** the tool is called with a specific collection and project
- **THEN** the work item SHALL be created in that specified project
- **AND** subsequent retrieval of the work item by ID SHALL be scoped to the same project

### Requirement: Required parameter validation
The tool SHALL enforce that collection, project, workItemType, and title are provided and non-empty.

#### Scenario: Missing required parameter handling
- **WHEN** the tool is called without a required parameter (collection, project, workItemType, or title)
- **THEN** the tool SHALL return a validation error
- **AND** no work item SHALL be created
- **AND** the error message SHALL indicate which required parameter is missing

### Requirement: Response contract for successful creation
The tool response for a successful work item creation SHALL include the work item ID, URL, type, and title for immediate confirmation.

#### Scenario: Response contains created work item identifiers
- **WHEN** a work item is successfully created
- **THEN** the response SHALL include the numeric work item ID
- **AND** the response SHALL include a URL to access the created work item
- **AND** the response SHALL include the work item type that was created
- **AND** the response SHALL include the title provided at creation time
