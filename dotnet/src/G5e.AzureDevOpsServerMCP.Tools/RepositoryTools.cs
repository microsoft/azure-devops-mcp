using System.Text.Json;
using System.ComponentModel;
using G5e.AzureDevOpsServerMCP.Application.Services;
using ModelContextProtocol.Server;

namespace G5e.AzureDevOpsServerMCP.Tools;

/// <summary>
/// Repository tools for Azure DevOps MCP server.
/// </summary>
[McpServerToolType]
public class RepositoryTools
{
    private readonly IRepositoryService _repositoryService;

    public RepositoryTools(IRepositoryService repositoryService)
    {
        _repositoryService = repositoryService ?? throw new ArgumentNullException(nameof(repositoryService));
    }

    /// <summary>
    /// Creates a new feature branch from a source branch.
    /// </summary>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="repository">The repository name or ID</param>
    /// <param name="branchName">The name of the new branch (e.g., "feature/TASK-123")</param>
    /// <param name="fromBranch">The source branch to create from (e.g., "develop")</param>
    /// <returns>JSON object with branch creation details</returns>
    [McpServerTool(Name = "CreateFeatureBranch")]
    [Description("Creates a new feature branch in a Git repository from an existing branch.")]
    public async Task<string> CreateFeatureBranch(string? project, string? repository, string branchName, string fromBranch)
    {
        try
        {
            var result = await _repositoryService.CreateBranchAsync(project, repository, branchName, fromBranch);

            var response = new
            {
                branchName = result.BranchName,
                objectId = result.ObjectId,
                url = result.Url,
                success = true
            };

            return JsonSerializer.Serialize(response, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }

    /// <summary>
    /// Links a branch to a work item as an artifact link.
    /// </summary>
    /// <param name="project">The Azure DevOps project name</param>
    /// <param name="repository">The repository name</param>
    /// <param name="branchName">The branch name to link (e.g., "feature/TASK-123")</param>
    /// <param name="workItemId">The work item ID to link to</param>
    /// <returns>JSON object confirming the link was created</returns>
    [McpServerTool(Name = "LinkBranchToWorkItem")]
    [Description("Links a Git branch to a work item as an artifact relationship.")]
    public async Task<string> LinkBranchToWorkItem(string? project, string? repository, string branchName, int workItemId)
    {
        try
        {
            var result = await _repositoryService.LinkBranchToWorkItemAsync(project, repository, branchName, workItemId);

            return JsonSerializer.Serialize(new
            {
                workItemId = result.WorkItemId,
                branchName = result.BranchName,
                repository = result.Repository,
                success = true
            }, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }

    /// <summary>
    /// Creates a pull request and links it to a work item.
    /// </summary>
    /// <param name="project">The Azure DevOps project name</param>
    /// <param name="repository">The repository name</param>
    /// <param name="sourceBranch">The source branch (e.g., "feature/TASK-123")</param>
    /// <param name="targetBranch">The target branch (e.g., "main" or "develop")</param>
    /// <param name="title">The pull request title</param>
    /// <param name="description">Optional pull request description in Markdown format</param>
    /// <param name="workItemId">The work item ID to link to</param>
    /// <returns>JSON object with pull request details</returns>
    [McpServerTool(Name = "CreatePullRequestForWorkItem")]
    [Description("Creates a pull request in a Git repository and links it to a work item.")]
    public async Task<string> CreatePullRequestForWorkItem(string? project, string? repository, string sourceBranch, string targetBranch, string title, int workItemId, string? description = null)
    {
        try
        {
            var result = await _repositoryService.CreatePullRequestAsync(project, repository, sourceBranch, targetBranch, title, description, workItemId);

            return JsonSerializer.Serialize(new
            {
                pullRequestId = result.PullRequestId,
                title = result.Title,
                url = result.Url,
                status = result.Status,
                success = true
            }, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }
}
