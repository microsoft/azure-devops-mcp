export const _mockBuildTemplates = {
  count: 2,
  value: [
    {
      id: "ms.vss-build-web.empty-process-template",
      name: "Empty job",
      description: "An empty job for building",
      iconTaskId: "00000000-0000-0000-0000-000000000000",
      category: "Basic",
      properties: {}
    },
    {
      id: "ms.vss-build-web.node.js-process-template", 
      name: "Node.js",
      description: "Build and test a Node.js application",
      iconTaskId: "e213ff0f-5d5c-4791-802d-52ea3e7be1f1",
      category: "Build",
      properties: {}
    }
  ]
};

export const _mockBuildLogsZipResult = {
  buildId: 12345,
  project: "MyProject",
  success: true,
  filename: "build-12345-logs-myproject.zip",
  extractDir: "C:\\Users\\test\\Downloads\\build-12345-logs-myproject",
  zipFilePath: "C:\\Users\\test\\Downloads\\build-12345-logs-myproject.zip",
  analysisGuideCreated: true,
  openedInVSCode: true,
  message: "Build logs downloaded, extracted with nested archive support, analysis guide created, and opened in VS Code for comprehensive build failure investigation."
};
