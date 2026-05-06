using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;

namespace G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;

/// <summary>
/// Factory for creating Azure DevOps connections.
/// </summary>
public interface IAzureDevOpsConnectionFactory
{
    /// <summary>
    /// Creates a new VssConnection for the specified collection.
    /// </summary>
    /// <param name="collectionName">The Azure DevOps collection name</param>
    /// <returns>A connected VssConnection instance.</returns>
    /// <exception cref="MissingCollectionPATException">Thrown when no PAT is available for the collection.</exception>
    VssConnection CreateConnection(string collectionName);
}

/// <summary>
/// Default implementation of IAzureDevOpsConnectionFactory.
/// </summary>
public class AzureDevOpsConnectionFactory : IAzureDevOpsConnectionFactory
{
    private readonly AzureDevOpsOptions _options;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AzureDevOpsConnectionFactory(AzureDevOpsOptions options, IHttpContextAccessor httpContextAccessor)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));

        if (string.IsNullOrWhiteSpace(_options.OrganizationUrl))
            throw new InvalidOperationException("AzureDevOpsOptions.OrganizationUrl is required");
    }

    public VssConnection CreateConnection(string collectionName)
    {
        if (string.IsNullOrWhiteSpace(collectionName))
            throw new ArgumentException("Collection name cannot be empty", nameof(collectionName));

        // Build the collection URL by appending collection name to base OrganizationUrl
        var baseUrl = _options.OrganizationUrl.TrimEnd('/');
        var collectionUrl = $"{baseUrl}/{collectionName}";
        var uri = new Uri(collectionUrl);

        // Resolve PAT with priority:
        // 1. Collection-specific header (X-AzureDevOps-Pat-{CollectionName})
        // 2. Generic PAT header (X-AzureDevOps-Pat)
        // 3. Configuration PAT (AzureDevOps:PersonalAccessToken)
        // 4. Throw exception if none found
        var pat = ResolvePersonalAccessToken(collectionName);

        var credentials = new VssBasicCredential("", pat);
        return new VssConnection(uri, credentials);
    }

    /// <summary>
    /// Resolves the PAT to use for the specified collection, with proper fallback order.
    /// </summary>
    /// <param name="collectionName">The collection name</param>
    /// <returns>The resolved PAT</returns>
    /// <exception cref="MissingCollectionPATException">Thrown when no PAT is available</exception>
    private string ResolvePersonalAccessToken(string collectionName)
    {
        // Try collection-specific header: X-AzureDevOps-Pat-{CollectionName}
        var collectionSpecificHeaderName = string.Format(AzureDevOpsHeaderNames.PersonalAccessTokenPattern, collectionName);
        var collectionPat = GetHeaderValue(collectionSpecificHeaderName);
        if (!string.IsNullOrWhiteSpace(collectionPat))
            return collectionPat;

        // No PAT found - throw specific exception
        throw new MissingCollectionPATException(collectionName);
    }

    private string? GetHeaderValue(string headerName)
    {
        var headers = _httpContextAccessor.HttpContext?.Request?.Headers;
        if (headers is null)
            return null;

        return headers.TryGetValue(headerName, out var value)
            ? value.ToString()
            : null;
    }
}
