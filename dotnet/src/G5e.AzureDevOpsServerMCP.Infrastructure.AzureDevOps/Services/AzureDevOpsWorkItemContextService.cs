using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;

namespace G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps.Services;

public class AzureDevOpsWorkItemContextService : IWorkItemContextService
{
    private readonly IAzureDevOpsConnectionFactory _connectionFactory;
    private readonly AzureDevOpsOptions _options;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AzureDevOpsWorkItemContextService(
        IAzureDevOpsConnectionFactory connectionFactory,
        AzureDevOpsOptions options,
        IHttpContextAccessor httpContextAccessor)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
    }

    public async Task<WorkItemContextResult> GetWorkItemContextAsync(
        string? project,
        int workItemId,
        CancellationToken cancellationToken = default)
    {
        var resolvedProject = ResolveProject(project);
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));

        using var connection = _connectionFactory.CreateConnection();
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var workItem = await witClient.GetWorkItemAsync(
            resolvedProject, workItemId, expand: WorkItemExpand.All, cancellationToken: cancellationToken);

        if (workItem == null)
            throw new InvalidOperationException($"Work item {workItemId} not found in project {resolvedProject}");

        var comments = new List<WorkItemCommentResult>();
        try
        {
            var commentsResult = await witClient.GetCommentsAsync(resolvedProject, workItemId, cancellationToken: cancellationToken);
            if (commentsResult?.Comments != null)
            {
                comments = commentsResult.Comments.Select(c => new WorkItemCommentResult
                {
                    Id = c.Id,
                    Author = c.CreatedBy?.DisplayName ?? "Unknown",
                    Content = c.Text ?? string.Empty,
                    CreatedDate = c.CreatedDate
                }).ToList();
            }
        }
        catch (VssServiceException)
        {
            // Comments API might not be available in older Azure DevOps Server versions
        }

        return new WorkItemContextResult
        {
            Id = workItem.Id ?? 0,
            Title = GetField(workItem, "System.Title"),
            Type = GetField(workItem, "System.WorkItemType"),
            State = GetField(workItem, "System.State"),
            Description = workItem.Fields.TryGetValue("System.Description", out var desc) ? desc?.ToString() : null,
            AssignedTo = workItem.Fields.TryGetValue("System.AssignedTo", out var assignee)
                ? (assignee is IdentityRef identity ? identity.DisplayName : assignee?.ToString())
                : null,
            Url = workItem.Url,
            Comments = comments
        };
    }

    public async Task<AddCommentResult> AddCommentAsync(
        string? project,
        int workItemId,
        string comment,
        CancellationToken cancellationToken = default)
    {
        var resolvedProject = ResolveProject(project);
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));
        if (string.IsNullOrWhiteSpace(comment))
            throw new ArgumentException("Comment cannot be empty", nameof(comment));

        using var connection = _connectionFactory.CreateConnection();
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var request = new CommentCreate { Text = comment };
        var result = await witClient.AddCommentAsync(request, resolvedProject, workItemId, cancellationToken: cancellationToken);

        return new AddCommentResult
        {
            CommentId = result.Id,
            Url = result.Url ?? string.Empty
        };
    }

    private static string GetField(WorkItem wit, string fieldName) =>
        wit.Fields.TryGetValue(fieldName, out var val) ? val?.ToString() ?? string.Empty : string.Empty;

    private string ResolveProject(string? project)
    {
        if (!string.IsNullOrWhiteSpace(project))
            return project;

        var headerProject = GetHeaderValue(AzureDevOpsHeaderNames.DefaultProject);
        if (!string.IsNullOrWhiteSpace(headerProject))
            return headerProject;

        if (!string.IsNullOrWhiteSpace(_options.DefaultProject))
            return _options.DefaultProject;

        throw new ArgumentException(
            "Project cannot be empty. Provide project argument, X-AzureDevOps-Default-Project header, or AzureDevOps:DefaultProject.",
            nameof(project));
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

