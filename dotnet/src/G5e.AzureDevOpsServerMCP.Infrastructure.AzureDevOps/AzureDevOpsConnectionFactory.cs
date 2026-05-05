using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;
using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;

namespace G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;

/// <summary>
/// Factory for creating Azure DevOps connections.
/// </summary>
public interface IAzureDevOpsConnectionFactory
{
    /// <summary>
    /// Creates a new VssConnection from configuration options.
    /// </summary>
    /// <returns>A connected VssConnection instance.</returns>
    VssConnection CreateConnection();
}

/// <summary>
/// Default implementation of IAzureDevOpsConnectionFactory.
/// </summary>
public class AzureDevOpsConnectionFactory : IAzureDevOpsConnectionFactory
{
    private readonly AzureDevOpsOptions _options;

    public AzureDevOpsConnectionFactory(AzureDevOpsOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        
        if (string.IsNullOrWhiteSpace(_options.OrganizationUrl))
            throw new InvalidOperationException("AzureDevOpsOptions.OrganizationUrl is required");
        
        if (string.IsNullOrWhiteSpace(_options.PersonalAccessToken))
            throw new InvalidOperationException("AzureDevOpsOptions.PersonalAccessToken is required");
    }

    public VssConnection CreateConnection()
    {
        var uri = new Uri(_options.OrganizationUrl);
        var credentials = new VssBasicCredential("", _options.PersonalAccessToken);
        
        return new VssConnection(uri, credentials);
    }
}
