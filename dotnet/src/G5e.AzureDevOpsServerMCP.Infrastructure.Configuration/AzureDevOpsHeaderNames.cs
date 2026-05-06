namespace G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;

/// <summary>
/// Header names supported by the .NET MCP server for per-request overrides.
/// </summary>
public static class AzureDevOpsHeaderNames
{
    /// <summary>
    /// Collection-specific PAT header pattern: X-AzureDevOps-Pat-{CollectionName}
    /// Example: X-AzureDevOps-Pat-DefaultCollection
    /// </summary>
    public const string PersonalAccessTokenPattern = "X-AzureDevOps-Pat-{0}";
}
