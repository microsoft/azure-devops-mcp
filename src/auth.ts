// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { logger } from "./logger.js";

function createAuthenticator(): () => Promise<string> {
  logger.debug(`Authenticator: Using PAT authentication from ADO_PAT environment variable`);
  return async () => {
    const token = process.env["ADO_PAT"];
    if (!token) {
      logger.error(`ADO_PAT environment variable is not set or empty`);
      throw new Error("Environment variable 'ADO_PAT' is not set or empty. Please set it with a valid Azure DevOps Personal Access Token.");
    }
    logger.debug(`Successfully retrieved PAT from ADO_PAT environment variable`);
    return token;
  };
}

export { createAuthenticator };
