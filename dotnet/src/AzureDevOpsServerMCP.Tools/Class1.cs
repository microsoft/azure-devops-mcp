using ModelContextProtocol.Server;

namespace AzureDevOpsServerMCP.Tools;

[McpServerToolType]
public static class HealthTools
{
	[McpServerTool]
	public static string Ping()
	{
		return "pong";
	}
}
