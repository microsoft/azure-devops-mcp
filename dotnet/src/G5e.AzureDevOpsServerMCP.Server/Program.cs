using G5e.AzureDevOpsServerMCP.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();
builder.Services.AddDevOpsServerMcpServices(builder.Configuration);

builder.Services
	.AddMcpServer()
	.AddDevOpsServerMCP()
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
