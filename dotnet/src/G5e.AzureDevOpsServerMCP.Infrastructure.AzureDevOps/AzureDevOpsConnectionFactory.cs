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
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AzureDevOpsConnectionFactory(AzureDevOpsOptions options, IHttpContextAccessor httpContextAccessor)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));

        if (string.IsNullOrWhiteSpace(_options.OrganizationUrl))
            throw new InvalidOperationException("AzureDevOpsOptions.OrganizationUrl is required");

        if (string.IsNullOrWhiteSpace(_options.PersonalAccessToken))
            throw new InvalidOperationException("AzureDevOpsOptions.PersonalAccessToken is required");
    }

    public VssConnection CreateConnection()
    {
        var uri = new Uri(_options.OrganizationUrl);

        // Header PAT has priority over configured/system PAT for per-developer auth.
        var pat = GetHeaderValue(AzureDevOpsHeaderNames.PersonalAccessToken)
            ?? _options.PersonalAccessToken;

        var credentials = new VssBasicCredential("", pat);
        return new VssConnection(uri, credentials);
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
