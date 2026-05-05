using G5e.AzureDevOpsServerMCP.Infrastructure.Configuration;
using G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;
using G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps.Services;
using G5e.AzureDevOpsServerMCP.Application.Services;
using G5e.AzureDevOpsServerMCP.Tools;

var builder = WebApplication.CreateBuilder(args);

// Get Azure DevOps configuration from environment or appsettings
var azureDevOpsOptions = new AzureDevOpsOptions
{
	OrganizationUrl = builder.Configuration["AzureDevOps:OrganizationUrl"] 
		?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_ORG_URL")
		?? throw new InvalidOperationException("AzureDevOps:OrganizationUrl is required"),
	PersonalAccessToken = builder.Configuration["AzureDevOps:PersonalAccessToken"]
		?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_PAT")
		?? throw new InvalidOperationException("AzureDevOps:PersonalAccessToken is required"),
	DefaultProject = builder.Configuration["AzureDevOps:DefaultProject"]
		?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_PROJECT"),
	DefaultRepository = builder.Configuration["AzureDevOps:DefaultRepository"]
		?? Environment.GetEnvironmentVariable("AZURE_DEVOPS_REPOSITORY")
};

builder.Services.AddHealthChecks();

// Register Azure DevOps services
builder.Services.AddSingleton(azureDevOpsOptions);
builder.Services.AddSingleton<IAzureDevOpsConnectionFactory>(
	sp => new AzureDevOpsConnectionFactory(azureDevOpsOptions));
builder.Services.AddScoped<IWorkItemContextService, AzureDevOpsWorkItemContextService>();
builder.Services.AddScoped<IRepositoryService, AzureDevOpsRepositoryService>();

// Register tools that need DI
builder.Services.AddScoped<WorkItemTools>();
builder.Services.AddScoped<RepositoryTools>();

builder.Services
	.AddMcpServer()
	.WithToolsFromAssembly(typeof(WorkItemTools).Assembly)
	.WithHttpTransport(options =>
	{
		options.Stateless = true;
	});

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new
{
	service = "azure-devops-mcp-dotnet",
	status = "running",
}));

app.MapHealthChecks("/health");
app.MapMcp("/mcp");

app.Run();
