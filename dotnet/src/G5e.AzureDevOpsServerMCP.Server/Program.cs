using G5e.AzureDevOpsServerMCP.AspNetCore;
using G5e.AzureDevOpsServerMCP.Infrastructure.AzureDevOps;
using System.Text.Json;

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

// Exception handling middleware for collection-specific authentication errors
app.Use(async (context, next) =>
{
	try
	{
		await next();
	}
	catch (MissingCollectionPATException ex)
	{
		context.Response.StatusCode = StatusCodes.Status401Unauthorized;
		context.Response.ContentType = "application/json";
		await context.Response.WriteAsJsonAsync(new { error = ex.Message, exceptionType = nameof(MissingCollectionPATException) });
	}
	catch (Exception ex)
	{
		// Let other exceptions propagate for default ASP.NET handling
		throw;
	}
});

app.MapGet("/", () => Results.Ok(new
{
	service = "G5e.AzureDevOpsServerMCP",
	status = "running",
}));

app.MapHealthChecks("/health");
app.MapMcp("/mcp");

app.Run();
