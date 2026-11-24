// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { constants, open, realpath } from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { IRequestHandler } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js";
import { WorkItemExpand, WorkItemRelation } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { QueryExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { z } from "zod";
import { batchApiVersion, markdownCommentsApiVersion, getEnumKeys, safeEnumConvert, encodeFormattedValue } from "../utils.js";
import { elicitProject, elicitTeam } from "../shared/elicitations.js";
import { createExternalContentResponse } from "../shared/content-safety.js";
import { dateInputSchema } from "../shared/tool-schemas.js";
import { getUserIdentityFromEmail } from "./auth.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Command, CommandContext, CommandRegistry, dispatchAction, errorResult } from "../shared/command.js";
import {
  witWorkItemWriteShape,
  witWorkItemCommentWriteShape,
  witWorkItemLinkWriteShape,
  CreateWorkItemArgs,
  UpdateWorkItemArgs,
  UpdateWorkItemsBatchArgs,
  AddChildWorkItemsArgs,
  WitWorkItemWriteArgs,
  AddWorkItemCommentArgs,
  UpdateWorkItemCommentArgs,
  WitWorkItemCommentWriteArgs,
  LinkWorkItemsArgs,
  UnlinkWorkItemArgs,
  LinkWorkItemToPullRequestArgs,
  AddArtifactLinkArgs,
  WitWorkItemLinkWriteArgs,
} from "./work-items.dto.js";

const WORKITEM_TOOLS = {
  wit_work_item: "wit_work_item",
  wit_query: "wit_query",
  wit_backlog: "wit_backlog",
  wit_work_item_attachment: "wit_work_item_attachment",
  wit_work_item_attachment_upload: "wit_work_item_attachment_upload",
  wit_work_item_attachment_link: "wit_work_item_attachment_link",
  wit_work_item_write: "wit_work_item_write",
  wit_work_item_comment_write: "wit_work_item_comment_write",
  wit_work_item_link_write: "wit_work_item_link_write",
};

const readConsistencyHandler: IRequestHandler = {
  prepareRequest(options) {
    options.headers = { ...options.headers, "X-VSS-ReadConsistencyLevel": "Eventual" };
  },
  canHandleAuthentication: () => false,
  async handleAuthentication() {
    throw new Error("The read-consistency handler does not handle authentication.");
  },
};

function getReadReplicaWorkItemTrackingApi(connection: WebApi) {
  return connection.getWorkItemTrackingApi(undefined, [connection.authHandler, readConsistencyHandler]);
}

function getLinkTypeFromName(name: string) {
  switch (name.toLowerCase()) {
    case "parent":
      return "System.LinkTypes.Hierarchy-Reverse";
    case "child":
      return "System.LinkTypes.Hierarchy-Forward";
    case "duplicate":
      return "System.LinkTypes.Duplicate-Forward";
    case "duplicate of":
      return "System.LinkTypes.Duplicate-Reverse";
    case "related":
      return "System.LinkTypes.Related";
    case "successor":
      return "System.LinkTypes.Dependency-Forward";
    case "predecessor":
      return "System.LinkTypes.Dependency-Reverse";
    case "tested by":
      return "Microsoft.VSTS.Common.TestedBy-Forward";
    case "tests":
      return "Microsoft.VSTS.Common.TestedBy-Reverse";
    case "affects":
      return "Microsoft.VSTS.Common.Affects-Forward";
    case "affected by":
      return "Microsoft.VSTS.Common.Affects-Reverse";
    case "artifact":
      return "ArtifactLink";
    case "hyperlink":
      return "Hyperlink";
    default:
      throw new Error(`Unknown link type: ${name}`);
  }
}

function getArtifactLinkAttributeName(linkType: string): string {
  switch (linkType) {
    case "Wiki":
      return "Wiki Page";
    default:
      return linkType;
  }
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

async function prepareCommentText(
  text: string,
  format: "Markdown" | "Html" | undefined,
  tokenProvider: () => Promise<string>,
  connectionProvider: () => Promise<WebApi>,
  userAgentProvider: () => string
): Promise<string> {
  const emailMatches = [...text.matchAll(/@<([^<>\s]+@[^<>\s]+)>/g)];

  const identities = new Map<string, { id: string; displayName: string }>();
  for (const email of new Set(emailMatches.map((match) => match[1]))) {
    try {
      identities.set(email, await getUserIdentityFromEmail(email, tokenProvider, connectionProvider, userAgentProvider));
    } catch {
      // Leave mentions unchanged when their identities cannot be resolved.
    }
  }

  // Encode Markdown transport text once, preserving mention tokens for Azure DevOps.
  // Encoding ampersands also preserves intentional entity text after one decode.
  const markdown = format === "Markdown" || format === undefined;
  return text.replace(/@<([^<>\s]+@[^<>\s]+)>|@<([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>|[&<>]/gi, (mention, email: string | undefined, id: string | undefined) => {
    if (id) return mention;
    if (!email) return markdown ? escapeHtml(mention) : mention;
    const identity = identities.get(email);
    if (!identity) return escapeHtml(mention);
    return markdown ? `@<${identity.id}>` : `<a href="#" data-vss-mention="version:2.0,${identity.id}">@${escapeHtml(identity.displayName)}</a>`;
  });
}

const createWorkItemCommand = (server: McpServer): Command<CreateWorkItemArgs> => ({
  async execute(context: CommandContext, args: CreateWorkItemArgs): Promise<CallToolResult> {
    const { workItemType, fields } = args;
    if (!workItemType) return errorResult("workItemType is required for create");
    if (!fields || fields.length === 0) return errorResult("fields is required for create");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to create the work item in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const workItemApi = await connection.getWorkItemTrackingApi();

    const document = fields.map(({ name, value, format }) => ({
      op: "add",
      path: `/fields/${name}`,
      value: encodeFormattedValue(value, format),
    }));

    fields.forEach(({ name, format }) => {
      if (format === "Markdown") {
        document.push({
          op: "add",
          path: `/multilineFieldsFormat/${name}`,
          value: "Markdown",
        });
      }
    });

    const newWorkItem = await workItemApi.createWorkItem(null, document, resolvedProject, workItemType);

    if (!newWorkItem) return errorResult("Work item was not created");

    return { content: [{ type: "text", text: JSON.stringify(newWorkItem, null, 2) }] };
  },
});

const updateWorkItemCommand: Command<UpdateWorkItemArgs> = {
  async execute(context: CommandContext, args: UpdateWorkItemArgs): Promise<CallToolResult> {
    const { id, updates } = args;
    if (!id) return errorResult("id is required for update");
    if (!updates || updates.length === 0) return errorResult("updates is required for update");
    const updateWithoutValue = updates.find((update) => update.op !== "remove" && update.value === undefined);
    if (updateWithoutValue) return errorResult(`value is required for ${updateWithoutValue.op}`);

    try {
      const connection = await context.connectionProvider();
      const workItemApi = await connection.getWorkItemTrackingApi();
      const apiUpdates = updates.map((update) => ({ ...update, op: update.op }));
      const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id);
      return { content: [{ type: "text", text: JSON.stringify(updatedWorkItem, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;
      const statusText = statusCode === 409 ? " Conflict" : statusCode === 412 ? " Precondition Failed" : "";
      const updateStatus = statusCode !== undefined ? ` [HTTP ${statusCode}${statusText}]` : "";
      return errorResult(`Error updating work item${updateStatus}: ${message}`);
    }
  },
};

const updateWorkItemsBatchCommand: Command<UpdateWorkItemsBatchArgs> = {
  async execute(context: CommandContext, args: UpdateWorkItemsBatchArgs): Promise<CallToolResult> {
    const { batchUpdates } = args;
    if (!batchUpdates || batchUpdates.length === 0) return errorResult("batchUpdates is required for update_batch");

    const connection = await context.connectionProvider();
    const orgUrl = connection.serverUrl;
    const accessToken = await context.tokenProvider();
    const uniqueIds = Array.from(new Set(batchUpdates.map((update) => update.id)));

    const body = uniqueIds.map((uid) => {
      const workItemUpdates = batchUpdates.filter((update) => update.id === uid);
      const operations = workItemUpdates.map(({ op, path: fieldPath, value, format }) => ({
        op: op,
        path: fieldPath,
        value: encodeFormattedValue(value, format),
      }));

      workItemUpdates.forEach(({ path: fieldPath, format }) => {
        if (format === "Markdown") {
          operations.push({
            op: "Add",
            path: `/multilineFieldsFormat${fieldPath.replace("/fields", "")}`,
            value: "Markdown",
          });
        }
      });

      return {
        method: "PATCH",
        uri: `/_apis/wit/workitems/${uid}?api-version=${batchApiVersion}`,
        headers: { "Content-Type": "application/json-patch+json" },
        body: operations,
      };
    });

    const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": context.userAgentProvider(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to update work items in batch: ${response.statusText}`);
    }

    const result = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

const addChildWorkItemsCommand = (server: McpServer): Command<AddChildWorkItemsArgs> => ({
  async execute(context: CommandContext, args: AddChildWorkItemsArgs): Promise<CallToolResult> {
    const { parentId, workItemType, items } = args;
    if (!parentId) return errorResult("parentId is required for add_child");
    if (!workItemType) return errorResult("workItemType is required for add_child");
    if (!items || items.length === 0) return errorResult("items is required for add_child");
    if (items.length > 50) return errorResult("A maximum of 50 child work items can be created in a single call.");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to create child work items in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }
    const project = resolvedProject;

    const orgUrl = connection.serverUrl;
    const accessToken = await context.tokenProvider();

    const body = items.map((item, x) => {
      const encodedDescription = encodeFormattedValue(item.description, item.format);

      const ops: { op: string; path: string; value: unknown }[] = [
        { op: "add", path: "/id", value: `-${x + 1}` },
        { op: "add", path: "/fields/System.Title", value: item.title },
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: `${connection.serverUrl}/${project}/_apis/wit/workItems/${parentId}`,
          },
        },
      ];

      if (item.areaPath && item.areaPath.trim().length > 0) {
        ops.push({ op: "add", path: "/fields/System.AreaPath", value: item.areaPath });
      }

      if (item.iterationPath && item.iterationPath.trim().length > 0) {
        ops.push({ op: "add", path: "/fields/System.IterationPath", value: item.iterationPath });
      }

      // check if the work item type is "Bug" to determine which field to use for the description
      // ReproSteps is used for Bugs, while Description is used for other work item types
      if (workItemType.toLowerCase() === "bug") {
        ops.push({ op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: encodedDescription });

        if (item.format && item.format === "Markdown") {
          ops.push({ op: "add", path: "/multilineFieldsFormat/Microsoft.VSTS.TCM.ReproSteps", value: item.format });
        }
      } else {
        ops.push({ op: "add", path: "/fields/System.Description", value: encodedDescription });

        if (item.format && item.format === "Markdown") {
          ops.push({ op: "add", path: "/multilineFieldsFormat/System.Description", value: item.format });
        }
      }

      return {
        method: "PATCH",
        uri: `/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=${batchApiVersion}`,
        headers: { "Content-Type": "application/json-patch+json" },
        body: ops,
      };
    });

    const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": context.userAgentProvider(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to update work items in batch: ${response.statusText}`);
    }

    const result = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

const addWorkItemCommentCommand = (server: McpServer): Command<AddWorkItemCommentArgs> => ({
  async execute(context: CommandContext, args: AddWorkItemCommentArgs): Promise<CallToolResult> {
    const { workItemId, text } = args;
    if (!workItemId) return errorResult("workItemId is required");
    if (!text) return errorResult("text is required");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to add a work item comment in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const orgUrl = connection.serverUrl;
    const accessToken = await context.tokenProvider();
    const formatParameter = (args.format ?? "Markdown") === "Markdown" ? 0 : 1;
    const resolvedText = await prepareCommentText(text, args.format, context.tokenProvider, context.connectionProvider, context.userAgentProvider);

    const response = await fetch(`${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": context.userAgentProvider(),
      },
      body: JSON.stringify({ text: resolvedText }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add a work item comment: ${response.statusText}`);
    }

    return { content: [{ type: "text", text: await response.text() }] };
  },
});

const updateWorkItemCommentCommand = (server: McpServer): Command<UpdateWorkItemCommentArgs> => ({
  async execute(context: CommandContext, args: UpdateWorkItemCommentArgs): Promise<CallToolResult> {
    const { workItemId, text, commentId } = args;
    if (!workItemId) return errorResult("workItemId is required");
    if (!text) return errorResult("text is required");
    if (!commentId) return errorResult("commentId is required for update");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to update the work item comment in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const orgUrl = connection.serverUrl;
    const accessToken = await context.tokenProvider();
    const formatParameter = (args.format ?? "Markdown") === "Markdown" ? 0 : 1;
    const resolvedText = await prepareCommentText(text, args.format, context.tokenProvider, context.connectionProvider, context.userAgentProvider);

    const response = await fetch(
      `${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wit/workItems/${workItemId}/comments/${commentId}?format=${formatParameter}&api-version=${markdownCommentsApiVersion}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": context.userAgentProvider(),
        },
        body: JSON.stringify({ text: resolvedText }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update work item comment: ${response.statusText}`);
    }

    return { content: [{ type: "text", text: await response.text() }] };
  },
});

const linkWorkItemsCommand = (server: McpServer): Command<LinkWorkItemsArgs> => ({
  async execute(context: CommandContext, args: LinkWorkItemsArgs): Promise<CallToolResult> {
    const { updates } = args;
    if (!updates || updates.length === 0) return errorResult("updates is required for link");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to link work items in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const orgUrl = connection.serverUrl;
    const accessToken = await context.tokenProvider();
    const uniqueIds = Array.from(new Set(updates.map((update) => update.id)));

    const body = uniqueIds.map((uid) => ({
      method: "PATCH",
      uri: `/_apis/wit/workitems/${uid}?api-version=${batchApiVersion}`,
      headers: { "Content-Type": "application/json-patch+json" },
      body: updates
        .filter((update) => update.id === uid)
        .map(({ linkToId, url: linkUrl, type: linkTypeName, comment: linkComment }) => {
          if (linkTypeName === "hyperlink" && !linkUrl) {
            throw new Error("url is required for hyperlink links");
          }
          if (linkTypeName !== "hyperlink" && !linkToId) {
            throw new Error("linkToId is required for work item links");
          }

          return {
            op: "add",
            path: "/relations/-",
            value: {
              rel: getLinkTypeFromName(linkTypeName),
              url: linkTypeName === "hyperlink" ? linkUrl : `${orgUrl}/${resolvedProject}/_apis/wit/workItems/${linkToId}`,
              attributes: { comment: linkComment || "" },
            },
          };
        }),
    }));

    const response = await fetch(`${orgUrl}/_apis/wit/$batch?api-version=${batchApiVersion}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": context.userAgentProvider(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to update work items in batch: ${response.statusText}`);
    }

    const result = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

const unlinkWorkItemCommand = (server: McpServer): Command<UnlinkWorkItemArgs> => ({
  async execute(context: CommandContext, args: UnlinkWorkItemArgs): Promise<CallToolResult> {
    const { id, type, url } = args;
    if (!id) return errorResult("id is required for unlink");
    if (!type) return errorResult("type is required for unlink");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to unlink work items in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const workItemApi = await connection.getWorkItemTrackingApi();
    const workItem = await workItemApi.getWorkItem(id, undefined, undefined, WorkItemExpand.Relations, resolvedProject);
    const relations: WorkItemRelation[] = workItem.relations ?? [];
    const linkTypeName = getLinkTypeFromName(type);
    const matchesUrl = url && url.trim().length > 0;
    const relationIndexes = relations.map((relation, idx) => (relation.rel === linkTypeName && (!matchesUrl || relation.url === url) ? idx : -1)).filter((idx) => idx !== -1);

    if (relationIndexes.length === 0) {
      return errorResult(`No matching relations found for link type '${type}'${url ? ` and URL '${url}'` : ""}.\n${JSON.stringify(relations, null, 2)}`);
    }

    const removedRelations = relationIndexes.map((idx) => relations[idx]);
    relationIndexes.sort((a, b) => b - a);

    const apiUpdates = relationIndexes.map((idx) => ({ op: "remove", path: `/relations/${idx}` }));
    const updatedWorkItem = await workItemApi.updateWorkItem(null, apiUpdates, id, resolvedProject);

    return {
      content: [
        {
          type: "text",
          text:
            `Removed ${removedRelations.length} link(s) of type '${type}':\n` +
            JSON.stringify(removedRelations, null, 2) +
            `\n\nUpdated work item result:\n` +
            JSON.stringify(updatedWorkItem, null, 2),
        },
      ],
      isError: false,
    };
  },
});

const linkWorkItemToPullRequestCommand: Command<LinkWorkItemToPullRequestArgs> = {
  async execute(context: CommandContext, args: LinkWorkItemToPullRequestArgs): Promise<CallToolResult> {
    const { projectId, repositoryId, pullRequestId, workItemId, pullRequestProjectId } = args;
    if (!projectId) return errorResult("projectId is required for link_to_pull_request");
    if (!repositoryId) return errorResult("repositoryId is required for link_to_pull_request");
    if (pullRequestId === undefined) return errorResult("pullRequestId is required for link_to_pull_request");
    if (!workItemId) return errorResult("workItemId is required for link_to_pull_request");

    const connection = await context.connectionProvider();
    const workItemTrackingApi = await connection.getWorkItemTrackingApi();
    const artifactProjectId = pullRequestProjectId && pullRequestProjectId.trim() !== "" ? pullRequestProjectId : projectId;
    const artifactPathValue = `${artifactProjectId}/${repositoryId}/${pullRequestId}`;
    const vstfsUrl = `vstfs:///Git/PullRequestId/${encodeURIComponent(artifactPathValue)}`;

    const patchDocument = [
      {
        op: "add",
        path: "/relations/-",
        value: {
          rel: "ArtifactLink",
          url: vstfsUrl,
          attributes: { name: "Pull Request" },
        },
      },
    ];

    const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, projectId);

    if (!workItem) return errorResult("Work item update failed");

    return {
      content: [{ type: "text", text: JSON.stringify({ workItemId, pullRequestId, success: true }, null, 2) }],
    };
  },
};

const addArtifactLinkCommand = (server: McpServer): Command<AddArtifactLinkArgs> => ({
  async execute(context: CommandContext, args: AddArtifactLinkArgs): Promise<CallToolResult> {
    const { workItemId, projectId, repositoryId, pullRequestId, artifactUri, branchName, commitId, buildId, wikiId, pageId, pagePath, linkType, comment } = args;
    if (!workItemId) return errorResult("workItemId is required for add_artifact_link");

    const connection = await context.connectionProvider();
    let resolvedProject = args.project;
    if (!resolvedProject) {
      const result = await elicitProject(server, connection, "Select the Azure DevOps project to add the artifact link in.");
      if ("response" in result) return result.response;
      resolvedProject = result.resolved;
    }

    const workItemTrackingApi = await connection.getWorkItemTrackingApi();
    const effectiveLinkType = linkType ?? "Branch";
    let finalArtifactUri: string;

    if (artifactUri) {
      finalArtifactUri = artifactUri;
    } else {
      switch (effectiveLinkType) {
        case "Branch":
          if (!projectId || !repositoryId || !branchName) {
            return errorResult("For 'Branch' links, 'projectId', 'repositoryId', and 'branchName' are required.");
          }
          finalArtifactUri = `vstfs:///Git/Ref/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2FGB${encodeURIComponent(branchName)}`;
          break;

        case "Fixed in Commit":
          if (!projectId || !repositoryId || !commitId) {
            return errorResult("For 'Fixed in Commit' links, 'projectId', 'repositoryId', and 'commitId' are required.");
          }
          finalArtifactUri = `vstfs:///Git/Commit/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(commitId)}`;
          break;

        case "Pull Request":
          if (!projectId || !repositoryId || pullRequestId === undefined) {
            return errorResult("For 'Pull Request' links, 'projectId', 'repositoryId', and 'pullRequestId' are required.");
          }
          finalArtifactUri = `vstfs:///Git/PullRequestId/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2F${encodeURIComponent(pullRequestId.toString())}`;
          break;

        case "Build":
        case "Found in build":
        case "Integrated in build":
          if (buildId === undefined) {
            return errorResult(`For '${effectiveLinkType}' links, 'buildId' is required.`);
          }
          finalArtifactUri = `vstfs:///Build/Build/${encodeURIComponent(buildId.toString())}`;
          break;

        case "Wiki": {
          if (!projectId || !wikiId) {
            return errorResult("For 'Wiki' links, 'projectId', 'wikiId', and 'pagePath' are required.");
          }

          let resolvedPagePath = pagePath;

          if (pageId !== undefined) {
            const orgUrl = connection.serverUrl;
            const accessToken = await context.tokenProvider();
            const pageResponse = await fetch(`${orgUrl}/${encodeURIComponent(resolvedProject)}/_apis/wiki/wikis/${encodeURIComponent(wikiId)}/pages/${pageId}?api-version=7.1`, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": context.userAgentProvider(),
              },
            });
            if (!pageResponse.ok) {
              return errorResult(`Failed to look up wiki page ID ${pageId}: ${pageResponse.statusText}`);
            }
            const pageData = await pageResponse.json();
            resolvedPagePath = pageData.path as string;
          }

          if (!resolvedPagePath) {
            return errorResult("For 'Wiki' links, 'pageId' or 'pagePath' is required.");
          }

          const normalizedPath = resolvedPagePath.startsWith("/") ? resolvedPagePath.slice(1) : resolvedPagePath;
          const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("%2F");
          finalArtifactUri = `vstfs:///Wiki/WikiPage/${encodeURIComponent(projectId)}%2F${encodeURIComponent(wikiId)}%2F${encodedPath}`;
          break;
        }

        default:
          return errorResult(`URI building from components is not supported for link type '${effectiveLinkType}'. Please provide the full 'artifactUri' instead.`);
      }
    }

    const patchDocument = [
      {
        op: "add",
        path: "/relations/-",
        value: {
          rel: "ArtifactLink",
          url: finalArtifactUri,
          attributes: {
            name: getArtifactLinkAttributeName(effectiveLinkType),
            ...(comment && { comment }),
          },
        },
      },
    ];

    const workItem = await workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId, resolvedProject);

    if (!workItem) return errorResult("Work item update failed");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ workItemId, artifactUri: finalArtifactUri, linkType: effectiveLinkType, comment: comment || null, success: true }, null, 2),
        },
      ],
    };
  },
});

