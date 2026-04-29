using ModelContextProtocol.Server;

namespace AzureDevOps.Mcp.Tools;

[McpServerToolType]
public static class HealthTools
{
	[McpServerTool]
	public static string Ping()
	{
		return "pong";
	}
}
