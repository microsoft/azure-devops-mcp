# Frequently Asked Questions

Before you get started, ensure you follow the steps in the `README.md` file. This will help you get up and running and connected to your Azure DevOps organization.

## Does the MCP Server support both Azure DevOps Services and on-premises deployments?

Currently, the MCP Server supports only Azure DevOps Services. Several required API endpoints are not yet available for on-premises deployments. Additionally, focusing on Azure DevOps Services during the public preview makes it easier to debug and deliver fixes.

## Can I connect to more than one organization at a time?

No, you can connect to only one organization at a time. However, you can switch organizations as needed.

## Can I set a default project instead of fetching the list every time?

Currently, you need to fetch the list of projects so the LLM has context about the project name or ID. We plan to improve this experience in the future by leveraging prompts. In the meantime, you can set a default project name in your `copilot-instructions.md` file.

## Are PAT's supported?

Sorry, PAT's are currently not supported in this local MCP Sever.

## Is there a remote supported version of the MCP Server?

At this time, only the local version of the MCP Server is supported.
