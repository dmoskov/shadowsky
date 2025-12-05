/**
 * Tests for Abstract Storage Interface
 *
 * Uses fake-indexeddb for testing Dexie/IndexedDB operations in Node.js.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEncryptedStorage,
  createStorageProvider,
  detectPlatform,
  getStorageProvider,
  WebStorageAdapter,
  type StorageEntity,
} from "./index";

// Test entity type
interface TestEntity extends StorageEntity {
  name: string;
  value: number;
  tags?: string[];
}

describe("StorageProvider", () => {
  describe("detectPlatform", () => {
    it("should detect web platform", () => {
      const platform = detectPlatform();
      expect(platform).toBe("web");
    });
  });

  describe("getStorageProvider", () => {
    it("should return WebStorageAdapter for web platform", async () => {
      const provider = await getStorageProvider({ platform: "web" });
      expect(provider).toBeInstanceOf(WebStorageAdapter);
    });

    it("should wrap with encryption when requested", async () => {
      const provider = await getStorageProvider({
        platform: "web",
        encryption: true,
      });
      expect(provider.getMetadata().name).toContain("Encrypted");
    });
  });
});

describe("WebStorageAdapter", () => {
  let adapter: WebStorageAdapter;

  beforeEach(async () => {
    adapter = new WebStorageAdapter();
    await adapter.initialize();
    // Clear all stores to ensure clean state between tests
    try {
      await adapter.clear("columns");
    } catch {
      // Store might not exist
    }
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("lifecycle", () => {
    it("should initialize successfully", async () => {
      expect(adapter.getMetadata().name).toBe("WebStorageAdapter");
    });

    it("should report as available", async () => {
      const available = await adapter.isAvailable();
      expect(available).toBe(true);
    });

    it("should report ready health status", async () => {
      const health = await adapter.getHealth();
      expect(health.status).toBe("ready");
    });

    it("should return correct metadata", () => {
      const meta = adapter.getMetadata();
      expect(meta.platform).toBe("web");
      expect(meta.features.indexing).toBe(true);
      expect(meta.features.transactions).toBe(true);
    });
  });

  describe("CRUD operations", () => {
    const testEntity: TestEntity = {
      id: "test-1",
      name: "Test Entity",
      value: 42,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("should put and get an entity", async () => {
      await adapter.put("columns", testEntity);
      const retrieved = await adapter.get<TestEntity>("columns", "test-1");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("test-1");
      expect(retrieved?.name).toBe("Test Entity");
      expect(retrieved?.value).toBe(42);
    });

    it("should return null for non-existent entity", async () => {
      const result = await adapter.get("columns", "non-existent");
      expect(result).toBeNull();
    });

    it("should check if entity exists", async () => {
      await adapter.put("columns", testEntity);

      expect(await adapter.exists("columns", "test-1")).toBe(true);
      expect(await adapter.exists("columns", "non-existent")).toBe(false);
    });

    it("should delete an entity", async () => {
      await adapter.put("columns", testEntity);
      expect(await adapter.exists("columns", "test-1")).toBe(true);

      await adapter.delete("columns", "test-1");
      expect(await adapter.exists("columns", "test-1")).toBe(false);
    });

    it("should update an entity", async () => {
      await adapter.put("columns", testEntity);
      await adapter.put("columns", { ...testEntity, value: 100 });

      const retrieved = await adapter.get<TestEntity>("columns", "test-1");
      expect(retrieved?.value).toBe(100);
    });

    it("should clear a store", async () => {
      await adapter.put("columns", testEntity);
      await adapter.put("columns", { ...testEntity, id: "test-2" });

      await adapter.clear("columns");

      expect(await adapter.count("columns")).toBe(0);
    });
  });

  describe("batch operations", () => {
    it("should put multiple entities", async () => {
      const entities: TestEntity[] = [
        {
          id: "batch-1",
          name: "One",
          value: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "batch-2",
          name: "Two",
          value: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "batch-3",
          name: "Three",
          value: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = await adapter.putMany("columns", entities);
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);

      const count = await adapter.count("columns");
      expect(count).toBe(3);
    });

    it("should get multiple entities by ids", async () => {
      const entities: TestEntity[] = [
        {
          id: "get-many-1",
          name: "One",
          value: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "get-many-2",
          name: "Two",
          value: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await adapter.putMany("columns", entities);

      const retrieved = await adapter.getMany<TestEntity>("columns", [
        "get-many-1",
        "get-many-2",
        "non-existent",
      ]);

      expect(retrieved.length).toBe(2);
    });

    it("should delete multiple entities", async () => {
      const entities: TestEntity[] = [
        {
          id: "del-1",
          name: "One",
          value: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "del-2",
          name: "Two",
          value: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await adapter.putMany("columns", entities);
      await adapter.deleteMany("columns", ["del-1", "del-2"]);

      expect(await adapter.count("columns")).toBe(0);
    });
  });

  describe("querying", () => {
    beforeEach(async () => {
      const entities: TestEntity[] = [
        {
          id: "q-1",
          name: "Alpha",
          value: 10,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "q-2",
          name: "Beta",
          value: 20,
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "q-3",
          name: "Gamma",
          value: 30,
          createdAt: "2024-01-03T00:00:00Z",
          updatedAt: "2024-01-03T00:00:00Z",
        },
      ];
      await adapter.putMany("columns", entities);
    });

    it("should query all entities", async () => {
      const result = await adapter.query<TestEntity>("columns", {});
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("should query with limit", async () => {
      const result = await adapter.query<TestEntity>("columns", { limit: 2 });
      expect(result.items.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it("should query with offset", async () => {
      const result = await adapter.query<TestEntity>("columns", {
        offset: 1,
        limit: 10,
      });
      expect(result.items.length).toBe(2);
    });

    it("should find one entity", async () => {
      const result = await adapter.findOne<TestEntity>("columns", {
        filters: [{ field: "name", operator: "eq", value: "Beta" }],
      });
      expect(result?.id).toBe("q-2");
    });

    it("should return null when findOne has no matches", async () => {
      const result = await adapter.findOne<TestEntity>("columns", {
        filters: [{ field: "name", operator: "eq", value: "NonExistent" }],
      });
      expect(result).toBeNull();
    });
  });

  describe("events", () => {
    it("should emit created event", async () => {
      const listener = vi.fn();
      adapter.subscribe("columns", listener);

      await adapter.put("columns", {
        id: "event-1",
        name: "Test",
        value: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "created",
          store: "columns",
          entityId: "event-1",
        }),
      );
    });

    it("should emit updated event", async () => {
      const entity = {
        id: "event-2",
        name: "Test",
        value: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adapter.put("columns", entity);

      const listener = vi.fn();
      adapter.subscribe("columns", listener);

      await adapter.put("columns", { ...entity, value: 2 });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          store: "columns",
          entityId: "event-2",
        }),
      );
    });

    it("should unsubscribe from events", async () => {
      const listener = vi.fn();
      const unsubscribe = adapter.subscribe("columns", listener);

      unsubscribe();

      await adapter.put("columns", {
        id: "event-3",
        name: "Test",
        value: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("import/export", () => {
    it("should export and import data", async () => {
      const entities: TestEntity[] = [
        {
          id: "export-1",
          name: "One",
          value: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "export-2",
          name: "Two",
          value: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await adapter.putMany("columns", entities);

      const exported = await adapter.exportData();
      expect(exported.columns?.length).toBe(2);

      // Clear and reimport
      await adapter.clear("columns");
      expect(await adapter.count("columns")).toBe(0);

      await adapter.importData(exported);
      expect(await adapter.count("columns")).toBe(2);
    });
  });
});

describe("EncryptedStorageWrapper", () => {
  let adapter: WebStorageAdapter;

  beforeEach(async () => {
    adapter = new WebStorageAdapter();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("should wrap storage provider", async () => {
    const encrypted = createEncryptedStorage(adapter, {
      enabled: true,
      encryptedStores: ["credentials"],
    });

    await encrypted.initialize();

    const meta = encrypted.getMetadata();
    expect(meta.name).toContain("Encrypted");
    expect(meta.features.encryption).toBe(true);

    await encrypted.close();
  });

  it("should encrypt and decrypt data", async () => {
    const encrypted = createEncryptedStorage(adapter, {
      enabled: true,
      encryptedStores: ["columns"],
    });

    await encrypted.initialize();

    const entity: TestEntity = {
      id: "encrypted-1",
      name: "Secret",
      value: 42,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await encrypted.put("columns", entity);
    const retrieved = await encrypted.get<TestEntity>("columns", "encrypted-1");

    expect(retrieved?.name).toBe("Secret");
    expect(retrieved?.value).toBe(42);

    await encrypted.close();
  });

  it("should report encryption status", async () => {
    const encrypted = createEncryptedStorage(adapter, {
      enabled: true,
      encryptedStores: ["credentials"],
    });

    await encrypted.initialize();

    expect(encrypted.isEncryptionEnabled()).toBe(true);
    expect(encrypted.getEncryptedStores()).toContain("credentials");

    await encrypted.close();
  });
});

describe("createStorageProvider", () => {
  it("should create and initialize provider", async () => {
    const provider = await createStorageProvider({ platform: "web" });

    const health = await provider.getHealth();
    expect(health.status).toBe("ready");

    await provider.close();
  });
});
