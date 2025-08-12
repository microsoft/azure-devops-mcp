# 🥇 How to make your experience better

Be sure to follow all the steps in the [Getting Started guide](./GETTINGSTARTED.md) to quickly set up and connect to your Azure DevOps organization.

## Modify Copilot Instructions

The `.github/copilot-instructions.md` file is a great way to customize the GitHub Copilot experience, especially when working with MCP Server for Azure DevOps.

From the [GitHub documentation](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot):

> Instead of repeatedly adding this contextual detail to your chat questions, you can create a file in your repository that automatically adds this information for you. The additional information is not displayed in the chat but is available to Copilot to allow it to generate higher-quality responses.

## Example Modification

Here is an example modification you can add to your existing `.github/copilot-instructions.md` file.

```markdown
## Using MCP Server for Azure DevOps

When getting work items using MCP Server for Azure DevOps, always try to use batch tools for updates instead of many individual single updates. For updates, try and update up to 200 updates in a single batch. When getting work items, once you get the list of IDs, use the tool `get_work_items_batch_by_ids` to get the work item details. By default, show fields ID, Type, Title, State. Show work item results in a rendered markdown table.
```

## Use different models

Communicating with the LLM is both an art and a science. If the model does not respond well, switching to a different model may improve your results.
