// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { WebApi } from "azure-devops-node-api";

async function getCurrentUserDetails(_tokenProvider: () => Promise<AccessToken>, connectionProvider: () => Promise<WebApi>) {
  const connection = await connectionProvider();

  // Use the connection's built-in connect() method which handles authentication automatically
  // This works for both PAT and OAuth tokens since the WebApi was created with the proper auth handler
  const connectionData = await connection.connect();

  return connectionData;
}

export { getCurrentUserDetails };
