// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = {
  headers: Record<string, string | string[] | undefined>;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

function runWithRequestContext<T>(headers: Record<string, string | string[] | undefined>, callback: () => Promise<T>): Promise<T> {
  return requestContextStorage.run({ headers }, callback);
}

function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export { getRequestContext, runWithRequestContext };
