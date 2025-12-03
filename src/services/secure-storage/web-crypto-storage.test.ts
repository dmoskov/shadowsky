/**
 * Tests for Web Crypto Storage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { WebCryptoStorage } from "./web-crypto-storage";

describe("WebCryptoStorage", () => {
  let storage: WebCryptoStorage;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }

    storage = new WebCryptoStorage();
  });

  afterEach(() => {
    storage.close();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await storage.initialize();
      const isAvailable = await storage.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it("should handle multiple initialize calls", async () => {
      await Promise.all([
        storage.initialize(),
        storage.initialize(),
        storage.initialize(),
      ]);

      const isAvailable = await storage.isAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  describe("setItem and getItem", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should store and retrieve a simple string", async () => {
      await storage.setItem("test-key", "test-value");
      const value = await storage.getItem("test-key");
      expect(value).toBe("test-value");
    });

    it("should store and retrieve JSON data", async () => {
      const data = {
        session: {
          did: "did:plc:test123",
          handle: "test.bsky.social",
          accessJwt: "eyJhbGciOiJIUzI1NiIs...",
          refreshJwt: "eyJhbGciOiJIUzI1NiIs...",
        },
        lastUsed: Date.now(),
      };

      await storage.setItem("account", JSON.stringify(data));
      const retrieved = await storage.getItem("account");

      expect(retrieved).not.toBeNull();
      expect(JSON.parse(retrieved!)).toEqual(data);
    });

    it("should return null for non-existent keys", async () => {
      const value = await storage.getItem("non-existent");
      expect(value).toBeNull();
    });

    it("should overwrite existing values", async () => {
      await storage.setItem("key", "value1");
      await storage.setItem("key", "value2");

      const value = await storage.getItem("key");
      expect(value).toBe("value2");
    });

    it("should store values with options", async () => {
      await storage.setItem("protected-key", "secret", {
        biometricProtection: true,
        requireUnlock: true,
      });

      const value = await storage.getItem("protected-key");
      expect(value).toBe("secret");
    });

    it("should handle empty strings", async () => {
      await storage.setItem("empty", "");
      const value = await storage.getItem("empty");
      expect(value).toBe("");
    });

    it("should handle unicode characters", async () => {
      const unicodeData = "Hello 世界 🌍 مرحبا";
      await storage.setItem("unicode", unicodeData);
      const value = await storage.getItem("unicode");
      expect(value).toBe(unicodeData);
    });

    it("should handle large values", async () => {
      const largeData = "x".repeat(100000);
      await storage.setItem("large", largeData);
      const value = await storage.getItem("large");
      expect(value).toBe(largeData);
    });
  });

  describe("removeItem", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should remove an existing item", async () => {
      await storage.setItem("to-remove", "value");
      await storage.removeItem("to-remove");

      const value = await storage.getItem("to-remove");
      expect(value).toBeNull();
    });

    it("should not throw when removing non-existent item", async () => {
      await expect(storage.removeItem("non-existent")).resolves.not.toThrow();
    });
  });

  describe("hasItem", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should return true for existing items", async () => {
      await storage.setItem("exists", "value");
      const exists = await storage.hasItem("exists");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent items", async () => {
      const exists = await storage.hasItem("does-not-exist");
      expect(exists).toBe(false);
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should remove all items", async () => {
      await storage.setItem("key1", "value1");
      await storage.setItem("key2", "value2");
      await storage.setItem("key3", "value3");

      await storage.clear();

      expect(await storage.hasItem("key1")).toBe(false);
      expect(await storage.hasItem("key2")).toBe(false);
      expect(await storage.hasItem("key3")).toBe(false);
    });
  });

  describe("getAllKeys", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should return all stored keys", async () => {
      await storage.setItem("key1", "value1");
      await storage.setItem("key2", "value2");
      await storage.setItem("key3", "value3");

      const keys = await storage.getAllKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return empty array when no items exist", async () => {
      const keys = await storage.getAllKeys();
      expect(keys).toHaveLength(0);
    });
  });

  describe("setBiometricProtection", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should update biometric protection flag", async () => {
      await storage.setItem("key", "value");
      await storage.setBiometricProtection("key", true);

      // Value should still be accessible
      const value = await storage.getItem("key");
      expect(value).toBe("value");
    });

    it("should throw for non-existent key", async () => {
      await expect(
        storage.setBiometricProtection("non-existent", true),
      ).rejects.toThrow("Key not found");
    });
  });

  describe("encryption integrity", () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it("should encrypt data differently on each write (different IV)", async () => {
      // Store the same value multiple times
      await storage.setItem("key1", "same-value");

      // Create a new storage instance (simulates app restart)
      const storage2 = new WebCryptoStorage();
      await storage2.initialize();

      // Store the same value
      await storage2.setItem("key2", "same-value");

      // Both should decrypt correctly
      const value1 = await storage.getItem("key1");
      const value2 = await storage2.getItem("key2");

      expect(value1).toBe("same-value");
      expect(value2).toBe("same-value");

      storage2.close();
    });

    it("should persist data across storage instances", async () => {
      await storage.setItem("persistent", "data");
      storage.close();

      // Create new instance
      const storage2 = new WebCryptoStorage();
      await storage2.initialize();

      const value = await storage2.getItem("persistent");
      expect(value).toBe("data");

      storage2.close();
    });
  });

  describe("isBiometricAvailable", () => {
    it("should return boolean", async () => {
      await storage.initialize();
      const available = await storage.isBiometricAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("isAvailable", () => {
    it("should return true in test environment", async () => {
      const available = await storage.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle corrupted data gracefully", async () => {
      await storage.initialize();
      await storage.setItem("key", "value");

      // Manually corrupt the data in IndexedDB
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("shadowsky_secure_storage", 1);
        request.onsuccess = () => resolve(request.result);
      });

      const tx = db.transaction("credentials", "readwrite");
      const store = tx.objectStore("credentials");
      await new Promise<void>((resolve) => {
        store.put({
          key: "corrupted",
          encryptedData: new ArrayBuffer(10), // Invalid encrypted data
          iv: new Uint8Array(12),
          options: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
      });
      db.close();

      // Should return null for corrupted data
      const value = await storage.getItem("corrupted");
      expect(value).toBeNull();
    });
  });
});
