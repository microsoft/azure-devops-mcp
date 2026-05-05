using ModelContextProtocol.Server;

namespace G5e.AzureDevOpsServerMCP.Tools;

[McpServerToolType]
public static class HealthTools
{
	[McpServerTool]
	public static string Ping()
	{
		return "pong";
	}
}
