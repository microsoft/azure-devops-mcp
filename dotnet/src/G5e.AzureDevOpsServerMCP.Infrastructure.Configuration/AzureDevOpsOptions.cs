namespace G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;

/// <summary>
/// Configuration options for Azure DevOps integration.
/// </summary>
public class AzureDevOpsOptions
{
    public const string SectionName = "AzureDevOps";

    /// <summary>
    /// Gets or sets the Azure DevOps organization URL (e.g., https://dev.azure.com/myorg or https://myserver.com/tfs/DefaultCollection).
    /// </summary>
    public required string OrganizationUrl { get; set; }

    /// <summary>
    /// Gets or sets the Personal Access Token (PAT) for authentication.
    /// Can be read from environment variable or appsettings.json.
    /// Scopes required: "Code (Read & write)", "Work Items (Read & write)"
    /// </summary>
    public required string PersonalAccessToken { get; set; }

    /// <summary>
    /// Gets or sets the default project name for work item queries (optional).
    /// If set, GetWorkItemContext queries will default to this project.
    /// </summary>
    public string? DefaultProject { get; set; }

    /// <summary>
    /// Gets or sets the default repository name for branch operations (optional).
    /// If set, CreateFeatureBranch will default to this repository.
    /// </summary>
    public string? DefaultRepository { get; set; }

    /// <summary>
    /// Gets or sets whether to validate the configuration on startup.
    /// Default is true.
    /// </summary>
    public bool ValidateOnStartup { get; set; } = true;
}
