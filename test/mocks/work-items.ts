export const _mockWorkItems = {
  count: 3,
  value: [
    {
      id: 297,
      rev: 1,
      fields: {
        "System.Id": 297,
        "System.WorkItemType": "Product Backlog Item",
        "System.Title": "Customer can sign in using their Microsoft Account",
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
        "Microsoft.VSTS.Scheduling.RemainingWork": 3,
      },
      url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/300",
    },
  ],
};

export const _mockBacklogs = {
  count: 2,
  value: [
    {
      id: "Microsoft.EpicCategory",
      name: "Epics",
      rank: 4,
      workItemCountLimit: 1000,
      addPanelFields: [
        {
          referenceName: "System.Title",
          name: "Title",
          url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Title",
        },
      ],
      columnFields: [
        {
          columnFieldReference: {
            referenceName: "System.WorkItemType",
            name: "Work Item Type",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.WorkItemType",
          },
          width: 100,
        },
        {
          columnFieldReference: {
            referenceName: "System.Title",
            name: "Title",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Title",
          },
          width: 400,
        },
        {
          columnFieldReference: {
            referenceName: "System.State",
            name: "State",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.State",
          },
          width: 100,
        },
        {
          columnFieldReference: {
            referenceName: "Microsoft.VSTS.Scheduling.Effort",
            name: "Effort",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/Microsoft.VSTS.Scheduling.Effort",
          },
          width: 50,
        },
        {
          columnFieldReference: {
            referenceName: "System.Tags",
            name: "Tags",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Tags",
          },
          width: 200,
        },
      ],
      workItemTypes: [
        {
          name: "Epic",
          url: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/wit/workItemTypes/Epic",
        },
      ],
      defaultWorkItemType: {
        name: "Epic",
        url: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/wit/workItemTypes/Epic",
      },
      color: "FF7B00",
      isHidden: false,
      type: "portfolio",
    },
    {
      id: "Microsoft.FeatureCategory",
      name: "Features",
      rank: 3,
      workItemCountLimit: 1000,
      addPanelFields: [
        {
          referenceName: "System.Title",
          name: "Title",
          url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Title",
        },
      ],
      columnFields: [
        {
          columnFieldReference: {
            referenceName: "System.WorkItemType",
            name: "Work Item Type",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.WorkItemType",
          },
          width: 100,
        },
        {
          columnFieldReference: {
            referenceName: "System.Title",
            name: "Title",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Title",
          },
          width: 400,
        },
        {
          columnFieldReference: {
            referenceName: "System.State",
            name: "State",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.State",
          },
          width: 100,
        },
        {
          columnFieldReference: {
            referenceName: "System.Tags",
            name: "Tags",
            url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Tags",
          },
          width: 200,
        },
      ],
      workItemTypes: [
        {
          name: "Feature",
          url: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/wit/workItemTypes/Feature",
        },
      ],
      defaultWorkItemType: {
        name: "Feature",
        url: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/wit/workItemTypes/Feature",
      },
      color: "773B93",
      isHidden: false,
      type: "portfolio",
    },
  ],
};

export const _mockWorkItem = {
  id: 131489,
  rev: 1,
  fields: {
    "System.AreaPath": "CustomProcessPrj",
    "System.TeamProject": "CustomProcessPrj",
    "System.IterationPath": "CustomProcessPrj",
    "System.WorkItemType": "Task",
    "System.State": "New",
    "System.Reason": "New",
    "System.CreatedDate": "2017-10-06T01:04:51.57Z",
    "System.CreatedBy": {
      displayName: "Jamal Hartnett",
      url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      _links: {
        avatar: {
          href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
        },
      },
      id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      uniqueName: "fabrikamfiber4@hotmail.com",
      imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
    },
    "System.ChangedDate": "2017-10-06T01:04:51.57Z",
    "System.ChangedBy": {
      displayName: "Jamal Hartnett",
      url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      _links: {
        avatar: {
          href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
        },
      },
      id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      uniqueName: "fabrikamfiber4@hotmail.com",
      imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
      descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
    },
    "System.Title": "Sample task",
    "Microsoft.VSTS.Common.StateChangeDate": "2017-10-06T01:04:51.57Z",
    "Microsoft.VSTS.Common.Priority": 2,
  },
  _links: {
    self: {
      href: "https://dev.azure.com/fabrikam/_apis/wit/workItems/131489",
    },
    workItemUpdates: {
      href: "https://dev.azure.com/fabrikam/_apis/wit/workItems/131489/updates",
    },
    workItemRevisions: {
      href: "https://dev.azure.com/fabrikam/_apis/wit/workItems/131489/revisions",
    },
    workItemHistory: {
      href: "https://dev.azure.com/fabrikam/_apis/wit/workItems/131489/history",
    },
    html: {
      href: "https://dev.azure.com/fabrikam/web/wi.aspx?pcguid=20cda608-32f0-4e6e-9b7c-8def7b38d15a&id=131489",
    },
    workItemType: {
      href: "https://dev.azure.com/fabrikam/aaee31d9-14cf-48b9-a92b-3f1446c13f80/_apis/wit/workItemTypes/Task",
    },
    fields: {
      href: "https://dev.azure.com/fabrikam/_apis/wit/fields",
    },
  },
  url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/131489",
};

