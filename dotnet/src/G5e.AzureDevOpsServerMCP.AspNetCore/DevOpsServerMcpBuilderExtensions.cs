using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;
using G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps.Services;
using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using G5e.AzureDevOpsServerMCP.Tools;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ModelContextProtocol.Server;

namespace G5e.AzureDevOpsServerMCP.AspNetCore;

public static class DevOpsServerMcpBuilderExtensions
{
    public static IServiceCollection AddDevOpsServerMcpServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var azureDevOpsOptions = new AzureDevOpsOptions
        {
            OrganizationUrl = configuration["AzureDevOps:OrganizationUrl"]
                ?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_ORG_URL")
                ?? throw new InvalidOperationException("AzureDevOps:OrganizationUrl is required"),
            PersonalAccessToken = configuration["AzureDevOps:PersonalAccessToken"]
                ?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_PAT")
                ?? throw new InvalidOperationException("AzureDevOps:PersonalAccessToken is required"),
            DefaultProject = configuration["AzureDevOps:DefaultProject"]
                ?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_PROJECT"),
            DefaultRepository = configuration["AzureDevOps:DefaultRepository"]
                ?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_REPOSITORY")
        };

        services.AddHttpContextAccessor();

        services.AddSingleton(azureDevOpsOptions);
        services.AddSingleton<IAzureDevOpsConnectionFactory>(
            sp => new AzureDevOpsConnectionFactory(
                azureDevOpsOptions,
                sp.GetRequiredService<IHttpContextAccessor>()));

        services.AddScoped<IWorkItemContextService>(
            sp => new AzureDevOpsWorkItemContextService(
                sp.GetRequiredService<IAzureDevOpsConnectionFactory>(),
                sp.GetRequiredService<AzureDevOpsOptions>(),
                sp.GetRequiredService<IHttpContextAccessor>()));

        services.AddScoped<IRepositoryService>(
            sp => new AzureDevOpsRepositoryService(
                sp.GetRequiredService<IAzureDevOpsConnectionFactory>(),
                sp.GetRequiredService<AzureDevOpsOptions>(),
                sp.GetRequiredService<IHttpContextAccessor>()));

        services.AddScoped<WorkItemTools>();
        services.AddScoped<RepositoryTools>();

        return services;
    }

    public static IMcpServerBuilder AddDevOpsServerMCP(this IMcpServerBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        return builder.WithToolsFromAssembly(typeof(WorkItemTools).Assembly);
    }
}