export const _mockPipelines = {
  count: 2,
  value: [
    {
      id: 1,
      name: "CI-Build",
      folder: "\\",
      revision: 1,
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1",
      _links: {
        self: {
          href: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1"
        },
        web: {
          href: "https://dev.azure.com/contoso/MyProject/_build/definition?definitionId=1"
        }
      }
    },
    {
      id: 2,
      name: "CD-Release",
      folder: "\\Release",
      revision: 3,
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/2",
      _links: {
        self: {
          href: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/2"
        },
        web: {
          href: "https://dev.azure.com/contoso/MyProject/_build/definition?definitionId=2"
        }
      }
    }
  ]
};

export const _mockPipeline = {
  id: 1,
  name: "CI-Build",
  folder: "\\",
  revision: 1,
  url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1",
  _links: {
    self: {
      href: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1"
    },
    web: {
      href: "https://dev.azure.com/contoso/MyProject/_build/definition?definitionId=1"
    }
  },
  configuration: {
    type: "yaml",
    path: "/azure-pipelines.yml",
    repository: {
      id: "repo123",
      name: "MyRepo",
      type: "azureReposGit"
    }
  }
};

export const _mockPipelineRuns = {
  count: 2,
  value: [
    {
      id: 101,
      name: "CI-Build-20241201.1",
      state: "completed",
      result: "succeeded",
      createdDate: "2024-12-01T10:00:00.000Z",
      finishedDate: "2024-12-01T10:15:00.000Z",
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/101",
      pipeline: {
        id: 1,
        name: "CI-Build"
      },
      resources: {
        repositories: {
          self: {
            repository: {
              id: "repo123",
              name: "MyRepo"
            },
            refName: "refs/heads/main",
            version: "abc123def456"
          }
        }
      }
    },
    {
      id: 102,
      name: "CI-Build-20241201.2",
      state: "inProgress",
      result: null,
      createdDate: "2024-12-01T11:00:00.000Z",
      finishedDate: null,
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/102",
      pipeline: {
        id: 1,
        name: "CI-Build"
      },
      resources: {
        repositories: {
          self: {
            repository: {
              id: "repo123",
              name: "MyRepo"
            },
            refName: "refs/heads/feature/test",
            version: "def456ghi789"
          }
        }
      }
    }
  ]
};

export const _mockRunLogs = {
  count: 3,
  value: [
    {
      id: 1,
      name: "Initialize job",
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/101/logs/1",
      lineCount: 25
    },
    {
      id: 2,
      name: "Build solution",
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/101/logs/2",
      lineCount: 150
    },
    {
      id: 3,
      name: "Run tests",
      url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/101/logs/3",
      lineCount: 89
    }
  ]
};

export const _mockLogContent = {
  value: [
    "2024-12-01T10:00:00.000Z Starting build job...",
    "2024-12-01T10:00:01.000Z Checking out source code",
    "2024-12-01T10:00:05.000Z Source checkout completed",
    "2024-12-01T10:00:06.000Z Installing dependencies",
    "2024-12-01T10:00:30.000Z Dependencies installed successfully",
    "2024-12-01T10:00:31.000Z Starting build process",
    "2024-12-01T10:05:00.000Z Build completed successfully"
  ]
};

export const _mockPipelinePreview = {
  finalYaml: `trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: |
    npm install
    npm run build
  displayName: 'npm install and build'

- script: |
    npm test
  displayName: 'Run tests'
`,
  yamlErrorMessage: null
};

export const _mockPipelineRun = {
  id: 103,
  name: "CI-Build-20241201.3",
  state: "inProgress",
  result: null,
  createdDate: "2024-12-01T12:00:00.000Z",
  finishedDate: null,
  url: "https://dev.azure.com/contoso/MyProject/_apis/pipelines/1/runs/103",
  pipeline: {
    id: 1,
    name: "CI-Build"
  },
  resources: {
    repositories: {
      self: {
        repository: {
          id: "repo123",
          name: "MyRepo"
        },
        refName: "refs/heads/main",
        version: "ghi789jkl012"
      }
    }
  }
};