export const _mockWorkItemComment = {
  workItemId: 299,
  commentId: 50,
  version: 1,
  text: "Moving to the right area path",
  createdBy: {
    displayName: "Jamal Hartnett",
    url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    _links: {
      avatar: {
        href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
    },
    id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    uniqueName: "fabrikamfiber4@hotmail.com",
    imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
  },
  createdDate: "2019-01-16T03:03:28.97Z",
  modifiedBy: {
    displayName: "Jamal Hartnett",
    url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    _links: {
      avatar: {
        href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
    },
    id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    uniqueName: "fabrikamfiber4@hotmail.com",
    imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
  },
  modifiedDate: "2019-01-16T03:03:28.97Z",
  isDeleted: false,
  url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItems/299/comments/50",
};

export const _mockWorkItemComments = {
  totalCount: 10,
  count: 2,
  comments: [
    {
      workItemId: 299,
      commentId: 45,
      version: 1,
      text: "Johnnie is going to take this work over.",
      createdBy: {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      createdDate: "2019-01-21T20:12:14.683Z",
      modifiedBy: {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      modifiedDate: "2019-01-21T20:12:14.683Z",
      isDeleted: false,
      url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItems/299/comments/45",
    },
    {
      workItemId: 299,
      commentId: 44,
      version: 1,
      text: "Moving to the right area path",
      createdBy: {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      createdDate: "2019-01-20T23:26:33.383Z",
      modifiedBy: {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      modifiedDate: "2019-01-20T23:26:33.383Z",
      isDeleted: false,
      url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItems/299/comments/44",
    },
  ],
  nextPage: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItems/299/comments?continuationToken=DFkODYtNTYxYS03ZDdiLWJj&api-version=5.1-preview",
  continuationToken: "DFkODYtNTYxYS03ZDdiLWJj",
};

export const _mockWorkItemsForIteration = {
  workItemRelations: [
    {
      rel: null,
      source: null,
      target: {
        id: 1,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/1",
      },
    },
    {
      rel: "System.LinkTypes.Hierarchy-Forward",
      source: {
        id: 1,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/1",
      },
      target: {
        id: 3,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/3",
      },
    },
  ],
  url: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553/workitems",
  _links: {
    self: {
      href: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553/workitems",
    },
    iteration: {
      href: "https://dev.azure.com/fabrikam/Fabrikam-Fiber/_apis/work/teamsettings/iterations/a589a806-bf11-4d4f-a031-c19813331553",
    },
  },
};

export const _mockWorkItemType = {
  name: "Bug",
  referenceName: "Microsoft.VSTS.WorkItemTypes.Bug",
  description: "Describes a divergence between required and actual behavior, and tracks the work done to correct the defect and verify the correction.",
  color: "CC293D",
  icon: {
    id: "icon_insect",
    url: "https://dev.azure.com/fabrikam/_apis/wit/workItemIcons/icon_insect?color=CC293D&v=2",
  },
  isDisabled: false,
  fields: [
    {
      helpText: "The iteration within which this bug will be fixed",
      alwaysRequired: false,
      referenceName: "System.IterationPath",
      name: "Iteration Path",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields",
    },
    {
      alwaysRequired: true,
      referenceName: "System.IterationId",
      name: "Iteration ID",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields",
    },
    {
      alwaysRequired: false,
      referenceName: "System.ExternalLinkCount",
      name: "External Link Count",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields",
    },
    {
      alwaysRequired: false,
      referenceName: "System.TeamProject",
      name: "Team Project",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields",
    },
  ],
};

export const _mockQuery = {
  id: "342f0f44-4069-46b1-a940-3d0468979ceb",
  name: "Active Bugs",
  path: "My Queries/Website/Active Bugs",
  createdBy: {
    displayName: "Jamal Hartnett",
    url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    _links: {
      avatar: {
        href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
    },
    id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    uniqueName: "fabrikamfiber4@hotmail.com",
    imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
  },
  createdDate: "2014-03-18T17:18:36.06Z",
  lastModifiedBy: {
    displayName: "Jamal Hartnett",
    url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    _links: {
      avatar: {
        href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
    },
    id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    uniqueName: "fabrikamfiber4@hotmail.com",
    imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
  },
  lastModifiedDate: "2014-03-18T17:18:36.06Z",
  lastExecutedBy: {
    displayName: "Jamal Hartnett",
    url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    _links: {
      avatar: {
        href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
    },
    id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    uniqueName: "fabrikamfiber4@hotmail.com",
    imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
    descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
  },
  lastExecutedDate: "2014-03-18T17:19:36.06Z",
  isDeleted: true,
  isPublic: false,
  _links: {
    self: {
      href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/queries/342f0f44-4069-46b1-a940-3d0468979ceb",
    },
    html: {
      href: "https://dev.azure.com/fabrikam/web/qr.aspx?pguid=6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c&qid=342f0f44-4069-46b1-a940-3d0468979ceb",
    },
    parent: {
      href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/queries/8a8c8212-15ca-41ed-97aa-1d6fbfbcd581",
    },
    wiql: {
      href: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/wiql/342f0f44-4069-46b1-a940-3d0468979ceb",
    },
  },
  url: "https://dev.azure.com/fabrikam/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/queries/342f0f44-4069-46b1-a940-3d0468979ceb",
};

export const _mockQueryResults = {
  queryType: "tree",
  asOf: "2014-12-29T20:49:33.803Z",
  columns: [
    {
      referenceName: "System.Id",
      name: "ID",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Id",
    },
    {
      referenceName: "System.WorkItemType",
      name: "Work Item Type",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.WorkItemType",
    },
    {
      referenceName: "System.Title",
      name: "Title",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.Title",
    },
    {
      referenceName: "System.AssignedTo",
      name: "Assigned To",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.AssignedTo",
    },
    {
      referenceName: "System.State",
      name: "State",
      url: "https://dev.azure.com/fabrikam/_apis/wit/fields/System.State",
    },
  ],
  workItemRelations: [
    {
      target: {
        id: 4,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/4",
      },
    },
    {
      target: {
        id: 5,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/5",
      },
    },
    {
      target: {
        id: 6,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/6",
      },
    },
    {
      target: {
        id: 7,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/7",
      },
    },
    {
      rel: "System.LinkTypes.Hierarchy-Forward",
      source: {
        id: 7,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/7",
      },
      target: {
        id: 8,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/8",
      },
    },
    {
      rel: "System.LinkTypes.Hierarchy-Forward",
      source: {
        id: 7,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/7",
      },
      target: {
        id: 9,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/9",
      },
    },
    {
      target: {
        id: 20,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/20",
      },
    },
    {
      rel: "System.LinkTypes.Hierarchy-Forward",
      source: {
        id: 20,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/20",
      },
      target: {
        id: 1,
        url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/1",
      },
    },
  ],
};

export const _mockWorkItemRevisions = [
  {
    id: 299,
    rev: 1,
    fields: {
      "System.Id": 299,
      "System.WorkItemType": "Task",
      "System.State": "New",
      "System.Title": "JavaScript implementation for Microsoft Account",
      "System.CreatedBy": {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      "System.ChangedBy": {
        displayName: "Jamal Hartnett",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
          },
        },
        id: "d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        uniqueName: "fabrikamfiber4@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=d291b0c4-a05c-4ea6-8df1-4b41d5f39eff",
        descriptor: "aad.YTkzODFkODYtNTYxYS03ZDdiLWJjM2QtZDUzMjllMjM5OTAz",
      },
      "System.CreatedDate": "2019-01-15T10:30:00.000Z",
      "System.ChangedDate": "2019-01-15T10:30:00.000Z",
    },
    url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/299/revisions/1",
  },
  {
    id: 299,
    rev: 2,
    fields: {
      "System.Id": 299,
      "System.WorkItemType": "Task",
      "System.State": "Active",
      "System.Title": "JavaScript implementation for Microsoft Account",
      "System.AssignedTo": {
        displayName: "Christie Church",
        url: "https://vssps.dev.azure.com/fabrikam/_apis/Identities/8c8c7d32-6b1b-47f4-b2e9-30b477b5ab3d",
        _links: {
          avatar: {
            href: "https://dev.azure.com/mseng/_apis/GraphProfile/MemberAvatars/aad.OGM4YzdkMzItNmIxYi00N2Y0LWIyZTktMzBiNDc3YjVhYjNk",
          },
        },
        id: "8c8c7d32-6b1b-47f4-b2e9-30b477b5ab3d",
        uniqueName: "fabrikamfiber5@hotmail.com",
        imageUrl: "https://dev.azure.com/fabrikam/_api/_common/identityImage?id=8c8c7d32-6b1b-47f4-b2e9-30b477b5ab3d",
        descriptor: "aad.OGM4YzdkMzItNmIxYi00N2Y0LWIyZTktMzBiNDc3YjVhYjNk",
      },
      "System.CreatedBy": {
        displayName: "Jamal Hartnett",
      },
      "System.ChangedBy": {
        displayName: "Jamal Hartnett",
      },
      "System.CreatedDate": "2019-01-15T10:30:00.000Z",
      "System.ChangedDate": "2019-01-16T14:20:00.000Z",
    },
    url: "https://dev.azure.com/fabrikam/_apis/wit/workItems/299/revisions/2",
  },
];
