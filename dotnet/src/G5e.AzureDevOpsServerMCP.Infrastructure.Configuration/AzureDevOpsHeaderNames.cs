namespace G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;

/// <summary>
/// Header names supported by the .NET MCP server for per-request overrides.
/// </summary>
public static class AzureDevOpsHeaderNames
{
    public const string PersonalAccessToken = "X-AzureDevOps-Pat";
    public const string DefaultProject = "X-AzureDevOps-Default-Project";
    public const string DefaultRepository = "X-AzureDevOps-Default-Repository";
}
