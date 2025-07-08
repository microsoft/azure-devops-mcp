---
name: Add new tool(s)
about: Use this template to leverage AI to add the tools you want
labels: enhancement, feature-request
---

## Replace the content with your actual issue making sure to keep similar style so that GitHub Copilot can generate this change for you!

# Summary

Implement two new tools that integrate with Azure DevOps APIs to enable search capabilities.

# Tools

Develop the following tools with full parameter support, including optional ones:

## `search_wiki`: Search Azure DevOps Wikis for relevant content.

Endpoint: POST https://almsearch.dev.azure.com/{organization}/{project}/_apis/search/wikisearchresults?api-version=7.2-preview.1

## `search_code`: Search Azure DevOps Repos for relevant code results.

Endpoint: POST https://almsearch.dev.azure.com/{organization}/{project}/_apis/search/codesearchresults?api-version=7.2-preview.1

# Rules

1. Adhere strictly to existing project standards and coding conventions.
2. Ensure each tool exposes all API parameters (required and optional).
3. Use the official [Azure DevOps Node API](https://github.com/microsoft/azure-devops-node-api) to interact with the APIs.

# Special treat

If you follow the rules, you'll get candy!
