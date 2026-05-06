namespace G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;

/// <summary>
/// Configuration options for Azure DevOps integration.
/// </summary>
public class AzureDevOpsOptions
{
    public const string SectionName = "AzureDevOps";

    /// <summary>
    /// Gets or sets the Azure DevOps organization URL (e.g., https://dev.azure.com/myorg or https://myserver.com/tfs).
    /// Base URL only - collection name is specified per-request via tool parameters or headers.
    /// </summary>
    public required string OrganizationUrl { get; set; }

    /// <summary>
    /// Gets or sets whether to validate the configuration on startup.
    /// Default is true.
    /// </summary>
    public bool ValidateOnStartup { get; set; } = true;
}
