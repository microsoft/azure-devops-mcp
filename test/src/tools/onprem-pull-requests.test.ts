// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AzureDevOpsServerClient } from "../../../src/onprem/client";
import { resolveOnPremConfig } from "../../../src/onprem/config";
import { Transport, TransportRequest } from "../../../src/onprem/transport";
import { configureOnPremPullRequestTools, ONPREM_TOOLS } from "../../../src/tools/onprem-pull-requests";
import { configureOnPremTools } from "../../../src/tools";

jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

const COLLECTION = "https://ado.contoso.com/DefaultCollection";
const REPO_ID = "11111111-2222-3333-4444-555555555555";
const REPO_PATH = `/DefaultCollection/Fabrikam/_apis/git/repositories/${REPO_ID}`;

type Handler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
type Routes = Record<string, unknown | ((url: URL) => unknown)>;

const pullRequest = {
  pullRequestId: 42,
  title: "Add widget",
  description: "Implements the widget",
  status: "active",
  isDraft: false,
  createdBy: { displayName: "Ada", uniqueName: "CONTOSO\\ada", id: "u1" },
  creationDate: "2024-01-01T00:00:00Z",
  sourceRefName: "refs/heads/feature/widget",
  targetRefName: "refs/heads/main",
  mergeStatus: "succeeded",
  repository: { id: REPO_ID, name: "Widgets", project: { id: "p1", name: "Fabrikam" } },
  reviewers: [{ displayName: "Bob", uniqueName: "CONTOSO\\bob", vote: -5, isRequired: true }],
  lastMergeSourceCommit: { commitId: "src2" },
  lastMergeTargetCommit: { commitId: "tgt2" },
};

const iterations = {
  value: [
    { id: 1, sourceRefCommit: { commitId: "src1" }, targetRefCommit: { commitId: "tgt1" }, commonRefCommit: { commitId: "base1" } },
    { id: 2, sourceRefCommit: { commitId: "src2" }, targetRefCommit: { commitId: "tgt2" }, commonRefCommit: { commitId: "base2" } },
  ],
};

function itemsRoute(files: Record<string, string | { binary: true }>) {
  return (url: URL) => {
    const key = `${url.searchParams.get("versionDescriptor.version")}:${url.searchParams.get("path")}`;
    const file = files[key];
    if (file === undefined) return { __status: 404, message: "TF401174: The item could not be found." };
    if (typeof file === "string") return { path: url.searchParams.get("path"), content: file, contentMetadata: { isBinary: false } };
    return { path: url.searchParams.get("path"), content: "\u0000PNG", contentMetadata: { isBinary: true } };
  };
}

function setup(routes: Routes) {
  const requests: URL[] = [];
  const transport = jest.fn<Transport>(async (request: TransportRequest) => {
    const url = new URL(request.url);
    requests.push(url);
    const route = routes[url.pathname];
    if (route === undefined) {
      return { status: 404, contentType: "application/json", body: Buffer.from(JSON.stringify({ message: `no route ${url.pathname}` })) };
    }
    const value = typeof route === "function" ? (route as (u: URL) => unknown)(url) : route;
    const status = (value as { __status?: number }).__status ?? 200;
    return { status, contentType: "application/json; charset=utf-8", body: Buffer.from(JSON.stringify(value)) };
  });
  const client = new AzureDevOpsServerClient(resolveOnPremConfig({ serverUrl: "https://ado.contoso.com", collection: "DefaultCollection" }), transport, () => "UA");
  const tool = jest.fn();
  const server = { tool } as unknown as McpServer;
  configureOnPremPullRequestTools(server, client, COLLECTION);
  const handler = (name: string): Handler => {
    const call = tool.mock.calls.find(([toolName]) => toolName === name);
    if (!call) throw new Error(`Tool ${name} not registered`);
    return call[call.length - 1] as Handler;
  };
  return { handler, requests };
}

const parse = (result: { content: { text: string }[] }) => JSON.parse(result.content[0].text);

