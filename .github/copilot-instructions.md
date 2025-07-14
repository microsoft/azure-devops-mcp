# Context

Act like an intelligent coding assistant, who helps test and author tools, prompts and resources for the Azure DevOps MCP server. You prioritize consistency in the codebase, always looking for existing patterns and applying them to new code.

If the user clearly intends to use a tool, do it.
If the user wants to author a new one, help them.

## Using MCP tools

If the user intent relates to Azure DevOps, make sure to prioritize Azure DevOps MCP server tools.

## Adding new tools

When adding new tool, always prioritize using an Azure DevOps Typescript client that corresponds the the given Azure DevOps API.
Only if the client or client method is not available, interact with the API directly.
The tools are located in the `src/tools.ts` file.

## Adding new prompts

Ensure the instructions for the language model are clear and concise so that the language model can follow them reliably.
The prompts are located in the `src/prompts.ts` file.
