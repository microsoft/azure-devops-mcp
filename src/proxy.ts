// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

/**
 * Configure undici's global dispatcher with EnvHttpProxyAgent when an
 * HTTP(S) proxy env var is set, so the built-in fetch() respects
 * HTTPS_PROXY / HTTP_PROXY / NO_PROXY. Node 20's fetch ignores these by
 * default — NODE_USE_ENV_PROXY=1 only landed in Node 22. Returns true if
 * the dispatcher was installed, false if no proxy env var was set.
 */
export function configureProxyDispatcher(): boolean {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy) {
    return false;
  }
  setGlobalDispatcher(new EnvHttpProxyAgent());
  return true;
}
