namespace G5e.AzureDevOpsServerMCP.Application.Services;

/// <summary>
/// Result of creating a feature branch.
/// </summary>
public class CreateBranchResult
{
    public string BranchName { get; set; } = string.Empty;
    public string ObjectId { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

/// <summary>
/// Result of linking a branch to a work item.
/// </summary>
public class LinkBranchResult
{
    public int WorkItemId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Repository { get; set; } = string.Empty;
}

/// <summary>
/// Result of creating a pull request.
/// </summary>
public class CreatePullRequestResult
{
    public int PullRequestId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Service for repository operations on Azure DevOps.
/// </summary>
public interface IRepositoryService
{
    /// <summary>
    /// Creates a feature branch from a source branch.
    /// </summary>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="repository">The repository name or ID</param>
    /// <param name="branchName">The name of the new branch (e.g., "feature/my-feature")</param>
    /// <param name="fromBranch">The source branch to create from (e.g., "main" or "develop")</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>CreateBranchResult with branch details</returns>
    Task<CreateBranchResult> CreateBranchAsync(
        string project,
        string repository,
        string branchName,
        string fromBranch,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Links a branch to a work item as an artifact link.
    /// </summary>
    /// <param name="project">The Azure DevOps project name</param>
    /// <param name="repository">The repository name</param>
    /// <param name="branchName">The branch name (e.g., "feature/my-feature")</param>
    /// <param name="workItemId">The work item ID to link to</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<LinkBranchResult> LinkBranchToWorkItemAsync(
        string project,
        string repository,
        string branchName,
        int workItemId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a pull request and links it to a work item.
    /// </summary>
    /// <param name="project">The Azure DevOps project name</param>
    /// <param name="repository">The repository name</param>
    /// <param name="sourceBranch">The source branch (e.g., "feature/my-feature")</param>
    /// <param name="targetBranch">The target branch (e.g., "main" or "develop")</param>
    /// <param name="title">The pull request title</param>
    /// <param name="description">Optional pull request description (Markdown supported)</param>
    /// <param name="workItemId">The work item ID to link to</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task<CreatePullRequestResult> CreatePullRequestAsync(
        string project,
        string repository,
        string sourceBranch,
        string targetBranch,
        string title,
        string? description,
        int workItemId,
        CancellationToken cancellationToken = default);
}
