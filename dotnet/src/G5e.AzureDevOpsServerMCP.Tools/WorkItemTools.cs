using System.Text.Json;
using System.ComponentModel;
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
    /// <param name="collection">The Azure DevOps collection name</param>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemId">The numeric work item ID</param>
    /// <returns>JSON object with work item details and comments</returns>
    [McpServerTool(Name = "wit_get_work_item")]
    [Description("Retrieves a work item's context including title, state, description, assigned user, and all comments.")]
    public async Task<string> GetWorkItemContext(string collection, string project, int workItemId)
    {
        try
        {
            var ctx = await _workItemContextService.GetWorkItemContextAsync(collection, project, workItemId);

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
    /// <param name="collection">The Azure DevOps collection name</param>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemId">The numeric work item ID</param>
    /// <param name="comment">The comment content to add. Azure DevOps stores comments as rich text (typically HTML), so formatting markup such as &lt;div&gt;, &lt;br&gt;, &amp;nbsp;, &lt;span&gt;, lists, and related HTML elements may be present.</param>
    /// <returns>JSON object with the created comment ID and URL</returns>
    [McpServerTool(Name = "wit_add_work_item_comment")]
    [Description("Adds a comment to a work item in Azure DevOps. Comments are stored as rich text (typically HTML), and may include markup such as div, br, nbsp, spans, lists, and other formatting elements.")]
    public async Task<string> AddWorkItemComment(string collection, string project, int workItemId, string comment)
    {
        try
        {
            var result = await _workItemContextService.AddCommentAsync(collection, project, workItemId, comment);

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

    /// <summary>
    /// Updates an existing comment on a work item.
    /// </summary>
    /// <param name="collection">The Azure DevOps collection name</param>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemId">The numeric work item ID</param>
    /// <param name="commentId">The ID of the comment to update</param>
    /// <param name="text">The updated comment content. Azure DevOps stores comments as rich text (typically HTML), so formatting markup such as &lt;div&gt;, &lt;br&gt;, &amp;nbsp;, &lt;span&gt;, lists, and related HTML elements may be present.</param>
    /// <returns>JSON object with the updated comment details</returns>
    [McpServerTool(Name = "wit_update_work_item_comment")]
    [Description("Updates an existing comment on a work item in Azure DevOps. Comments are stored as rich text (typically HTML), and may include markup such as div, br, nbsp, spans, lists, and other formatting elements.")]
    public async Task<string> UpdateWorkItemComment(string collection, string project, int workItemId, int commentId, string text)
    {
        try
        {
            var result = await _workItemContextService.UpdateCommentAsync(collection, project, workItemId, commentId, text);

            return JsonSerializer.Serialize(new
            {
                commentId = result.CommentId,
                workItemId = result.WorkItemId,
                text = result.Text,
                version = result.Version,
                url = result.Url,
                success = true
            }, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = ex.Message, type = ex.GetType().Name });
        }
    }

    /// <summary>
    /// Creates a new work item in a project.
    /// </summary>
    /// <param name="collection">The Azure DevOps collection name</param>
    /// <param name="project">The Azure DevOps project name or ID</param>
    /// <param name="workItemType">The work item type (e.g., "Task", "Bug", "User Story")</param>
    /// <param name="title">The work item title</param>
    /// <param name="description">The work item description (optional)</param>
    /// <returns>JSON object with the created work item ID, title, type, and URL</returns>
    [McpServerTool(Name = "wit_work_item_write_create")]
    [Description("Creates a new work item in an Azure DevOps project with a specified type, title, and optional description. Returns the work item ID, URL, and confirmation details.")]
    public async Task<string> CreateWorkItem(string collection, string project, string workItemType, string title, string? description = null)
    {
        try
        {
            var result = await _workItemContextService.CreateWorkItemAsync(collection, project, workItemType, title, description);

            return JsonSerializer.Serialize(new
            {
                workItemId = result.WorkItemId,
                title = result.Title,
                type = result.Type,
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
