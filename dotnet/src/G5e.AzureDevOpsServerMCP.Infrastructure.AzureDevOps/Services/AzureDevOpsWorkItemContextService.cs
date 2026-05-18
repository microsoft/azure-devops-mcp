using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;
using Microsoft.VisualStudio.Services.WebApi.Patch;
using Microsoft.VisualStudio.Services.WebApi.Patch.Json;

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
        string collection,
        string project,
        int workItemId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));

        using var connection = _connectionFactory.CreateConnection(collection);
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var workItem = await witClient.GetWorkItemAsync(
            project, workItemId, expand: WorkItemExpand.All, cancellationToken: cancellationToken);

        if (workItem == null)
            throw new InvalidOperationException($"Work item {workItemId} not found in project {project}");

        var comments = new List<WorkItemCommentResult>();
        try
        {
            var commentsResult = await witClient.GetCommentsAsync(project, workItemId, cancellationToken: cancellationToken);
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
        string collection,
        string project,
        int workItemId,
        string comment,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));
        if (string.IsNullOrWhiteSpace(comment))
            throw new ArgumentException("Comment cannot be empty", nameof(comment));

        using var connection = _connectionFactory.CreateConnection(collection);
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var request = new CommentCreate { Text = comment };
        var result = await witClient.AddCommentAsync(request, project, workItemId, cancellationToken: cancellationToken);

        return new AddCommentResult
        {
            CommentId = result.Id,
            Url = result.Url ?? string.Empty
        };
    }

    public async Task<UpdateCommentResult> UpdateCommentAsync(
        string collection,
        string project,
        int workItemId,
        int commentId,
        string text,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));
        if (commentId <= 0)
            throw new ArgumentException("Comment ID must be positive", nameof(commentId));
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Comment text cannot be empty", nameof(text));

        using var connection = _connectionFactory.CreateConnection(collection);
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var request = new CommentUpdate { Text = text };
        var result = await witClient.UpdateCommentAsync(request, project, workItemId, commentId, cancellationToken: cancellationToken);

        return new UpdateCommentResult
        {
            CommentId = result.Id,
            WorkItemId = result.WorkItemId,
            Text = result.Text ?? string.Empty,
            Version = result.Version,
            Url = result.Url
        };
    }

    private static string GetField(WorkItem wit, string fieldName) =>
        wit.Fields.TryGetValue(fieldName, out var val) ? val?.ToString() ?? string.Empty : string.Empty;

    private string? GetHeaderValue(string headerName)
    {
        var headers = _httpContextAccessor.HttpContext?.Request?.Headers;
        if (headers is null)
            return null;

        return headers.TryGetValue(headerName, out var value)
            ? value.ToString()
            : null;
    }

    public async Task<CreateWorkItemResult> CreateWorkItemAsync(
        string collection,
        string project,
        string workItemType,
        string title,
        string? description = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(collection))
            throw new ArgumentException("Collection cannot be empty", nameof(collection));
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (string.IsNullOrWhiteSpace(workItemType))
            throw new ArgumentException("Work item type cannot be empty", nameof(workItemType));
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title cannot be empty", nameof(title));

        using var connection = _connectionFactory.CreateConnection(collection);
        var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

        var patchDocument = new JsonPatchDocument
        {
            new JsonPatchOperation
            {
                Operation = Operation.Add,
                Path = "/fields/System.Title",
                Value = title
            }
        };

        if (!string.IsNullOrWhiteSpace(description))
        {
            patchDocument.Add(new JsonPatchOperation
            {
                Operation = Operation.Add,
                Path = "/fields/System.Description",
                Value = description
            });
        }

        try
        {
            var workItem = await witClient.CreateWorkItemAsync(patchDocument, project, workItemType, cancellationToken: cancellationToken);

            if (workItem == null)
                throw new InvalidOperationException("Failed to create work item");

            return new CreateWorkItemResult
            {
                WorkItemId = workItem.Id ?? 0,
                Title = GetField(workItem, "System.Title"),
                Type = GetField(workItem, "System.WorkItemType"),
                Url = workItem.Url
            };
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to create work item in project {project}: {ex.Message}", ex);
        }
    }
}
