using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.TeamFoundation.SourceControl.WebApi;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;
using Microsoft.VisualStudio.Services.WebApi.Patch;
using Microsoft.VisualStudio.Services.WebApi.Patch.Json;

namespace G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps.Services;

public class AzureDevOpsRepositoryService : IRepositoryService
{
    private readonly IAzureDevOpsConnectionFactory _connectionFactory;
    private readonly AzureDevOpsOptions _options;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AzureDevOpsRepositoryService(
        IAzureDevOpsConnectionFactory connectionFactory,
        AzureDevOpsOptions options,
        IHttpContextAccessor httpContextAccessor)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
    }

    public async Task<CreateBranchResult> CreateBranchAsync(
        string collection,
        string project,
        string repository,
        string branchName,
        string fromBranch,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (string.IsNullOrWhiteSpace(repository))
            throw new ArgumentException("Repository cannot be empty", nameof(repository));
        if (string.IsNullOrWhiteSpace(branchName))
            throw new ArgumentException("Branch name cannot be empty", nameof(branchName));
        if (string.IsNullOrWhiteSpace(fromBranch))
            throw new ArgumentException("Source branch cannot be empty", nameof(fromBranch));

        using var connection = _connectionFactory.CreateConnection(collection);
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

    public async Task<LinkBranchResult> LinkBranchToWorkItemAsync(
        string? collection,
        string? project,
        string? repository,
        string branchName,
        int workItemId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (string.IsNullOrWhiteSpace(repository))
            throw new ArgumentException("Repository cannot be empty", nameof(repository));
        if (string.IsNullOrWhiteSpace(branchName))
            throw new ArgumentException("Branch name cannot be empty", nameof(branchName));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));

        using var connection = _connectionFactory.CreateConnection(collection);
        var gitClient = connection.GetClient<GitHttpClient>();
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        // Get repo to obtain project ID and repository ID (GUIDs required for vstfs URL)
        var repo = await gitClient.GetRepositoryAsync(project, repository, cancellationToken: cancellationToken);

        // Build the vstfs artifact URL for the branch
        // Format: vstfs:///Git/Ref/{projectId}/{repoId}/{encodedRef}
        // Branch encoding: refs/heads/branchname → GB + URL-encoded branchname
        var encodedBranch = "GB" + Uri.EscapeDataString(branchName);
        var vstfsUrl = $"vstfs:///Git/Ref/{repo.ProjectReference.Id}/{repo.Id}/{encodedBranch}";

        var patchDocument = new JsonPatchDocument
        {
            new JsonPatchOperation
            {
                Operation = Operation.Add,
                Path = "/relations/-",
                Value = new
                {
                    rel = "ArtifactLink",
                    url = vstfsUrl,
                    attributes = new { name = "Branch" }
                }
            }
        };

        await witClient.UpdateWorkItemAsync(patchDocument, workItemId, cancellationToken: cancellationToken);

        return new LinkBranchResult
        {
            WorkItemId = workItemId,
            BranchName = branchName,
            Repository = repository
        };
    }

    public async Task<CreatePullRequestResult> CreatePullRequestAsync(
        string? collection,
        string? project,
        string? repository,
        string sourceBranch,
        string targetBranch,
        string title,
        string? description,
        int workItemId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (string.IsNullOrWhiteSpace(repository))
            throw new ArgumentException("Repository cannot be empty", nameof(repository));
        if (string.IsNullOrWhiteSpace(sourceBranch))
            throw new ArgumentException("Source branch cannot be empty", nameof(sourceBranch));
        if (string.IsNullOrWhiteSpace(targetBranch))
            throw new ArgumentException("Target branch cannot be empty", nameof(targetBranch));
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title cannot be empty", nameof(title));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));

        using var connection = _connectionFactory.CreateConnection(collection);
        var gitClient = connection.GetClient<GitHttpClient>();

        var pullRequest = new GitPullRequest
        {
            Title = title,
            Description = description,
            SourceRefName = $"refs/heads/{sourceBranch}",
            TargetRefName = $"refs/heads/{targetBranch}",
            WorkItemRefs = [new ResourceRef { Id = workItemId.ToString() }]
        };

        var createdPr = await gitClient.CreatePullRequestAsync(
            pullRequest,
            repositoryId: repository,
            project: project,
            cancellationToken: cancellationToken);

        return new CreatePullRequestResult
        {
            PullRequestId = createdPr.PullRequestId,
            Title = createdPr.Title,
            Url = createdPr.Url ?? string.Empty,
            Status = createdPr.Status.ToString()
        };
    }

    private string? GetHeaderValue(string headerName)
    {
        var headers = _httpContextAccessor.HttpContext?.Request?.Headers;
        if (headers is null)
            return null;

        return headers.TryGetValue(headerName, out var value)
            ? value.ToString()
            : null;
    }
}
