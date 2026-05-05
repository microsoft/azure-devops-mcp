using System.Text.Json;
using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Tools;

namespace G5e.AzureDevOpsServerMCP.IntegrationTests;

public class WorkItemToolsFixtureTests
{
    [Fact]
    public async Task GetWorkItemContext_UsesFixtureBackedService_AndSerializesExpectedShape()
    {
        var fixturePath = Path.Combine(AppContext.BaseDirectory, "Fixtures", "work-item-context-result.json");
        var service = new FixtureBackedWorkItemContextService(fixturePath);
        var sut = new WorkItemTools(service);

        var json = await sut.GetWorkItemContext("UZG.IZ.PrestIZ", 1);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var workItem = root.GetProperty("workItem");
        var comments = root.GetProperty("comments");

        Assert.Equal(1, workItem.GetProperty("id").GetInt32());
        Assert.Equal("Als ontwikkelaar wil ik work items ophalen via een MCP server zodat mijn AI-assistent context heeft over mijn taken", workItem.GetProperty("title").GetString());
        Assert.Equal("User Story", workItem.GetProperty("type").GetString());
        Assert.Equal("New", workItem.GetProperty("state").GetString());
        Assert.Equal("Gadeyne Bram", workItem.GetProperty("assignedTo").GetString());
        Assert.Equal(1, root.GetProperty("commentCount").GetInt32());
        Assert.Equal(1, comments.GetArrayLength());
        Assert.Contains("Spike afgerond", comments[0].GetProperty("content").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetWorkItemContext_WhenServiceThrows_ReturnsSerializedError()
    {
        var sut = new WorkItemTools(new ThrowingWorkItemContextService(new InvalidOperationException("fixture failure")));

        var json = await sut.GetWorkItemContext("UZG.IZ.PrestIZ", 1);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("fixture failure", root.GetProperty("error").GetString());
        Assert.Equal("InvalidOperationException", root.GetProperty("type").GetString());
    }

    private sealed class FixtureBackedWorkItemContextService : IWorkItemContextService
    {
        private readonly string _fixturePath;

        public FixtureBackedWorkItemContextService(string fixturePath)
        {
            _fixturePath = fixturePath;
        }

        public async Task<WorkItemContextResult> GetWorkItemContextAsync(string project, int workItemId, CancellationToken cancellationToken = default)
        {
            var json = await File.ReadAllTextAsync(_fixturePath, cancellationToken);
            var result = JsonSerializer.Deserialize<WorkItemContextResult>(json);

            if (result is null)
            {
                throw new InvalidOperationException("Fixture could not be deserialized.");
            }

            return result;
        }

        public Task<AddCommentResult> AddCommentAsync(string project, int workItemId, string comment, CancellationToken cancellationToken = default)
            => Task.FromResult(new AddCommentResult { CommentId = 1, Url = string.Empty });
    }

    private sealed class ThrowingWorkItemContextService : IWorkItemContextService
    {
        private readonly Exception _exception;

        public ThrowingWorkItemContextService(Exception exception)
        {
            _exception = exception;
        }

        public Task<WorkItemContextResult> GetWorkItemContextAsync(string project, int workItemId, CancellationToken cancellationToken = default)
            => Task.FromException<WorkItemContextResult>(_exception);

        public Task<AddCommentResult> AddCommentAsync(string project, int workItemId, string comment, CancellationToken cancellationToken = default)
            => Task.FromException<AddCommentResult>(_exception);
    }

    [Fact]
    public async Task AddWorkItemComment_ReturnsSerializedCommentId()
    {
        var sut = new WorkItemTools(new FakeAddCommentWorkItemContextService());

        var json = await sut.AddWorkItemComment("UZG.IZ.PrestIZ", 1, "Test comment via MCP");

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(42, root.GetProperty("commentId").GetInt32());
        Assert.True(root.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task AddWorkItemComment_WhenServiceThrows_ReturnsSerializedError()
    {
        var sut = new WorkItemTools(new ThrowingWorkItemContextService(new InvalidOperationException("comment failed")));

        var json = await sut.AddWorkItemComment("UZG.IZ.PrestIZ", 1, "Test comment");

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("comment failed", root.GetProperty("error").GetString());
        Assert.Equal("InvalidOperationException", root.GetProperty("type").GetString());
    }

    private sealed class FakeAddCommentWorkItemContextService : IWorkItemContextService
    {
        public Task<WorkItemContextResult> GetWorkItemContextAsync(string project, int workItemId, CancellationToken cancellationToken = default)
            => Task.FromResult(new WorkItemContextResult());

        public Task<AddCommentResult> AddCommentAsync(string project, int workItemId, string comment, CancellationToken cancellationToken = default)
            => Task.FromResult(new AddCommentResult { CommentId = 42, Url = "https://example.invalid/comment/42" });
    }
}