using System.Text.Json;
using AzureDevOps.Mcp.Application.Services;
using AzureDevOps.Mcp.Tools;

namespace AzureDevOps.Mcp.IntegrationTests;

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
    }
}
