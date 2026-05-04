using System.Text.Json;
using AzureDevOps.Mcp.Application.Services;
using ModelContextProtocol.Server;

namespace AzureDevOps.Mcp.Tools;

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
    public async Task<string> CreateFeatureBranch(string project, string repository, string branchName, string fromBranch)
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
}
