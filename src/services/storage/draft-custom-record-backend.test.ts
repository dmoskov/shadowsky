import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAgent } from "../../tests/mocks/atproto";
import { ThreadDraft } from "../drafts";
import { DraftCustomRecordBackend } from "./draft-custom-record-backend";

describe("DraftCustomRecordBackend", () => {
  let backend: DraftCustomRecordBackend;
  let mockAgent: any;
  let errorCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    backend = new DraftCustomRecordBackend();
    mockAgent = createMockAgent();
    errorCallback = vi.fn();
  });

  describe("initialize", () => {
    it("should initialize with an agent", async () => {
      await backend.initialize(mockAgent);
      expect(() => backend.getAll()).not.toThrow();
    });

    it("should throw error if initialized without agent", async () => {
      await expect(backend.initialize()).rejects.toThrow(
        "Agent is required for custom record backend",
      );
    });

    it("should throw error if used before initialization", async () => {
      await expect(backend.getAll()).rejects.toThrow(
        "Draft custom record backend not initialized",
      );
    });
  });

  describe("setErrorCallback", () => {
    it("should set error callback", async () => {
      await backend.initialize(mockAgent);
      backend.setErrorCallback(errorCallback);

      // Force an error by making the API call fail
      mockAgent.api.com.atproto.repo.listRecords.mockRejectedValue(
        new Error("API Error"),
      );

      await backend.getAll();

      expect(errorCallback).toHaveBeenCalledWith(
        expect.any(Error),
        "fetch draft records",
      );
    });
  });

  describe("getAll", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should return empty array when no drafts exist", async () => {
      const drafts = await backend.getAll();
      expect(drafts).toEqual([]);
    });

    it("should return drafts sorted by updatedAt descending", async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-1",
          value: {
            $type: "com.shadowsky.draft",
            id: "draft-1",
            title: "Old Draft",
            content: "Old content",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-2",
          value: {
            $type: "com.shadowsky.draft",
            id: "draft-2",
            title: "New Draft",
            content: "New content",
            createdAt: "2024-01-02T00:00:00Z",
            updatedAt: "2024-01-02T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      const drafts = await backend.getAll();

      expect(drafts).toHaveLength(2);
      expect(drafts[0].id).toBe("draft-2"); // Newer draft first
      expect(drafts[1].id).toBe("draft-1");
    });

    it("should handle API errors gracefully", async () => {
      backend.setErrorCallback(errorCallback);
      mockAgent.api.com.atproto.repo.listRecords.mockRejectedValue(
        new Error("Network error"),
      );

      const drafts = await backend.getAll();

      expect(drafts).toEqual([]);
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network error" }),
        "fetch draft records",
      );
    });
  });

  describe("get", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should get a specific draft by id", async () => {
      const mockDraft = {
        $type: "com.shadowsky.draft",
        id: "draft-123",
        title: "Test Draft",
        content: "Test content",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      mockAgent.api.com.atproto.repo.getRecord.mockResolvedValue({
        data: {
          uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
          cid: "mock-cid",
          value: mockDraft,
        },
      });

      const draft = await backend.get("draft-123");

      expect(draft).toEqual({
        id: "draft-123",
        title: "Test Draft",
        content: "Test content",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      expect(mockAgent.api.com.atproto.repo.getRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-123",
      });
    });

    it("should return undefined when draft not found", async () => {
      mockAgent.api.com.atproto.repo.getRecord.mockRejectedValue(
        new Error("Record not found"),
      );

      const draft = await backend.get("non-existent");

      expect(draft).toBeUndefined();
    });
  });

  describe("create", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should create a new draft", async () => {
      const newDraft: ThreadDraft = {
        id: "draft-new",
        title: "New Draft",
        content: "New content",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      await backend.create(newDraft);

      expect(mockAgent.api.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-new",
        record: {
          $type: "com.shadowsky.draft",
          ...newDraft,
        },
      });
    });

    it("should handle creation errors", async () => {
      backend.setErrorCallback(errorCallback);
      mockAgent.api.com.atproto.repo.createRecord.mockRejectedValue(
        new Error("Creation failed"),
      );

      const newDraft: ThreadDraft = {
        id: "draft-new",
        title: "New Draft",
        content: "New content",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      await expect(backend.create(newDraft)).rejects.toThrow("Creation failed");
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Creation failed" }),
        "create draft record",
      );
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should update an existing draft", async () => {
      const updatedDraft: ThreadDraft = {
        id: "draft-123",
        title: "Updated Draft",
        content: "Updated content",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      await backend.update("draft-123", updatedDraft);

      expect(mockAgent.api.com.atproto.repo.putRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-123",
        record: {
          $type: "com.shadowsky.draft",
          ...updatedDraft,
        },
      });
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should delete a draft", async () => {
      await backend.delete("draft-123");

      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-123",
      });
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      await backend.initialize(mockAgent);
    });

    it("should delete all drafts", async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-1",
          value: {
            $type: "com.shadowsky.draft",
            id: "draft-1",
            title: "Draft 1",
            content: "Content 1",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-2",
          value: {
            $type: "com.shadowsky.draft",
            id: "draft-2",
            title: "Draft 2",
            content: "Content 2",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.clear();

      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledTimes(
        2,
      );
      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-1",
      });
      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.draft",
        rkey: "draft-draft-2",
      });
    });
  });
});
