using System.Text.Json;
using G5e.AzureDevOpsServerMCP.Application.Services;
using ModelContextProtocol.Server;

namespace G5e.AzureDevOpsServerMCP.Tools;

/// <summary>
/// Work item tools for Azure DevOps MCP server.
/// </summary>
[McpServerToolType]
public class WorkItemTools
{
    private readonly IWorkItemContextService _workItemContextService;

    public WorkItemTools(IWorkItemContextService workItemContextService)
    {
        _workItemContextService = workItemContextService ?? throw new ArgumentNullException(nameof(workItemContextService));
    }

    /// <summary>
    /// Gets the context of a work item including its details and comments.
    /// </summary>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemId">The numeric work item ID</param>
    /// <returns>JSON object with work item details and comments</returns>
    [McpServerTool(Name = "GetWorkItemContext")]
    public async Task<string> GetWorkItemContext(string project, int workItemId)
    {
        try
        {
            var ctx = await _workItemContextService.GetWorkItemContextAsync(project, workItemId);

            var result = new
            {
                workItem = new
                {
                    id = ctx.Id,
                    title = ctx.Title,
                    type = ctx.Type,
                    state = ctx.State,
                    description = ctx.Description,
                    assignedTo = ctx.AssignedTo,
                    url = ctx.Url
                },
                comments = ctx.Comments.Select(c => new
                {
                    id = c.Id,
                    author = c.Author,
                    content = c.Content,
                    createdDate = c.CreatedDate
                }),
                commentCount = ctx.Comments.Count
            };

            return JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }

    /// <summary>
    /// Adds a comment to an existing work item.
    /// </summary>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemId">The numeric work item ID</param>
    /// <param name="comment">The comment text to add (HTML or plain text)</param>
    /// <returns>JSON object with the created comment ID and URL</returns>
    [McpServerTool(Name = "AddWorkItemComment")]
    public async Task<string> AddWorkItemComment(string project, int workItemId, string comment)
    {
        try
        {
            var result = await _workItemContextService.AddCommentAsync(project, workItemId, comment);

            return JsonSerializer.Serialize(new
            {
                commentId = result.CommentId,
                url = result.Url,
                success = true
            }, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }
}