describe("on-premises pull request tools", () => {
  const baseRoutes: Routes = {
    "/DefaultCollection/_apis/git/pullRequests/42": pullRequest,
    [`${REPO_PATH}/pullRequests/42/iterations`]: iterations,
  };

  beforeEach(() => jest.clearAllMocks());

  it("registers only the read-only on-premises tools", () => {
    const tool = jest.fn();
    const server = { tool, registerTool: jest.fn() } as unknown as McpServer;
    configureOnPremTools(server, {} as AzureDevOpsServerClient, COLLECTION);
    const names = tool.mock.calls.map(([name]) => name).sort();
    expect(names).toEqual(Object.values(ONPREM_TOOLS).sort());
    for (const call of tool.mock.calls) {
      expect(call[call.length - 2]).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });

  it("lists projects with a name filter using api-version 5.0", async () => {
    const { handler, requests } = setup({
      "/DefaultCollection/_apis/projects": {
        value: [
          { id: "p1", name: "Fabrikam" },
          { id: "p2", name: "Other" },
        ],
      },
    });
    const result = await handler(ONPREM_TOOLS.onprem_project_list)({ top: 100, skip: 0, projectNameFilter: "fab" });
    expect(parse(result)).toEqual([{ id: "p1", name: "Fabrikam" }]);
    expect(requests[0].searchParams.get("api-version")).toBe("5.0");
    expect(requests[0].searchParams.get("stateFilter")).toBe("wellFormed");
  });

  it("lists and gets repositories", async () => {
    const repo = { id: REPO_ID, name: "Widgets", defaultBranch: "refs/heads/main", project: { name: "Fabrikam" } };
    const { handler } = setup({
      "/DefaultCollection/Fabrikam/_apis/git/repositories": { value: [repo, { id: "r2", name: "Alpha" }] },
      "/DefaultCollection/Fabrikam/_apis/git/repositories/Widgets": repo,
    });
    const listed = parse(await handler(ONPREM_TOOLS.onprem_repository)({ action: "list", project: "Fabrikam" }));
    expect(listed.map((r: { name: string }) => r.name)).toEqual(["Alpha", "Widgets"]);
    const got = parse(await handler(ONPREM_TOOLS.onprem_repository)({ action: "get", project: "Fabrikam", repository: "Widgets" }));
    expect(got).toMatchObject({ id: REPO_ID, name: "Widgets", defaultBranch: "refs/heads/main", project: "Fabrikam" });
    const missing = await handler(ONPREM_TOOLS.onprem_repository)({ action: "get", project: "Fabrikam" });
    expect(missing.isError).toBe(true);
  });

  it("lists pull requests with search criteria", async () => {
    const { handler, requests } = setup({ "/DefaultCollection/Fabrikam/_apis/git/repositories/Widgets/pullRequests": { value: [pullRequest] } });
    const result = parse(
      await handler(ONPREM_TOOLS.onprem_pull_request)({ action: "list", project: "Fabrikam", repository: "Widgets", status: "active", targetRefName: "refs/heads/main", top: 10, skip: 0 })
    );
    expect(result[0]).toMatchObject({ pullRequestId: 42, title: "Add widget", webUrl: `${COLLECTION}/Fabrikam/_git/Widgets/pullrequest/42` });
    expect(result[0].description).toBeUndefined();
    const query = requests[0].searchParams;
    expect(query.get("searchCriteria.status")).toBe("active");
    expect(query.get("searchCriteria.targetRefName")).toBe("refs/heads/main");
    expect(query.get("$top")).toBe("10");
    expect(query.has("searchCriteria.creatorId")).toBe(false);
  });

  it("gets pull request details by ID alone, resolving project and repository", async () => {
    const { handler, requests } = setup(baseRoutes);
    const result = parse(await handler(ONPREM_TOOLS.onprem_pull_request)({ action: "get", pullRequestId: 42, status: "active", top: 50, skip: 0 }));
    expect(requests[0].pathname).toBe("/DefaultCollection/_apis/git/pullRequests/42");
    expect(result).toMatchObject({
      pullRequestId: 42,
      description: "Implements the widget",
      mergeStatus: "succeeded",
      lastMergeSourceCommit: "src2",
      project: "Fabrikam",
      repository: { id: REPO_ID, name: "Widgets" },
      reviewers: [{ displayName: "Bob", vote: -5, voteLabel: "Waiting for author", isRequired: true }],
    });
  });

  it("uses the repository-scoped route when repository is provided", async () => {
    const { handler, requests } = setup({ "/DefaultCollection/Fabrikam/_apis/git/repositories/Widgets/pullRequests/42": pullRequest });
    await handler(ONPREM_TOOLS.onprem_pull_request)({ action: "get", pullRequestId: 42, project: "Fabrikam", repository: "Widgets", status: "active", top: 50, skip: 0 });
    expect(requests[0].pathname).toBe("/DefaultCollection/Fabrikam/_apis/git/repositories/Widgets/pullRequests/42");
  });

  it("returns commits, iterations and linked work items", async () => {
    const { handler, requests } = setup({
      ...baseRoutes,
      [`${REPO_PATH}/pullRequests/42/commits`]: { value: [{ commitId: "c1", author: { name: "Ada", date: "d" }, comment: "msg" }] },
      [`${REPO_PATH}/pullRequests/42/workitems`]: { value: [{ id: "7" }, { id: "8" }] },
      "/DefaultCollection/_apis/wit/workitems": {
        value: [
          {
            id: 7,
            fields: {
              "System.WorkItemType": "User Story",
              "System.Title": "Widget",
              "System.State": "Active",
              "System.AssignedTo": { displayName: "Ada" },
              "Microsoft.VSTS.Common.AcceptanceCriteria": "AC",
            },
          },
          null,
        ],
      },
    });
    const call = (action: string) => handler(ONPREM_TOOLS.onprem_pull_request)({ action, pullRequestId: 42, status: "active", top: 50, skip: 0 });

    expect(parse(await call("commits"))).toEqual([{ commitId: "c1", author: "Ada", authorDate: "d", comment: "msg" }]);
    expect(parse(await call("iterations"))[1]).toMatchObject({ id: 2, sourceRefCommit: "src2", commonRefCommit: "base2" });
    expect(parse(await call("work_items"))).toEqual([{ id: 7, type: "User Story", title: "Widget", state: "Active", assignedTo: "Ada", acceptanceCriteria: "AC" }]);
    const witRequest = requests.find((url) => url.pathname.endsWith("/_apis/wit/workitems")) as URL;
    expect(witRequest.searchParams.get("ids")).toBe("7,8");
    expect(witRequest.searchParams.get("errorPolicy")).toBe("omit");
  });

  it("requires pullRequestId for non-list actions and reports server errors", async () => {
    const { handler } = setup({});
    expect((await handler(ONPREM_TOOLS.onprem_pull_request)({ action: "get", status: "active", top: 50, skip: 0 })).isError).toBe(true);
    const failed = await handler(ONPREM_TOOLS.onprem_pull_request)({ action: "get", pullRequestId: 99, status: "active", top: 50, skip: 0 });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toContain("Error reading pull request: HTTP 404");
  });

  it("lists changed files for the latest iteration against the merge base", async () => {
    const { handler, requests } = setup({
      ...baseRoutes,
      [`${REPO_PATH}/pullRequests/42/iterations/2/changes`]: {
        changeEntries: [
          { changeType: "edit", item: { path: "/src/a.ts", objectId: "o1", originalObjectId: "o0" } },
          { changeType: "rename", originalPath: "/src/old.ts", item: { path: "/src/new.ts" } },
          { changeType: "add", item: { path: "/src", isFolder: true } },
        ],
        nextSkip: 0,
      },
    });
    const result = parse(await handler(ONPREM_TOOLS.onprem_pull_request_change)({ action: "list", pullRequestId: 42, side: "source", contextLines: 3, maxLines: 2000, top: 200, skip: 0 }));
    expect(result).toEqual({
      iterationId: 2,
      compareTo: 0,
      baseCommit: "base2",
      sourceCommit: "src2",
      changes: [
        { path: "/src/a.ts", changeType: "edit", objectId: "o1", originalObjectId: "o0" },
        { path: "/src/new.ts", originalPath: "/src/old.ts", changeType: "rename" },
      ],
    });
    expect(requests[requests.length - 1].searchParams.get("$compareTo")).toBe("0");
  });

  it("produces a unified diff between the merge base and the source commit", async () => {
    const { handler, requests } = setup({
      ...baseRoutes,
      [`${REPO_PATH}/items`]: itemsRoute({ "base2:/src/a.ts": "one\ntwo\nthree\n", "src2:/src/a.ts": "one\n2\nthree\n" }),
    });
    const result = parse(
      await handler(ONPREM_TOOLS.onprem_pull_request_change)({ action: "diff", pullRequestId: 42, path: "/src/a.ts", side: "source", contextLines: 3, maxLines: 2000, top: 200, skip: 0 })
    );
    expect(result).toMatchObject({ path: "/src/a.ts", changeType: "edit", baseCommit: "base2", sourceCommit: "src2", addedLines: 1, removedLines: 1 });
    expect(result.diff).toBe(["--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1,3 +1,3 @@", " one", "-two", "+2", " three"].join("\n"));
    const itemRequest = requests.find((url) => url.pathname.endsWith("/items")) as URL;
    expect(itemRequest.searchParams.get("versionDescriptor.versionType")).toBe("commit");
    expect(itemRequest.searchParams.get("includeContent")).toBe("true");
  });

  it("supports incremental diffs, added files, renames, binaries and truncation", async () => {
    const { handler } = setup({
      ...baseRoutes,
      [`${REPO_PATH}/items`]: itemsRoute({
        "src1:/a.ts": "x\n",
        "src2:/a.ts": "y\n",
        "src2:/new.ts": "l1\nl2\nl3\n",
        "base2:/old.ts": "same\n",
        "src2:/renamed.ts": "same\n",
        "base2:/img.png": { binary: true },
        "src2:/img.png": { binary: true },
      }),
    });
    const diff = (args: Record<string, unknown>) =>
      handler(ONPREM_TOOLS.onprem_pull_request_change)({ action: "diff", pullRequestId: 42, side: "source", contextLines: 3, maxLines: 2000, top: 200, skip: 0, ...args });

    expect(parse(await diff({ path: "/a.ts", compareTo: 1 }))).toMatchObject({ compareTo: 1, baseCommit: "src1", diff: expect.stringContaining("-x\n+y") });
    expect(parse(await diff({ path: "/new.ts" }))).toMatchObject({ changeType: "add", addedLines: 3, diff: expect.stringContaining("--- /dev/null") });
    expect(parse(await diff({ path: "/renamed.ts", originalPath: "/old.ts" }))).toMatchObject({ changeType: "rename", diff: "(no textual changes)" });
    expect(parse(await diff({ path: "/img.png" }))).toMatchObject({ binary: true });
    expect(parse(await diff({ path: "/new.ts", maxLines: 3 }))).toMatchObject({ truncated: true, totalDiffLines: 6 });
    expect((await diff({ path: "/missing.ts" })).isError).toBe(true);
    expect((await diff({ path: "/a.ts", compareTo: 9 })).content[0].text).toContain("compareTo iteration 9 was not found");
    expect((await diff({})).isError).toBe(true);
  });

  it("returns file content for source, base, target or an explicit commit", async () => {
    const { handler } = setup({
      ...baseRoutes,
      [`${REPO_PATH}/items`]: itemsRoute({ "src2:/a.ts": "head\n", "base2:/a.ts": "base\n", "tgt2:/a.ts": "target\n", "abc:/a.ts": "explicit\n" }),
    });
    const content = (args: Record<string, unknown>) =>
      handler(ONPREM_TOOLS.onprem_pull_request_change)({ action: "content", pullRequestId: 42, path: "/a.ts", side: "source", contextLines: 3, maxLines: 2000, top: 200, skip: 0, ...args });
    expect(parse(await content({}))).toMatchObject({ commitId: "src2", content: "head\n" });
    expect(parse(await content({ side: "base" }))).toMatchObject({ commitId: "base2", content: "base\n" });
    expect(parse(await content({ side: "target" }))).toMatchObject({ commitId: "tgt2", content: "target\n" });
    expect(parse(await content({ commitId: "abc" }))).toMatchObject({ commitId: "abc", content: "explicit\n" });
    expect(parse(await content({ path: "/gone.ts" }))).toEqual({ path: "/gone.ts", commitId: "src2", exists: false });
  });

  it("lists human discussion threads with file context, excluding system and deleted content by default", async () => {
    const threads = {
      value: [
        {
          id: 1,
          status: "active",
          threadContext: { filePath: "/src/a.ts", rightFileStart: { line: 3, offset: 1 }, rightFileEnd: { line: 3, offset: 5 } },
          pullRequestThreadContext: { iterationContext: { firstComparingIteration: 1, secondComparingIteration: 2 } },
          comments: [
            { id: 1, author: { displayName: "Bob" }, content: "Why?", commentType: "text" },
            { id: 2, parentCommentId: 1, author: { displayName: "Ada" }, content: "deleted", commentType: "text", isDeleted: true },
          ],
        },
        { id: 2, status: "unknown", comments: [{ id: 1, author: { displayName: "System" }, content: "Bob voted -5", commentType: "system" }] },
        { id: 3, status: "fixed", isDeleted: true, comments: [{ id: 1, content: "x", commentType: "text" }] },
        { id: 4, status: "fixed", comments: [{ id: 1, author: { displayName: "Bob" }, content: "Done", commentType: "text" }] },
      ],
    };
    const { handler } = setup({ ...baseRoutes, [`${REPO_PATH}/pullRequests/42/threads`]: threads });
    const call = (args: Record<string, unknown>) => handler(ONPREM_TOOLS.onprem_pull_request_thread)({ pullRequestId: 42, includeSystem: false, top: 100, skip: 0, ...args });

    const result = parse(await call({}));
    expect(result.map((thread: { id: number }) => thread.id)).toEqual([1, 4]);
    expect(result[0]).toMatchObject({ filePath: "/src/a.ts", rightFileStart: { line: 3 }, iterationContext: { secondComparingIteration: 2 } });
    expect(result[0].comments).toEqual([{ id: 1, author: "Bob", content: "Why?", commentType: "text" }]);

    expect(parse(await call({ includeSystem: true })).map((thread: { id: number }) => thread.id)).toEqual([1, 2, 4]);
    expect(parse(await call({ status: "fixed" })).map((thread: { id: number }) => thread.id)).toEqual([4]);
    expect(parse(await call({ top: 1, skip: 1 })).map((thread: { id: number }) => thread.id)).toEqual([4]);
  });
});
