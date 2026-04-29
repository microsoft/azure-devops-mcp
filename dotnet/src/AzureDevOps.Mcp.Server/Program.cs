using AzureDevOps.Mcp.Tools;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

builder.Services
	.AddMcpServer()
	.WithToolsFromAssembly(typeof(HealthTools).Assembly)
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
