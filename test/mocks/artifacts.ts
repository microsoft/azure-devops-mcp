// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const mockArtifact = {
  id: 1,
  name: "drop",
  resource: { type: "Container", data: "123456" },
};

export const mockMultipleArtifacts = [
  {
    id: 1,
    name: "drop",
    resource: {
      type: "Container",
      data: "123456",
    },
  },
  {
    id: 2,
    name: "logs",
    resource: {
      type: "Container",
      data: "789012",
    },
  },
];
