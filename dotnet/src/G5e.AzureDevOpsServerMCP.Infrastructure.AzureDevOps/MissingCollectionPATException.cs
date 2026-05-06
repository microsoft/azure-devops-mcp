namespace G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;

/// <summary>
/// Exception thrown when a Personal Access Token for a specific collection is not configured or provided.
/// HTTP status code should be 401 Unauthorized.
/// </summary>
public class MissingCollectionPATException : InvalidOperationException
{
    public string CollectionName { get; }

    public MissingCollectionPATException(string collectionName)
        : base($"PAT not configured for collection '{collectionName}'. " +
               $"Provide PAT via X-AzureDevOps-Pat-{collectionName} header, X-AzureDevOps-Pat header, or AzureDevOps:PersonalAccessToken setting.")
    {
        CollectionName = collectionName;
    }
}
