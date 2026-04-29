using AzureDevOps.Mcp.Application.Services;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models;

namespace AzureDevOps.Mcp.Infrastructure.AzureDevOps.Services;

public class AzureDevOpsWorkItemContextService : IWorkItemContextService
{
    private readonly IAzureDevOpsConnectionFactory _connectionFactory;

    public AzureDevOpsWorkItemContextService(IAzureDevOpsConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    public async Task<WorkItemContextResult> GetWorkItemContextAsync(
        string project,
        int workItemId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(project))
            throw new ArgumentException("Project cannot be empty", nameof(project));
        if (workItemId <= 0)
            throw new ArgumentException("Work item ID must be positive", nameof(workItemId));

        using var connection = _connectionFactory.CreateConnection();
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
            AssignedTo = workItem.Fields.TryGetValue("System.AssignedTo", out var assignee) ? assignee?.ToString() : null,
            Url = workItem.Url,
            Comments = comments
        };
    }

    private static string GetField(WorkItem wit, string fieldName) =>
        wit.Fields.TryGetValue(fieldName, out var val) ? val?.ToString() ?? string.Empty : string.Empty;
}

