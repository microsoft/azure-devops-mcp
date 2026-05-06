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
/// Result of updating a comment on a work item.
/// </summary>
public class UpdateCommentResult
{
    public int CommentId { get; set; }
    public int WorkItemId { get; set; }
    public string Text { get; set; } = string.Empty;
    public int? Version { get; set; }
    public string? Url { get; set; }
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
    /// <param name="comment">The comment text (supports plain text and HTML formatting)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<AddCommentResult> AddCommentAsync(string collection, string project, int workItemId, string comment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing comment on a work item.
    /// </summary>
    /// <param name="collection">The collection name</param>
    /// <param name="project">The project name or ID</param>
    /// <param name="workItemId">The work item ID</param>
    /// <param name="commentId">The comment ID to update</param>
    /// <param name="text">The updated comment text (supports plain text and HTML formatting)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<UpdateCommentResult> UpdateCommentAsync(string collection, string project, int workItemId, int commentId, string text, CancellationToken cancellationToken = default);
}
