using System.Text.Json;
using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Tools;

namespace G5e.AzureDevOpsServerMCP.IntegrationTests;

public class RepositoryToolsFixtureTests
{
    [Fact]
    public async Task CreateFeatureBranch_UsesFixtureBackedService_AndSerializesExpectedShape()
    {
        // Arrange
        var service = new FakeRepositoryService();
        var sut = new RepositoryTools(service);

        // Act
        var json = await sut.CreateFeatureBranch("TestProject", "TestRepo", "feature/TEST-123", "main");

        // Assert
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("feature/TEST-123", root.GetProperty("branchName").GetString());
        Assert.NotEmpty(root.GetProperty("objectId").GetString()!);
        Assert.True(root.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task CreateFeatureBranch_WhenServiceThrows_ReturnsSerializedError()
    {
        // Arrange
        var service = new ThrowingRepositoryService(new InvalidOperationException("Branch already exists"));
        var sut = new RepositoryTools(service);

        // Act
        var json = await sut.CreateFeatureBranch("TestProject", "TestRepo", "feature/TEST-123", "main");

        // Assert
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("Branch already exists", root.GetProperty("error").GetString());
        Assert.Equal("InvalidOperationException", root.GetProperty("type").GetString());
    }
    [Fact]
    public async Task CreatePullRequestForWorkItem_ReturnsSerializedResult()
    {
        var sut = new RepositoryTools(new FakeRepositoryService());

        var json = await sut.CreatePullRequestForWorkItem(
            "TestProject",
            "TestRepo",
            "feature/TEST-123",
            "main",
            "Implement TEST-123",
            42,
            "## Summary\n- Implemented TEST-123");

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(99, root.GetProperty("pullRequestId").GetInt32());
        Assert.Equal("Implement TEST-123", root.GetProperty("title").GetString());
        Assert.Equal("active", root.GetProperty("status").GetString());
        Assert.True(root.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task CreatePullRequestForWorkItem_WhenServiceThrows_ReturnsSerializedError()
    {
        var sut = new RepositoryTools(new ThrowingRepositoryService(new InvalidOperationException("source branch not found")));

        var json = await sut.CreatePullRequestForWorkItem(
            "TestProject",
            "TestRepo",
            "feature/TEST-123",
            "main",
            "Implement TEST-123",
            42,
            "## Summary\n- Failing case");

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("source branch not found", root.GetProperty("error").GetString());
        Assert.Equal("InvalidOperationException", root.GetProperty("type").GetString());
    }

        [Fact]
        public async Task LinkBranchToWorkItem_ReturnsSerializedResult()
        {
            var sut = new RepositoryTools(new FakeRepositoryService());

            var json = await sut.LinkBranchToWorkItem("TestProject", "TestRepo", "feature/TEST-123", 42);

            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;

            Assert.Equal(42, root.GetProperty("workItemId").GetInt32());
            Assert.Equal("feature/TEST-123", root.GetProperty("branchName").GetString());
            Assert.Equal("TestRepo", root.GetProperty("repository").GetString());
            Assert.True(root.GetProperty("success").GetBoolean());
        }

        [Fact]
        public async Task LinkBranchToWorkItem_WhenServiceThrows_ReturnsSerializedError()
        {
            var sut = new RepositoryTools(new ThrowingRepositoryService(new InvalidOperationException("repository not found")));

            var json = await sut.LinkBranchToWorkItem("TestProject", "TestRepo", "feature/TEST-123", 42);

            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;

            Assert.Equal("repository not found", root.GetProperty("error").GetString());
            Assert.Equal("InvalidOperationException", root.GetProperty("type").GetString());
        }

        private sealed class FakeRepositoryService : IRepositoryService
    {
        public Task<CreateBranchResult> CreateBranchAsync(
            string project,
            string repository,
            string branchName,
            string fromBranch,
            CancellationToken cancellationToken = default)
        {
            var result = new CreateBranchResult
            {
                BranchName = branchName,
                ObjectId = "abc123def456abc123def456abc123def456abc1",
                Url = $"https://example.invalid/{project}/_git/{repository}/refs/heads/{branchName}"
            };

            return Task.FromResult(result);
        }

        public Task<LinkBranchResult> LinkBranchToWorkItemAsync(
            string project,
            string repository,
            string branchName,
            int workItemId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new LinkBranchResult
            {
                WorkItemId = workItemId,
                BranchName = branchName,
                Repository = repository
            });

        public Task<CreatePullRequestResult> CreatePullRequestAsync(
            string project,
            string repository,
            string sourceBranch,
            string targetBranch,
            string title,
            string? description,
            int workItemId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new CreatePullRequestResult
            {
                PullRequestId = 99,
                Title = title,
                Url = $"https://example.invalid/{project}/_git/{repository}/pullrequest/99",
                Status = "active"
            });
    }

    private sealed class ThrowingRepositoryService : IRepositoryService
    {
        private readonly Exception _exception;

        public ThrowingRepositoryService(Exception exception)
        {
            _exception = exception;
        }

        public Task<CreateBranchResult> CreateBranchAsync(
            string project,
            string repository,
            string branchName,
            string fromBranch,
            CancellationToken cancellationToken = default)
            => Task.FromException<CreateBranchResult>(_exception);

        public Task<LinkBranchResult> LinkBranchToWorkItemAsync(
            string project,
            string repository,
            string branchName,
            int workItemId,
            CancellationToken cancellationToken = default)
            => Task.FromException<LinkBranchResult>(_exception);

        public Task<CreatePullRequestResult> CreatePullRequestAsync(
            string project,
            string repository,
            string sourceBranch,
            string targetBranch,
            string title,
            string? description,
            int workItemId,
            CancellationToken cancellationToken = default)
            => Task.FromException<CreatePullRequestResult>(_exception);
    }
}
