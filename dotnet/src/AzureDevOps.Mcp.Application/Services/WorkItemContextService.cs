namespace AzureDevOps.Mcp.Application.Services;

/// <summary>
/// Work item with its comments, using pure CLR types - no SDK dependency.
/// </summary>
public class WorkItemContextResult
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? AssignedTo { get; set; }
    public string? Url { get; set; }
    public List<WorkItemCommentResult> Comments { get; set; } = [];
}

/// <summary>
/// A single comment, using pure CLR types.
/// </summary>
public class WorkItemCommentResult
{
    public int Id { get; set; }
    public string Author { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
}

/// <summary>
/// Service for retrieving work item context from Azure DevOps.
/// </summary>
public interface IWorkItemContextService
{
    Task<WorkItemContextResult> GetWorkItemContextAsync(string project, int workItemId, CancellationToken cancellationToken = default);
}
