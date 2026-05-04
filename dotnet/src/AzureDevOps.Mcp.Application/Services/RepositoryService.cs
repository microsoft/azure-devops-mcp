namespace AzureDevOps.Mcp.Application.Services;

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
}
