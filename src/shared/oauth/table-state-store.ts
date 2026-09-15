// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Azure Table Storage backing for the OAuth authorization server's state.
//
// Why: the in-memory store dies with the process, so every deploy or restart
// invalidated the MCP clients' registrations and grants — the client then
// reports the server as unreachable instead of re-authenticating. Persisting
// the state also removes the reason the container app was pinned to a single
// replica.
//
// Access is via Microsoft Entra (the container app's managed identity), so no
// storage account key is stored anywhere; the account has shared-key access
// disabled entirely.

import { TableClient, TableEntity, odata } from "@azure/data-tables";
import type { TokenCredential } from "@azure/identity";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import { logger } from "../../logger.js";
import { CODE_TTL_MS, IssuedCode, OAuthStateStore, PENDING_TTL_MS, PendingAuthorization } from "./state-store.js";

// One table holds all three kinds of state, partitioned by kind. Entities are
// tiny and always addressed by exact key, so a single partition per kind costs
// nothing and keeps eviction to one query per kind.
const PARTITION = {
  client: "client",
  pending: "pending",
  code: "code",
} as const;

interface StateEntity {
  partitionKey: string;
  rowKey: string;
  /** The entry itself, serialized. Table Storage has no nested types. */
  payload: string;
  /** Epoch millis after which the entry is garbage. 0 for entries that never expire. */
  expiresAt: number;
}

/**
 * Table Storage rejects a number of characters in key fields. Client IDs and
 * codes are generated UUIDs, so this is a guard against a future caller rather
 * than a transformation the current code needs.
 */
function toRowKey(value: string): string {
  return encodeURIComponent(value).replace(/[/\\#?]/g, "_");
}

export class TableOAuthStateStore implements OAuthStateStore {
  private readonly client: TableClient;
  private tableReady?: Promise<void>;

  constructor(tableEndpoint: string, tableName: string, credential: TokenCredential) {
    this.client = new TableClient(tableEndpoint, tableName, credential);
  }

  /** Creates the table on first use so a fresh deployment works without a manual step. */
  private async ensureTable(): Promise<void> {
    this.tableReady ??= this.client.createTable().catch((error: unknown) => {
      // Already exists, or the identity may only read/write rows — either way
      // the operations below will tell us for real.
      logger.debug(`OAuth state table not created: ${error instanceof Error ? error.message : String(error)}`);
    });
    return this.tableReady;
  }

  private async put(partitionKey: string, key: string, value: unknown, expiresAt: number): Promise<void> {
    await this.ensureTable();
    const entity: TableEntity<Omit<StateEntity, "partitionKey" | "rowKey">> = {
      partitionKey,
      rowKey: toRowKey(key),
      payload: JSON.stringify(value),
      expiresAt,
    };
    await this.client.upsertEntity(entity, "Replace");
  }

  private async read<T>(partitionKey: string, key: string): Promise<{ value: T; expiresAt: number } | undefined> {
    await this.ensureTable();
    try {
      const entity = await this.client.getEntity<StateEntity>(partitionKey, toRowKey(key));
      return { value: JSON.parse(entity.payload) as T, expiresAt: Number(entity.expiresAt) };
    } catch (error: unknown) {
      if ((error as { statusCode?: number })?.statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }

  private async remove(partitionKey: string, key: string): Promise<void> {
    try {
      await this.client.deleteEntity(partitionKey, toRowKey(key));
    } catch (error: unknown) {
      if ((error as { statusCode?: number })?.statusCode !== 404) {
        throw error;
      }
    }
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const entry = await this.read<OAuthClientInformationFull>(PARTITION.client, clientId);
    return entry?.value;
  }

  async saveClient(client: OAuthClientInformationFull): Promise<void> {
    // Registrations do not expire: a client that registered months ago must
    // still be recognised, otherwise it silently loses access on restart.
    await this.put(PARTITION.client, client.client_id, client, 0);
  }

  async savePending(state: string, pending: PendingAuthorization): Promise<void> {
    await this.put(PARTITION.pending, state, pending, pending.createdAt + PENDING_TTL_MS);
  }

  async takePending(state: string): Promise<PendingAuthorization | undefined> {
    const entry = await this.read<PendingAuthorization>(PARTITION.pending, state);
    if (!entry) return undefined;
    await this.remove(PARTITION.pending, state);
    return entry.expiresAt < Date.now() ? undefined : entry.value;
  }

  async saveCode(code: string, issued: IssuedCode): Promise<void> {
    await this.put(PARTITION.code, code, issued, issued.expiresAt);
  }

  async getCode(code: string): Promise<IssuedCode | undefined> {
    const entry = await this.read<IssuedCode>(PARTITION.code, code);
    if (!entry) return undefined;
    return entry.expiresAt < Date.now() ? undefined : entry.value;
  }

  async deleteCode(code: string): Promise<void> {
    await this.remove(PARTITION.code, code);
  }

  /**
   * Table Storage has no TTL, so expired pending authorizations and codes are
   * swept here. Both live minutes at most; client registrations are never
   * swept. Failures are logged and swallowed — eviction is housekeeping and
   * must never break an authorization in progress.
   */
  async evictExpired(): Promise<void> {
    await this.ensureTable();
    const now = Date.now();
    try {
      for (const partitionKey of [PARTITION.pending, PARTITION.code]) {
        const stale = this.client.listEntities<StateEntity>({
          queryOptions: { filter: odata`PartitionKey eq ${partitionKey} and expiresAt lt ${now}` },
        });
        for await (const entity of stale) {
          await this.client.deleteEntity(entity.partitionKey, entity.rowKey).catch(() => undefined);
        }
      }
    } catch (error: unknown) {
      logger.warn("OAuth state eviction failed", error instanceof Error ? error.message : String(error));
    }
  }
}

export { CODE_TTL_MS, PENDING_TTL_MS };
