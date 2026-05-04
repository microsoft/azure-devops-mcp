using Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models;

namespace AzureDevOpsServerMCP.Infrastructure.AzureDevOps;

/// <summary>
/// Data transfer object representing a work item with its context.
/// </summary>
public class WorkItemContextDto
{
    public required WorkItem WorkItem { get; set; }
    public List<Comment> Comments { get; set; } = [];
}
