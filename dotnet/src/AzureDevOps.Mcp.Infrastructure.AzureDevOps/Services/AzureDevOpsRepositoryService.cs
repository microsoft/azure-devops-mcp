using AzureDevOps.Mcp.Application.Services;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.TeamFoundation.SourceControl.WebApi;

namespace AzureDevOps.Mcp.Infrastructure.AzureDevOps.Services;

public class AzureDevOpsRepositoryService : IRepositoryService
{
    private readonly IAzureDevOpsConnectionFactory _connectionFactory;

    public AzureDevOpsRepositoryService(IAzureDevOpsConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    public async Task<CreateBranchResult> CreateBranchAsync(
        string project,
        string repository,
        string branchName,
        string fromBranch,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (string.IsNullOrWhiteSpace(repository))
            throw new ArgumentException("Repository cannot be empty", nameof(repository));
        if (string.IsNullOrWhiteSpace(branchName))
            throw new ArgumentException("Branch name cannot be empty", nameof(branchName));
        if (string.IsNullOrWhiteSpace(fromBranch))
            throw new ArgumentException("Source branch cannot be empty", nameof(fromBranch));

        using var connection = _connectionFactory.CreateConnection();
        var gitClient = connection.GetClient<GitHttpClient>();

        // Get the source branch to find its commit
        // filter is applied to the ref name after "refs/", so "heads/master" matches "refs/heads/master"
        var refs = await gitClient.GetRefsAsync(
            repositoryId: repository,
            project: project,
            filter: $"heads/{fromBranch}",
            cancellationToken: cancellationToken);

        var sourceRef = refs?.FirstOrDefault();
        if (sourceRef is null)
        {
            throw new InvalidOperationException($"Source branch '{fromBranch}' not found in repository {repository}");
        }

        // Create new branch pointing to the same commit
        var newRef = new GitRefUpdate
        {
            Name = $"refs/heads/{branchName}",
            OldObjectId = "0000000000000000000000000000000000000000", // New ref
            NewObjectId = sourceRef.ObjectId
        };

        var refUpdates = new List<GitRefUpdate> { newRef };
        var updateResult = await gitClient.UpdateRefsAsync(
            refUpdates,
            repositoryId: repository,
            project: project,
            cancellationToken: cancellationToken);

        if (!updateResult.Any() || !updateResult[0].Success)
        {
            throw new InvalidOperationException(
                $"Failed to create branch '{branchName}'");
        }

        var createdRef = updateResult[0];

        return new CreateBranchResult
        {
            BranchName = branchName,
            ObjectId = createdRef.NewObjectId,
            Url = $"{sourceRef.Url}" // Approximate URL; actual URL may vary
        };
    }
}
