using System.Text.Json;
using AzureDevOps.Mcp.Application.Services;
using ModelContextProtocol.Server;

namespace AzureDevOps.Mcp.Tools;

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
}
