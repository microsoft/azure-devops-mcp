import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

interface OrgTenantCacheEntry {
  tenantId: string;
  refreshedOn: number;
}

interface OrgTenantCache {
  [orgName: string]: OrgTenantCacheEntry;
}

const CACHE_FILE = path.join(os.homedir(), ".ado_orgs.cache");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

async function loadCache(): Promise<OrgTenantCache> {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(cacheData);
  } catch (error) {
    // Cache file doesn't exist or is invalid, return empty cache
    return {};
  }
}

async function trySavingCache(cache: OrgTenantCache): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save org tenants cache:", error);
  }
}

async function fetchTenantFromApi(orgName: string): Promise<string> {
  const url = `https://vssps.dev.azure.com/${orgName}`;

  try {
    const response = await fetch(url, { method: "HEAD" });

    if (response.status !== 404) {
      throw new Error(`Expected status 404, got ${response.status}`);
    }

    const tenantId = response.headers.get("x-vss-resourcetenant");
    if (!tenantId) {
      throw new Error("x-vss-resourcetenant header not found in response");
    }

    return tenantId;
  } catch (error) {
    throw new Error(`Failed to fetch tenant for organization ${orgName}: ${error}`);
  }
}

function isCacheEntryExpired(entry: OrgTenantCacheEntry): boolean {
  return Date.now() - entry.refreshedOn > CACHE_TTL_MS;
}

export async function getOrgTenant(orgName: string): Promise<string | undefined> {
  // Load cache
  const cache = await loadCache();

  // Check if tenant is cached and not expired
  const cachedEntry = cache[orgName];
  if (cachedEntry && !isCacheEntryExpired(cachedEntry)) {
    return cachedEntry.tenantId;
  }

  // Try to fetch fresh tenant from API
  try {
    const tenantId = await fetchTenantFromApi(orgName);

    // Cache the result
    cache[orgName] = {
      tenantId,
      refreshedOn: Date.now(),
    };
    await trySavingCache(cache);

    return tenantId;
  } catch (error) {
    // If we have an expired cache entry, return it as fallback
    if (cachedEntry) {
      console.error(`Failed to fetch fresh tenant for ADO org ${orgName}, using expired cache entry:`, error);
      return cachedEntry.tenantId;
    }

    // No cache entry available, log and return empty result
    console.error(`Failed to fetch tenant for ADO org ${orgName}:`, error);
    return undefined;
  }
}
