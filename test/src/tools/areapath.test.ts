import { AccessToken } from "@azure/identity";
import { describe, expect, it } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureAreaPathTools, AREAPATH_TOOLS } from "../../../src/tools/areapath";
import { apiVersion } from "../../../src/utils";

// Mock the orgName from index.ts
jest.mock("../../../src/index.js", () => ({
  orgName: "testorg",
}));

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureAreaPathTools", () => {
    let server: McpServer;
    let tokenProvider: TokenProviderMock;
    let connectionProvider: ConnectionProviderMock;
    let userAgentProvider: () => string;
    let mockConnection: { serverUrl?: string };

    beforeEach(() => {
        server = { tool: jest.fn() } as unknown as McpServer;

        tokenProvider = jest.fn();
        userAgentProvider = () => "Jest";

        mockConnection = {
            serverUrl: "https://dev.azure.com/testorg",
        } as WebApi;

        connectionProvider = jest.fn().mockResolvedValue(mockConnection);

        // Mock fetch globally for these tests
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

  describe("list_project_area_paths tool", () => {
    it("should retrieve area paths with default depth", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockClassificationData = {
        value: [
          {
            name: "Area",
            children: [
              {
                name: "Team A",
                children: [
                  { name: "Sub Team 1" },
                  { name: "Sub Team 2" }
                ]
              },
              {
                name: "Team B",
                children: []
              }
            ]
          },
          {
            name: "Iteration",
            children: [
              {
                name: "Sprint 1",
                children: []
              }
            ]
          }
        ]
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockClassificationData),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        depth: 2,
      };

      const result = await handler(params);

      expect(result.isError).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledWith(
        `https://dev.azure.com/testorg/TestProject/_apis/wit/classificationnodes?$depth=2&api-version=7.0`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
          }),
        })
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.project).toBe("TestProject");
      expect(responseData.depth).toBe(2);
      expect(responseData.totalAreaPaths).toBe(4);
      expect(responseData.areaPaths).toContain("Area\\Team A");
      expect(responseData.areaPaths).toContain("Area\\Team A\\Sub Team 1");
      expect(responseData.areaPaths).toContain("Area\\Team A\\Sub Team 2");
      expect(responseData.areaPaths).toContain("Area\\Team B");
      expect(responseData.totalIterationPaths).toBe(1);
      expect(responseData.iterationPaths).toContain("Iteration\\Sprint 1");
    });

    it("should retrieve area paths with custom depth", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        depth: 5,
      };

      await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://dev.azure.com/testorg/TestProject/_apis/wit/classificationnodes?$depth=5&api-version=7.0`,
        expect.any(Object)
      );
    });

    it("should handle API errors gracefully", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Project not found"),
      });
      global.fetch = mockFetch;

      const params = {
        project: "NonExistentProject",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error fetching classification nodes: 404 Not Found");
    });

    it("should handle network errors", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockRejectedValue(new Error("Network timeout"));
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving area paths: Network timeout");
    });

    it("should handle empty classification nodes", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });
      global.fetch = mockFetch;

      const params = {
        project: "EmptyProject",
      };

      const result = await handler(params);

      expect(result.isError).toBeFalsy();
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.totalAreaPaths).toBe(0);
      expect(responseData.totalIterationPaths).toBe(0);
      expect(responseData.areaPaths).toEqual([]);
      expect(responseData.iterationPaths).toEqual([]);
    });

    it("should correctly extract nested area paths", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.list_project_area_paths
      );

      if (!call) throw new Error("list_project_area_paths tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockClassificationData = {
        value: [
          {
            name: "Area",
            children: [
              {
                name: "Frontend",
                children: [
                  {
                    name: "UI Components",
                    children: [
                      { name: "Buttons" },
                      { name: "Forms" }
                    ]
                  },
                  { name: "Routing" }
                ]
              },
              {
                name: "Backend",
                children: [
                  { name: "API" },
                  { name: "Database" }
                ]
              }
            ]
          }
        ]
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockClassificationData),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        depth: 4,
      };

      const result = await handler(params);

      expect(result.isError).toBeFalsy();
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData.areaPaths).toContain("Area\\Frontend");
      expect(responseData.areaPaths).toContain("Area\\Frontend\\UI Components");
      expect(responseData.areaPaths).toContain("Area\\Frontend\\UI Components\\Buttons");
      expect(responseData.areaPaths).toContain("Area\\Frontend\\UI Components\\Forms");
      expect(responseData.areaPaths).toContain("Area\\Frontend\\Routing");
      expect(responseData.areaPaths).toContain("Area\\Backend");
      expect(responseData.areaPaths).toContain("Area\\Backend\\API");
      expect(responseData.areaPaths).toContain("Area\\Backend\\Database");
      
      // Verify paths are sorted
      const sortedPaths = [...responseData.areaPaths].sort();
      expect(responseData.areaPaths).toEqual(sortedPaths);
    });
  });

  describe("create_area_path tool", () => {
    it("should create area path under root when no parent specified", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.create_area_path
      );

      if (!call) throw new Error("create_area_path tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockCreatedAreaPath = {
        id: 123,
        name: "New Team",
        path: "\\TestProject\\Area\\New Team",
        hasChildren: false,
        structureType: "area",
        url: "https://dev.azure.com/contoso/_apis/wit/classificationNodes/Areas/123"
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCreatedAreaPath),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        name: "New Team",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConnection.serverUrl}/TestProject/_apis/wit/classificationnodes/Areas?api-version=${apiVersion}`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
            "User-Agent": "Jest",
          }),
          body: JSON.stringify({ name: "New Team" }),
        })
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Area path "New Team" created successfully');
      expect(responseData.areaPath.name).toBe("New Team");
      expect(responseData.areaPath.parentPath).toBe("Root");
    });

    it("should create area path under specified parent", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.create_area_path
      );

      if (!call) throw new Error("create_area_path tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockCreatedAreaPath = {
        id: 124,
        name: "Subteam",
        path: "\\TestProject\\Area\\Team A\\Subteam",
        hasChildren: false,
        structureType: "area",
        url: "https://dev.azure.com/contoso/_apis/wit/classificationNodes/Areas/124"
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCreatedAreaPath),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        name: "Subteam",
        parentPath: "Team A",
      };

      const result = await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConnection.serverUrl}/TestProject/_apis/wit/classificationnodes/Areas/Team%20A?api-version=${apiVersion}`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer fake-token",
            "Content-Type": "application/json",
            "User-Agent": "Jest",
          }),
          body: JSON.stringify({ name: "Subteam" }),
        })
      );

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Area path "Subteam" created successfully');
      expect(responseData.areaPath.name).toBe("Subteam");
      expect(responseData.areaPath.parentPath).toBe("Team A");
    });

    it("should handle API error responses when creating area path", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.create_area_path
      );

      if (!call) throw new Error("create_area_path tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Area path already exists"),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        name: "Existing Team",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating area path: 400 Bad Request - Area path already exists");
    });

    it("should handle fetch exceptions when creating area path", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.create_area_path
      );

      if (!call) throw new Error("create_area_path tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockRejectedValue(new Error("Connection timeout"));
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        name: "New Team",
      };

      const result = await handler(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating area path: Connection timeout");
    });

    it("should properly encode parent path with special characters", async () => {
      configureAreaPathTools(server, tokenProvider, connectionProvider, userAgentProvider);

      const call = (server.tool as jest.Mock).mock.calls.find(
        ([toolName]) => toolName === AREAPATH_TOOLS.create_area_path
      );

      if (!call) throw new Error("create_area_path tool not registered");
      const [, , , handler] = call;

      (tokenProvider as jest.Mock).mockResolvedValue({ token: "fake-token" });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 125,
          name: "Child",
          path: "\\TestProject\\Area\\Team With Spaces\\Child",
        }),
      });
      global.fetch = mockFetch;

      const params = {
        project: "TestProject",
        name: "Child",
        parentPath: "Team With Spaces",
      };

      await handler(params);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConnection.serverUrl}/TestProject/_apis/wit/classificationnodes/Areas/Team%20With%20Spaces?api-version=${apiVersion}`,
        expect.any(Object)
      );
    });
  });
});