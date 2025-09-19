// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const _mockTags = {
  count: 5,
  value: [
    {
      id: "1",
      name: "bug",
      url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/1",
    },
    {
      id: "2",
      name: "feature",
      url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/2",
    },
    {
      id: "3",
      name: "high-priority",
      url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/3",
    },
    {
      id: "4",
      name: "backend",
      url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/4",
    },
    {
      id: "5",
      name: "unused-tag",
      url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/5",
    },
  ],
};

export const _mockWorkItemsWithTags = {
  count: 4,
  value: [
    {
      id: 297,
      rev: 1,
      fields: {
        "System.Id": 297,
        "System.WorkItemType": "Product Backlog Item",
        "System.Title": "Customer can sign in using their Microsoft Account",
        "System.Tags": "bug; high-priority",
        "System.ChangedDate": "2023-01-15T10:30:00.000Z",
      },
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/297",
    },
    {
      id: 299,
      rev: 7,
      fields: {
        "System.Id": 299,
        "System.WorkItemType": "Task",
        "System.Title": "JavaScript implementation for Microsoft Account",
        "System.Tags": "feature; backend",
        "System.ChangedDate": "2023-01-20T14:15:00.000Z",
        "Microsoft.VSTS.Scheduling.RemainingWork": 4,
      },
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/299",
    },
    {
      id: 301,
      rev: 1,
      fields: {
        "System.Id": 301,
        "System.WorkItemType": "Task",
        "System.Title": "Unit Testing for MSA login",
        "System.Tags": "bug",
        "System.ChangedDate": "2023-01-10T09:00:00.000Z",
        "Microsoft.VSTS.Scheduling.RemainingWork": 3,
      },
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/301",
    },
    {
      id: 400,
      rev: 1,
      fields: {
        "System.Id": 400,
        "System.WorkItemType": "Task",
        "System.Title": "Work item without tags",
        "System.ChangedDate": "2023-01-22T11:00:00.000Z",
        "Microsoft.VSTS.Scheduling.RemainingWork": 2,
      },
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/400",
    },
  ],
};

export const _mockWorkItemSearchByTagsResult = {
  workItems: [
    {
      id: 297,
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/297",
    },
    {
      id: 301,
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/301",
    },
  ],
};

export const _mockWorkItemWithoutTags = {
  id: 400,
  rev: 1,
  fields: {
    "System.Id": 400,
    "System.WorkItemType": "Task",
    "System.Title": "Work item without tags",
    "System.ChangedDate": "2023-01-25T16:30:00.000Z",
  },
  url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/400",
};

export const _mockUpdatedTag = {
  id: "1",
  name: "critical-bug",
  url: "https://dev.azure.com/fabrikam/DefaultCollection/_apis/wit/tags/1",
};

export const _mockTagAnalyticsResponse = {
  summary: {
    totalTagsInProject: 5,
    usedTagsCount: 4,
    unusedTagsCount: 1,
    workItemsAnalyzed: 3,
    maxWorkItemsRequested: 1000,
    unusedTagsReported: 1,
    maxUnusedTagsToCheck: 100,
  },
  usedTags: [
    {
      tag: "bug",
      usageCount: 2,
      lastUsed: "2023-01-15T10:30:00.000Z",
    },
    {
      tag: "feature",
      usageCount: 1,
      lastUsed: "2023-01-20T14:15:00.000Z",
    },
    {
      tag: "high-priority",
      usageCount: 1,
      lastUsed: "2023-01-15T10:30:00.000Z",
    },
    {
      tag: "backend",
      usageCount: 1,
      lastUsed: "2023-01-20T14:15:00.000Z",
    },
  ],
  unusedTags: ["unused-tag"],
  analysis: {
    mostUsedTag: {
      tag: "bug",
      usageCount: 2,
      lastUsed: "2023-01-15T10:30:00.000Z",
    },
    leastUsedTag: {
      tag: "backend",
      usageCount: 1,
      lastUsed: "2023-01-20T14:15:00.000Z",
    },
    tagUtilizationRate: "80.00%",
  },
};

export const _mockWiqlQueryResult = {
  queryType: "flat",
  workItems: [
    {
      id: 297,
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/297",
    },
    {
      id: 301,
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/301",
    },
  ],
};

export const _mockEmptyWiqlQueryResult = {
  queryType: "flat",
  workItems: [],
};

export const _mockDeleteUnusedTagsResponse = {
  success: true,
  message: "Deletion completed. Successfully deleted 1 out of 1 unused tags.",
  project: "TestProject",
  dryRun: false,
  tagsChecked: 5,
  workItemsProcessed: 3,
  unusedTagsFound: 1,
  tagsToDelete: ["unused-tag"],
  results: {
    successful: 1,
    failed: 0,
    details: [
      {
        tag: "unused-tag",
        success: true,
      },
    ],
  },
  summary: "Deleted 1 unused tags.",
};
