// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, jest, beforeEach } from "@jest/globals";

jest.mock("../../../src/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// @azure/data-tables resolves to its TypeScript sources under Jest, which drags
// in the whole Azure core stack. The store is exercised against a fake table
// client injected below, so a stub of the surface it constructs is enough.
jest.mock("@azure/data-tables", () => ({
  TableClient: class {
    readonly stub = true;
  },
  odata: (strings: TemplateStringsArray, ...values: unknown[]) => strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ""), ""),
}));

import { CODE_TTL_MS, InMemoryOAuthStateStore, PENDING_TTL_MS } from "../../../src/shared/oauth/state-store";
import { TableOAuthStateStore } from "../../../src/shared/oauth/table-state-store";

const client = { client_id: "c1", redirect_uris: ["https://client.example/cb"] } as never;
const pending = { clientId: "c1", redirectUri: "https://client.example/cb", codeChallenge: "chal", createdAt: Date.now() };
const issued = { tokens: { access_token: "a", token_type: "Bearer" as const }, codeChallenge: "chal", clientId: "c1", expiresAt: Date.now() + CODE_TTL_MS };

describe("InMemoryOAuthStateStore", () => {
  let store: InMemoryOAuthStateStore;

  beforeEach(() => {
    store = new InMemoryOAuthStateStore();
  });

  it("round-trips a client registration", async () => {
    await store.saveClient(client);
    await expect(store.getClient("c1")).resolves.toEqual(client);
    await expect(store.getClient("other")).resolves.toBeUndefined();
  });

  it("consumes a pending authorization exactly once", async () => {
    await store.savePending("state-1", pending);

    await expect(store.takePending("state-1")).resolves.toEqual(pending);
    await expect(store.takePending("state-1")).resolves.toBeUndefined();
  });

  it("ignores a pending authorization past its TTL", async () => {
    await store.savePending("old", { ...pending, createdAt: Date.now() - PENDING_TTL_MS - 1 });

    await expect(store.takePending("old")).resolves.toBeUndefined();
  });

  it("keeps a code readable until it is deleted", async () => {
    await store.saveCode("code-1", issued);

    await expect(store.getCode("code-1")).resolves.toEqual(issued);
    await store.deleteCode("code-1");
    await expect(store.getCode("code-1")).resolves.toBeUndefined();
  });

  it("does not return an expired code", async () => {
    await store.saveCode("stale", { ...issued, expiresAt: Date.now() - 1 });

    await expect(store.getCode("stale")).resolves.toBeUndefined();
  });

  it("evicts expired pending authorizations and codes, keeping clients", async () => {
    await store.saveClient(client);
    await store.savePending("old", { ...pending, createdAt: Date.now() - PENDING_TTL_MS - 1 });
    await store.saveCode("stale", { ...issued, expiresAt: Date.now() - 1 });
    await store.saveCode("fresh", issued);

    await store.evictExpired();

    await expect(store.getClient("c1")).resolves.toEqual(client);
    await expect(store.getCode("fresh")).resolves.toEqual(issued);
    await expect(store.takePending("old")).resolves.toBeUndefined();
  });
});

describe("TableOAuthStateStore", () => {
  interface FakeTable {
    createTable: jest.Mock;
    upsertEntity: jest.Mock;
    getEntity: jest.Mock;
    deleteEntity: jest.Mock;
    listEntities: jest.Mock;
  }

  let table: FakeTable;
  let store: TableOAuthStateStore;

  function notFound() {
    return Object.assign(new Error("not found"), { statusCode: 404 });
  }

  beforeEach(() => {
    table = {
      createTable: jest.fn(async () => undefined),
      upsertEntity: jest.fn(async () => undefined),
      getEntity: jest.fn(),
      deleteEntity: jest.fn(async () => undefined),
      listEntities: jest.fn(() => ({
        async *[Symbol.asyncIterator]() {
          return;
        },
      })),
    };
    store = new TableOAuthStateStore("https://acct.table.core.windows.net", "oauthstate", {} as never);
    (store as unknown as { client: FakeTable }).client = table;
  });

  it("stores a client registration without an expiry", async () => {
    await store.saveClient(client);

    const entity = table.upsertEntity.mock.calls[0][0] as { partitionKey: string; rowKey: string; payload: string; expiresAt: number };
    expect(entity.partitionKey).toBe("client");
    expect(entity.rowKey).toBe("c1");
    expect(JSON.parse(entity.payload)).toEqual(client);
    expect(entity.expiresAt).toBe(0);
  });

  it("creates the table once and reuses the result", async () => {
    await store.saveClient(client);
    await store.saveClient(client);

    expect(table.createTable).toHaveBeenCalledTimes(1);
  });

  it("survives a table that already exists", async () => {
    table.createTable.mockRejectedValue(new Error("TableAlreadyExists"));

    await expect(store.saveClient(client)).resolves.toBeUndefined();
    expect(table.upsertEntity).toHaveBeenCalled();
  });

  it("returns undefined for a missing entity instead of throwing", async () => {
    table.getEntity.mockRejectedValue(notFound());

    await expect(store.getClient("nope")).resolves.toBeUndefined();
  });

  it("propagates a non-404 read failure", async () => {
    table.getEntity.mockRejectedValue(Object.assign(new Error("forbidden"), { statusCode: 403 }));

    await expect(store.getClient("c1")).rejects.toThrow("forbidden");
  });

  it("deletes a pending authorization as it is taken", async () => {
    table.getEntity.mockResolvedValue({ partitionKey: "pending", rowKey: "s1", payload: JSON.stringify(pending), expiresAt: Date.now() + PENDING_TTL_MS });

    await expect(store.takePending("s1")).resolves.toEqual(pending);
    expect(table.deleteEntity).toHaveBeenCalledWith("pending", "s1");
  });

  it("treats an expired pending authorization as absent but still deletes it", async () => {
    table.getEntity.mockResolvedValue({ partitionKey: "pending", rowKey: "s1", payload: JSON.stringify(pending), expiresAt: Date.now() - 1 });

    await expect(store.takePending("s1")).resolves.toBeUndefined();
    expect(table.deleteEntity).toHaveBeenCalled();
  });

  it("does not return an expired code", async () => {
    table.getEntity.mockResolvedValue({ partitionKey: "code", rowKey: "c", payload: JSON.stringify(issued), expiresAt: Date.now() - 1 });

    await expect(store.getCode("c")).resolves.toBeUndefined();
  });

  it("ignores a 404 when deleting", async () => {
    table.deleteEntity.mockRejectedValue(notFound());

    await expect(store.deleteCode("gone")).resolves.toBeUndefined();
  });

  it("evicts only expired pending authorizations and codes", async () => {
    table.listEntities.mockImplementation(() => ({
      async *[Symbol.asyncIterator]() {
        yield { partitionKey: "code", rowKey: "stale" };
      },
    }));

    await store.evictExpired();

    // Once per swept partition: pending and code. Clients are never swept.
    expect(table.listEntities).toHaveBeenCalledTimes(2);
    expect(table.deleteEntity).toHaveBeenCalledWith("code", "stale");
  });

  it("never lets an eviction failure escape", async () => {
    table.listEntities.mockImplementation(() => {
      throw new Error("throttled");
    });

    await expect(store.evictExpired()).resolves.toBeUndefined();
  });
});