const witWorkItemWriteErrorPrefixes: Record<WitWorkItemWriteArgs["action"], string> = {
  create: "Error creating work item: ",
  update: "Error updating work item: ",
  update_batch: "Error updating work items in batch: ",
  add_child: "Error creating child work items: ",
};

const witWorkItemCommentWriteErrorPrefixes: Record<WitWorkItemCommentWriteArgs["action"], string> = {
  add: "Error adding work item comment: ",
  update: "Error updating work item comment: ",
};

const witWorkItemLinkWriteErrorPrefixes: Record<WitWorkItemLinkWriteArgs["action"], string> = {
  link: "Error linking work items: ",
  unlink: "Error unlinking work item: ",
  link_to_pull_request: "Error linking work item to pull request: ",
  add_artifact_link: "Error adding artifact link to work item: ",
};

function configureWorkItemTools(server: McpServer, tokenProvider: () => Promise<string>, connectionProvider: () => Promise<WebApi>, userAgentProvider: () => string) {
  // --- wit_work_item ----------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item,
    "Retrieve work item data. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_batch", "list_comments", "my", "list_revisions", "list_for_iteration", "get_type"])
        .describe(
          "The action to perform. Options: get (get a single work item by ID), get_batch (get multiple work items by IDs), list_comments (list comments on a work item), my (get work items relevant to the authenticated user), list_revisions (list revisions of a work item), list_for_iteration (list work items for a team iteration), get_type (get metadata for a work item type)."
        ),
      project: z
        .string()
        .optional()
        .describe(
          "The name or ID of the Azure DevOps project. Optional for get; when omitted, the work item is retrieved at organization scope. For other actions, a project selection prompt will be shown if omitted."
        ),
      id: z.coerce.number().min(1).optional().describe("Work item ID. Required for: get."),
      ids: z.array(z.coerce.number().min(1)).optional().describe("Work item IDs. Required for: get_batch."),
      workItemId: z.coerce.number().min(1).optional().describe("Work item ID. Required for: list_comments, list_revisions."),
      fields: z.array(z.string()).optional().describe("Field names to include in the response. Used for: get, get_batch. For get, cannot be combined with expand."),
      asOf: dateInputSchema.optional().describe("Retrieve the work item as of a specific date. Used for: get."),
      expand: z
        .enum(getEnumKeys(WorkItemExpand) as [string, ...string[]])
        .optional()
        .describe("Expand options (None, Fields, Relations, Links, All). Used for: get, list_revisions. For get, cannot be combined with fields."),
      top: z.coerce.number().optional().describe("Maximum number of results to return. Used for: list_comments, my, list_revisions. Defaults vary by action."),
      continuationToken: z.string().optional().describe("Token for continuing paged results. Used for: list_comments."),
      includeCompleted: z.boolean().optional().default(false).describe("Include completed work items. Used for: my. Defaults to false."),
      type: z.enum(["assignedtome", "myactivity"]).optional().describe("Type of work items to retrieve. Used for: my. Defaults to 'assignedtome'."),
      skip: z.coerce.number().optional().describe("Number of results to skip for pagination. Used for: list_revisions."),
      team: z.string().optional().describe("Team name or ID. Used for: list_for_iteration."),
      iterationId: z.string().optional().describe("Iteration ID. Required for: list_for_iteration."),
      workItemType: z.string().optional().describe("Work item type name. Required for: get_type."),
    },
    async ({ action, project, id, ids, workItemId, fields, asOf, expand, top, continuationToken, includeCompleted, type, skip, team, iterationId, workItemType }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;

        if (action === "get") {
          if (!id) return { content: [{ type: "text", text: "id is required for get" }], isError: true };
          let effectiveExpand = expand;
          if (fields && fields.length > 0 && effectiveExpand != null) {
            effectiveExpand = "none";
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItem = await workItemApi.getWorkItem(id, fields, asOf, effectiveExpand as unknown as WorkItemExpand, resolvedProject);
          return { content: [{ type: "text", text: JSON.stringify(workItem, null, 2) }] };
        }

        if (action === "get_batch") {
          if (!ids || ids.length === 0) return { content: [{ type: "text", text: "ids is required for get_batch" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const defaultFields = ["System.Id", "System.WorkItemType", "System.Title", "System.State", "System.Parent", "System.Tags", "Microsoft.VSTS.Common.StackRank", "System.AssignedTo"];
          const fieldsToUse = !fields || fields.length === 0 ? defaultFields : fields;
          const workitems = await workItemApi.getWorkItemsBatch({ ids, fields: fieldsToUse }, resolvedProject);

          const identityFields = [
            "System.AssignedTo",
            "System.CreatedBy",
            "System.ChangedBy",
            "System.AuthorizedAs",
            "Microsoft.VSTS.Common.ActivatedBy",
            "Microsoft.VSTS.Common.ResolvedBy",
            "Microsoft.VSTS.Common.ClosedBy",
          ];

          if (workitems && Array.isArray(workitems)) {
            workitems.forEach((item) => {
              if (item.fields) {
                identityFields.forEach((fieldName) => {
                  if (item.fields && item.fields[fieldName] && typeof item.fields[fieldName] === "object") {
                    const identityField = item.fields[fieldName];
                    const name = identityField.displayName || "";
                    const email = identityField.uniqueName || "";
                    item.fields[fieldName] = `${name} <${email}>`.trim();
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(workitems, null, 2) }] };
        }

        if (action === "list_comments") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_comments" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item comments for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const comments = await workItemApi.getComments(resolvedProject, workItemId, top ?? 50, continuationToken);
          return { content: [{ type: "text", text: JSON.stringify(comments, null, 2) }] };
        }

        if (action === "my") {
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getPredefinedQueryResults(resolvedProject, type ?? "assignedtome", top ?? 50, includeCompleted ?? false);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "list_revisions") {
          if (!workItemId) return { content: [{ type: "text", text: "workItemId is required for list_revisions" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to list work item revisions for.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const revisions = await workItemApi.getRevisions(workItemId, top ?? 50, skip, safeEnumConvert(WorkItemExpand, expand), resolvedProject);

          if (revisions && Array.isArray(revisions)) {
            revisions.forEach((revision) => {
              if (revision.fields) {
                const revFields = revision.fields;
                Object.keys(revFields).forEach((fieldName) => {
                  const fieldValue = revFields[fieldName];
                  if (
                    fieldValue &&
                    typeof fieldValue === "object" &&
                    !Array.isArray(fieldValue) &&
                    "displayName" in fieldValue &&
                    ("url" in fieldValue || "_links" in fieldValue || "uniqueName" in fieldValue)
                  ) {
                    delete fieldValue.url;
                    delete fieldValue._links;
                    delete fieldValue.id;
                    delete fieldValue.uniqueName;
                    delete fieldValue.imageUrl;
                    delete fieldValue.descriptor;
                  }
                });
              }
            });
          }
          return { content: [{ type: "text", text: JSON.stringify(revisions, null, 2) }] };
        }

        if (action === "list_for_iteration") {
          if (!iterationId) return { content: [{ type: "text", text: "iterationId is required for list_for_iteration" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve work items for iteration.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workApi = await connection.getWorkApi();
          const workItems = await workApi.getIterationWorkItems({ project: resolvedProject, team }, iterationId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "get_type") {
          if (!workItemType) return { content: [{ type: "text", text: "workItemType is required for get_type" }], isError: true };
          if (!resolvedProject) {
            const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item type from.");
            if ("response" in result) return result.response;
            resolvedProject = result.resolved;
          }
          const workItemApi = await connection.getWorkItemTrackingApi();
          const workItemTypeInfo = await workItemApi.getWorkItemType(resolvedProject, workItemType);
          return { content: [{ type: "text", text: JSON.stringify(workItemTypeInfo, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving work item: ${errorMessage}`,
          get_batch: `Error retrieving work items batch: ${errorMessage}`,
          list_comments: `Error listing work item comments: ${errorMessage}`,
          my: `Error retrieving work items: ${errorMessage}`,
          list_revisions: `Error listing work item revisions: ${errorMessage}`,
          list_for_iteration: `Error retrieving work items for iteration: ${errorMessage}`,
          get_type: `Error retrieving work item type: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_query --------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_query,
    "Retrieve work item query data for a project. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["get", "get_results", "wiql"])
        .describe("The action to perform. Options: get (get a query by ID or path), get_results (run a saved query and return results), wiql (execute an ad-hoc WIQL query)."),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      query: z.string().optional().describe("The ID or path of the query. Required for: get."),
      expand: z
        .enum(getEnumKeys(QueryExpand) as [string, ...string[]])
        .optional()
        .describe("Expand parameter to include additional details. Used for: get."),
      depth: z.coerce.number().default(0).describe("Depth of expansion. Used for: get. Defaults to 0."),
      includeDeleted: z.boolean().default(false).describe("Include deleted items. Used for: get. Defaults to false."),
      useIsoDateFormat: z.boolean().default(false).describe("Use ISO date format in the response. Used for: get. Defaults to false."),
      id: z.string().optional().describe("The ID of the saved query. Required for: get_results."),
      team: z.string().optional().describe("Team name or ID. Used for: get_results, wiql."),
      timePrecision: z.boolean().optional().describe("Include time precision in date fields. Used for: get_results, wiql."),
      top: z.coerce.number().default(50).describe("Maximum number of results to return. Used for: get_results, wiql. Defaults to 50."),
      responseType: z
        .enum(["full", "ids"])
        .default("full")
        .describe(
          "Response type: 'full' returns complete results (default). 'ids' returns only work item IDs and supports flat queries only; any other query type is not supported. Used for: get_results."
        ),
      wiql: z.string().max(32768).optional().describe('The WIQL query string to execute. Required for: wiql. Example: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project".'),
    },
    async ({ action, project, query, expand, depth, includeDeleted, useIsoDateFormat, id, team, timePrecision, top, responseType, wiql }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, `Select the Azure DevOps project for ${action}.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        if (action === "get") {
          if (!query) return { content: [{ type: "text", text: "query is required for get" }], isError: true };
          const workItemApi = await connection.getWorkItemTrackingApi();
          const queryDetails = await workItemApi.getQuery(resolvedProject, query, safeEnumConvert(QueryExpand, expand), depth, includeDeleted, useIsoDateFormat);
          return { content: [{ type: "text", text: JSON.stringify(queryDetails, null, 2) }] };
        }

        if (action === "get_results") {
          if (!id) return { content: [{ type: "text", text: "id is required for get_results" }], isError: true };
          const workItemApi = await getReadReplicaWorkItemTrackingApi(connection);
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryById(id, teamContext, timePrecision, top);
          if (responseType === "ids") {
            const ids = queryResult.workItems?.map((workItem) => workItem.id).filter((wid): wid is number => wid !== undefined) || [];
            return { content: [{ type: "text", text: JSON.stringify({ ids, count: ids.length }, null, 2) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
        }

        if (action === "wiql") {
          if (!wiql) return { content: [{ type: "text", text: "wiql is required for wiql" }], isError: true };
          const workItemApi = await getReadReplicaWorkItemTrackingApi(connection);
          const teamContext = { project: resolvedProject, team };
          const queryResult = await workItemApi.queryByWiql({ query: wiql }, teamContext, timePrecision, top);
          return createExternalContentResponse(queryResult, "wiql query results");
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          get: `Error retrieving query: ${errorMessage}`,
          get_results: `Error retrieving query results: ${errorMessage}`,
          wiql: `Error executing WIQL query: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_backlog ------------------------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_backlog,
    "Retrieve backlog data for a project and team. Use the action parameter to specify the operation.",
    {
      action: z
        .enum(["list", "list_work_items", "reorder"])
        .describe(
          "The action to perform. Options: list (list backlog levels for a team), list_work_items (list work items in a specific backlog level), reorder (move work items to a new position in a backlog or iteration)."
        ),
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      team: z.string().optional().describe("The name or ID of the Azure DevOps team. Reuse from prior context if already known. If not provided, a team selection prompt will be shown."),
      backlogId: z.string().optional().describe("The ID of the backlog category to retrieve work items from. Required for: list_work_items."),
      ids: z.array(z.coerce.number().int().min(1)).min(1).optional().describe("The IDs of the work items to reorder. Required for: reorder."),
      previousId: z.coerce
        .number()
        .int()
        .min(0)
        .optional()
        .describe("The ID of the work item that should be before the reordered items. Use 0 to specify the beginning of the list. Optional for: reorder."),
      nextId: z.coerce.number().int().min(0).optional().describe("The ID of the work item that should be after the reordered items. Use 0 to specify the end of the list. Optional for: reorder."),
      parentId: z.coerce.number().int().min(0).optional().describe("The parent ID for all work items involved in the operation. Use 0 to indicate the items have no parent. Optional for: reorder."),
      iterationPath: z.string().optional().describe("The iteration path for the reorder operation. Used when reordering items in an iteration backlog. Optional for: reorder."),
      iterationId: z.string().optional().describe("The iteration ID. When provided, reorder items in that iteration instead of the team backlog. Used for: reorder."),
    },
    async ({ action, project, team, backlogId, ids, previousId, nextId, parentId, iterationPath, iterationId }) => {
      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitProject(server, connection, `Select the Azure DevOps project to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        let resolvedTeam = team;
        if (!resolvedTeam) {
          const label = action === "list" ? "list backlogs" : "list backlog work items";
          const result = await elicitTeam(server, connection, resolvedProject, `Select the Azure DevOps team to ${label} for.`);
          if ("response" in result) return result.response;
          resolvedTeam = result.resolved;
        }

        const workApi = await connection.getWorkApi();
        const teamContext = { project: resolvedProject, team: resolvedTeam };

        if (action === "list") {
          const backlogs = await workApi.getBacklogs(teamContext);
          return { content: [{ type: "text", text: JSON.stringify(backlogs, null, 2) }] };
        }

        if (action === "list_work_items") {
          if (!backlogId) return { content: [{ type: "text", text: "backlogId is required for list_work_items" }], isError: true };
          const workItems = await workApi.getBacklogLevelWorkItems(teamContext, backlogId);
          return { content: [{ type: "text", text: JSON.stringify(workItems, null, 2) }] };
        }

        if (action === "reorder") {
          if (!ids?.length) return { content: [{ type: "text", text: "ids is required for reorder" }], isError: true };

          const operation = { ids, previousId, nextId, parentId, iterationPath };
          const reorderedItems = iterationId ? await workApi.reorderIterationWorkItems(operation, teamContext, iterationId) : await workApi.reorderBacklogWorkItems(operation, teamContext);

          return { content: [{ type: "text", text: JSON.stringify(reorderedItems, null, 2) }] };
        }

        return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        const msgs: Record<string, string> = {
          list: `Error listing backlogs: ${errorMessage}`,
          list_work_items: `Error listing backlog work items: ${errorMessage}`,
          reorder: `Error reordering backlog work items: ${errorMessage}`,
        };
        return { content: [{ type: "text", text: msgs[action] ?? `Error: ${errorMessage}` }], isError: true };
      }
    }
  );

  // --- wit_work_item_attachment -----------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_attachment,
    "Download a work item attachment by its ID. By default returns the content as a base64-encoded resource. If savePath is provided, saves the file locally to that directory and returns the file path instead. Useful for viewing images (e.g. screenshots) or other files attached to work items such as bugs. If a project is not specified, you will be prompted to select one.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      attachmentId: z.string().describe("The GUID of the attachment. Found in the attachment URL: https://dev.azure.com/{org}/{project}/_apis/wit/attachments/{attachmentId}."),
      fileName: z.string().optional().describe("The file name of the attachment, e.g. 'screenshot.png'. Used to determine the MIME type or the saved file's name."),
      savePath: z
        .string()
        .optional()
        .describe(
          "Optional local directory path where the downloaded file should be saved. Must be a relative path (e.g. 'temp' or 'downloads/attachments') to an existing directory that resolves (including symlinks) inside the server's working directory; absolute paths are not allowed. If provided, saves the attachment to this directory and returns the file path. If omitted, returns the content as a base64-encoded resource."
        ),
    },
    async ({ project, attachmentId, fileName, savePath }) => {
      const isAbsolutePath = (value: string) => path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
      const hasDriveLetter = (value: string) => /^[a-zA-Z]:/.test(value);

      if (savePath !== undefined && (savePath.includes("..") || isAbsolutePath(savePath) || hasDriveLetter(savePath))) {
        throw new Error("Invalid savePath: absolute paths and path traversals are not allowed.");
      }

      if (fileName !== undefined && fileName.includes("..")) {
        throw new Error("Invalid fileName: path traversal is not allowed.");
      }

      if (!attachmentId) return { content: [{ type: "text", text: "attachmentId is required for download" }], isError: true };

      if (savePath) {
        const localFileName = fileName ?? attachmentId;
        if (!localFileName || localFileName.includes("\0") || path.posix.basename(localFileName) !== localFileName || path.win32.basename(localFileName) !== localFileName) {
          throw new Error("Invalid fileName: path components are not allowed.");
        }
      }

      try {
        const connection = await connectionProvider();

        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to retrieve the work item attachment from.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const stream = await workItemApi.getAttachmentContent(attachmentId, fileName, resolvedProject);
        const responseStream = stream as NodeJS.ReadableStream & { statusCode?: number; statusMessage?: string };

        if (responseStream.statusCode !== undefined && (responseStream.statusCode < 200 || responseStream.statusCode >= 300)) {
          responseStream.resume();
          const statusMessage = responseStream.statusMessage ? ` ${responseStream.statusMessage}` : "";
          throw new Error(`Attachment download failed: HTTP ${responseStream.statusCode}${statusMessage}`);
        }

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          stream.on("end", resolve);
          stream.on("error", reject);
        });

        const buffer = Buffer.concat(chunks);

        if (savePath) {
          const workspaceRoot = await realpath(process.cwd());
          const resolvedDirectory = await realpath(path.resolve(workspaceRoot, savePath));
          const relativeDirectory = path.relative(workspaceRoot, resolvedDirectory);

          if (relativeDirectory === ".." || relativeDirectory.startsWith(`..${path.sep}`) || path.isAbsolute(relativeDirectory)) {
            throw new Error("Invalid savePath: destination must remain inside the workspace.");
          }

          const localFilePath = path.resolve(resolvedDirectory, fileName ?? attachmentId);
          // O_EXCL fails if the file (or a symlink) already exists, so there is no check-then-write race.
          const file = await open(localFilePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
          try {
            await file.writeFile(buffer);
          } finally {
            await file.close();
          }

          return {
            content: [{ type: "text", text: `Attachment saved to: ${localFilePath}` }],
          };
        }

        const mimeType = getMimeType(fileName);

        if (mimeType.startsWith("text/")) {
          return createExternalContentResponse(buffer.toString("utf-8"), "work item attachment");
        }

        const base64Data = buffer.toString("base64");
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `data:${mimeType};base64,${base64Data}`,
                mimeType,
                blob: base64Data,
              },
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error retrieving work item attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- wit_work_item_attachment_upload ----------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_attachment_upload,
    "Upload base64-encoded content as a new work item attachment. This tool only uploads the attachment; use wit_work_item_attachment_link separately to link the returned attachment URL to a work item.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      fileName: z.string().describe("The name of the file to upload, e.g. 'screenshot.png'."),
      content: z.string().describe("Base64-encoded file content to upload."),
    },
    async ({ project, fileName, content }) => {
      try {
        if (fileName.includes("..")) return { content: [{ type: "text", text: "Invalid fileName: path traversal is not allowed." }], isError: true };
        if (!content) return { content: [{ type: "text", text: "content is required for upload" }], isError: true };
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content)) return { content: [{ type: "text", text: "content must be valid base64-encoded data" }], isError: true };

        const connection = await connectionProvider();
        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project to upload the work item attachment to.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const workItemApi = await connection.getWorkItemTrackingApi();
        const attachmentReference = await workItemApi.createAttachment({}, Readable.from(Buffer.from(content, "base64")), fileName, undefined, resolvedProject);

        return { content: [{ type: "text", text: JSON.stringify(attachmentReference, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error uploading work item attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- wit_work_item_attachment_link ------------------------------------------
  server.tool(
    WORKITEM_TOOLS.wit_work_item_attachment_link,
    "Link an uploaded attachment to a work item using the attachment URL returned by wit_work_item_attachment_upload.",
    {
      project: z.string().optional().describe("The name or ID of the Azure DevOps project. Reuse from prior context if already known. If not provided, a project selection prompt will be shown."),
      workItemId: z.coerce.number().min(1).describe("The ID of the work item to link the uploaded attachment to."),
      attachmentUrl: z.string().url().describe("The attachment URL returned by wit_work_item_attachment_upload."),
      comment: z.string().optional().describe("Optional comment to include with the attachment link."),
    },
    async ({ project, workItemId, attachmentUrl, comment }) => {
      try {
        const connection = await connectionProvider();
        let resolvedProject = project;
        if (!resolvedProject) {
          const result = await elicitProject(server, connection, "Select the Azure DevOps project containing the work item to link the attachment to.");
          if ("response" in result) return result.response;
          resolvedProject = result.resolved;
        }

        const patchDocument = [
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "AttachedFile",
              url: attachmentUrl,
              attributes: { comment: comment || "" },
            },
          },
        ];
        const workItemApi = await connection.getWorkItemTrackingApi();
        const workItem = await workItemApi.updateWorkItem({}, patchDocument, workItemId, resolvedProject);
        if (!workItem) throw new Error("Work item not found");

        return { content: [{ type: "text", text: JSON.stringify({ attachmentUrl, workItemId }, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Error linking work item attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  const context: CommandContext = { connectionProvider, tokenProvider, userAgentProvider };

  const witWorkItemWriteCommands: CommandRegistry<WitWorkItemWriteArgs> = {
    create: createWorkItemCommand(server),
    update: updateWorkItemCommand,
    update_batch: updateWorkItemsBatchCommand,
    add_child: addChildWorkItemsCommand(server),
  };

  const witWorkItemCommentWriteCommands: CommandRegistry<WitWorkItemCommentWriteArgs> = {
    add: addWorkItemCommentCommand(server),
    update: updateWorkItemCommentCommand(server),
  };

  const witWorkItemLinkWriteCommands: CommandRegistry<WitWorkItemLinkWriteArgs> = {
    link: linkWorkItemsCommand(server),
    unlink: unlinkWorkItemCommand(server),
    link_to_pull_request: linkWorkItemToPullRequestCommand,
    add_artifact_link: addArtifactLinkCommand(server),
  };

  // --- wit_work_item_write ----------------------------------------------------
  server.tool(WORKITEM_TOOLS.wit_work_item_write, "Write operations for work items. Use the action parameter to specify the operation.", witWorkItemWriteShape, async (args) =>
    dispatchAction(witWorkItemWriteCommands, context, args as WitWorkItemWriteArgs, witWorkItemWriteErrorPrefixes)
  );

  // --- wit_work_item_comment_write --------------------------------------------
  server.tool(WORKITEM_TOOLS.wit_work_item_comment_write, "Write operations for work item comments. Use the action parameter to specify the operation.", witWorkItemCommentWriteShape, async (args) =>
    dispatchAction(witWorkItemCommentWriteCommands, context, args as WitWorkItemCommentWriteArgs, witWorkItemCommentWriteErrorPrefixes)
  );

  // --- wit_work_item_link_write -----------------------------------------------
  server.tool(WORKITEM_TOOLS.wit_work_item_link_write, "Write operations for work item links. Use the action parameter to specify the operation.", witWorkItemLinkWriteShape, async (args) =>
    dispatchAction(witWorkItemLinkWriteCommands, context, args as WitWorkItemLinkWriteArgs, witWorkItemLinkWriteErrorPrefixes)
  );
}

function getMimeType(fileName: string | undefined): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    html: "text/html",
    htm: "text/html",
    xml: "text/xml",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    zip: "application/zip",
  };
  return (ext && mimeTypes[ext]) ?? "application/octet-stream";
}

export {
  WORKITEM_TOOLS,
  configureWorkItemTools,
  createWorkItemCommand,
  updateWorkItemCommand,
  updateWorkItemsBatchCommand,
  addChildWorkItemsCommand,
  addWorkItemCommentCommand,
  updateWorkItemCommentCommand,
  linkWorkItemsCommand,
  unlinkWorkItemCommand,
  linkWorkItemToPullRequestCommand,
  addArtifactLinkCommand,
};
export type {
  CreateWorkItemArgs,
  UpdateWorkItemArgs,
  UpdateWorkItemsBatchArgs,
  AddChildWorkItemsArgs,
  AddWorkItemCommentArgs,
  UpdateWorkItemCommentArgs,
  LinkWorkItemsArgs,
  UnlinkWorkItemArgs,
  LinkWorkItemToPullRequestArgs,
  AddArtifactLinkArgs,
};
