// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";

jest.mock("../../src/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { configureResources, RESOURCE_URIS, WIQL_REFERENCE } from "../../src/resources";
import { Domain } from "../../src/shared/domains";

type ReadCallback = (uri: URL, variables: Record<string, unknown>) => Promise<{ contents: { uri: string; mimeType?: string; text: string }[] }>;

describe("configureResources", () => {
  let server: McpServer;
  let coreApi: { getProjects: jest.Mock; getTeams: jest.Mock };
  let witApi: { getWorkItemTypes: jest.Mock; getFields: jest.Mock };
  let connectionProvider: () => Promise<WebApi>;

  beforeEach(() => {
    server = { registerResource: jest.fn() } as unknown as McpServer;
    coreApi = { getProjects: jest.fn(), getTeams: jest.fn() };
    witApi = { getWorkItemTypes: jest.fn(), getFields: jest.fn() };
    connectionProvider = jest.fn().mockResolvedValue({
      getCoreApi: jest.fn().mockResolvedValue(coreApi),
      getWorkItemTrackingApi: jest.fn().mockResolvedValue(witApi),
    } as unknown as WebApi) as () => Promise<WebApi>;
  });

  const allDomains = new Set<string>(Object.values(Domain));

  function register(domains: Set<string> = allDomains) {
    configureResources(server, connectionProvider, domains);
    return (server.registerResource as jest.Mock).mock.calls;
  }

  function read(name: string, variables: Record<string, unknown> = {}, domains: Set<string> = allDomains) {
    const call = register(domains).find(([registeredName]) => registeredName === name);
    if (!call) throw new Error(`${name} not registered`);
    const uriOrTemplate = call[1] as string | { uriTemplate: { toString(): string } };
    const uri = typeof uriOrTemplate === "string" ? uriOrTemplate : uriOrTemplate.uriTemplate.toString();
    return (call[3] as ReadCallback)(new URL(uri.replace(/\{project\}/, String(variables.project ?? "x"))), variables);
  }

  it("registers the reference resources", () => {
    const names = register().map(([name]) => name);
    expect(names).toEqual(["wiql-reference", "projects", "teams", "work-item-types", "fields"]);
  });

  it("registers nothing when neither domain is enabled", () => {
    expect(register(new Set<string>([Domain.REPOSITORIES]))).toHaveLength(0);
  });

  it("registers only the core resources when work items are not served", () => {
    const names = register(new Set<string>([Domain.CORE])).map(([name]) => name);
    expect(names).toEqual(["projects", "teams"]);
  });

  describe("wiql-reference", () => {
    it("serves the static reference as markdown without calling Azure DevOps", async () => {
      const result = await read("wiql-reference");

      expect(result.contents[0].mimeType).toBe("text/markdown");
      expect(result.contents[0].text).toBe(WIQL_REFERENCE);
      expect(connectionProvider).not.toHaveBeenCalled();
    });

    // The whole point of the document: the reference names and macros that a
    // query fails without.
    it.each(["System.AssignedTo", "System.IterationPath", "Microsoft.VSTS.Scheduling.StoryPoints", "@CurrentIteration", "@Today", "WorkItemLinks", "wit_list_fields"])("documents %s", (needle) => {
      expect(WIQL_REFERENCE).toContain(needle);
    });
  });

  describe("projects", () => {
    it("lists the organization's projects", async () => {
      coreApi.getProjects.mockResolvedValue([{ id: "p1", name: "Contoso", state: "wellFormed", visibility: "private", description: "d" }]);

      const result = await read("projects");

      expect(result.contents[0].uri).toBe(RESOURCE_URIS.projects);
      expect(JSON.parse(result.contents[0].text)).toEqual([{ id: "p1", name: "Contoso", state: "wellFormed", visibility: "private", description: "d" }]);
    });
  });

  describe("teams", () => {
    it("lists the teams of the project named in the URI", async () => {
      coreApi.getTeams.mockResolvedValue([{ id: "t1", name: "Web", description: "d" }]);

      const result = await read("teams", { project: "Contoso" });

      expect(coreApi.getTeams).toHaveBeenCalledWith("Contoso");
      expect(JSON.parse(result.contents[0].text)).toEqual([{ id: "t1", name: "Web", description: "d" }]);
    });
  });

  describe("work-item-types", () => {
    it("reports each type with its states", async () => {
      witApi.getWorkItemTypes.mockResolvedValue([{ name: "Bug", referenceName: "Microsoft.VSTS.WorkItemTypes.Bug", description: "d", states: [{ name: "Active", category: "InProgress" }] }]);

      const result = await read("work-item-types", { project: "Contoso" });

      expect(witApi.getWorkItemTypes).toHaveBeenCalledWith("Contoso");
      expect(JSON.parse(result.contents[0].text)[0]).toEqual({
        name: "Bug",
        referenceName: "Microsoft.VSTS.WorkItemTypes.Bug",
        description: "d",
        states: [{ name: "Active", category: "InProgress" }],
      });
    });

    it("tolerates a type with no states", async () => {
      witApi.getWorkItemTypes.mockResolvedValue([{ name: "Bug", referenceName: "r" }]);

      const result = await read("work-item-types", { project: "Contoso" });

      expect(JSON.parse(result.contents[0].text)[0].states).toBeUndefined();
    });
  });

  describe("fields", () => {
    it("maps display names to the reference names queries need", async () => {
      witApi.getFields.mockResolvedValue([{ name: "Assigned To", referenceName: "System.AssignedTo", type: "identity", readOnly: false }]);

      const result = await read("fields", { project: "Contoso" });

      expect(witApi.getFields).toHaveBeenCalledWith("Contoso");
      expect(JSON.parse(result.contents[0].text)).toEqual([{ name: "Assigned To", referenceName: "System.AssignedTo", type: "identity", readOnly: false }]);
    });

    it("propagates an Azure DevOps failure to the client", async () => {
      witApi.getFields.mockRejectedValue(new Error("TF401019: project not found"));

      await expect(read("fields", { project: "nope" })).rejects.toThrow(/TF401019/);
    });
  });
});
