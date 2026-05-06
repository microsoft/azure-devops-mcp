namespace G5e.AzureDevOpsServerMCP.Application.Services;

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
/// Result of adding a comment to a work item.
/// </summary>
public class AddCommentResult
{
    public int CommentId { get; set; }
    public string Url { get; set; } = string.Empty;
}

/// <summary>
/// Service for retrieving and updating work item context from Azure DevOps.
/// </summary>
public interface IWorkItemContextService
{
    /// <summary>
    /// Gets work item context (details and comments).
    /// </summary>
    /// <param name="collection">The collection name</param>
    /// <param name="project">The project name or ID</param>
    /// <param name="workItemId">The work item ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<WorkItemContextResult> GetWorkItemContextAsync(string collection, string project, int workItemId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a comment to a work item.
    /// </summary>
    /// <param name="collection">The collection name</param>
    /// <param name="project">The project name or ID</param>
    /// <param name="workItemId">The work item ID</param>
    /// <param name="comment">The comment text</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<AddCommentResult> AddCommentAsync(string collection, string project, int workItemId, string comment, CancellationToken cancellationToken = default);
}
