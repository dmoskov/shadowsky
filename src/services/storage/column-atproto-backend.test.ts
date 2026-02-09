import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
} from "vitest";
import { createMockAgent } from "../../tests/mocks/atproto";
import type { ColumnType } from "../../types/column";
import type { AppPreferencesService } from "../app-preferences-service";
import { ColumnAtProtoBackend } from "./column-atproto-backend";
import type { ColumnStorageBackend } from "./column-storage-backend";
import type { Column } from "./types";

// Mock the app preferences service
vi.mock("../app-preferences-service", () => ({
  appPreferencesService: {
    setAgent: vi.fn(),
    updateColumns: vi.fn().mockResolvedValue(true),
    getColumns: vi.fn().mockResolvedValue(null),
  },
}));

describe("ColumnAtProtoBackend", () => {
  let backend: ColumnAtProtoBackend;
  let mockAgent: ReturnType<typeof createMockAgent>;
  let mockAppPreferencesService: Mocked<AppPreferencesService>;

  const createMockColumn = (id: string, type: ColumnType = "feed"): Column => ({
    id,
    type,
    title: `Column ${id}`,
    data: type === "feed" ? "at://feed/123" : undefined,
  });

  beforeEach(async () => {
    backend = new ColumnAtProtoBackend();
    mockAgent = createMockAgent();
    mockAppPreferencesService = vi.mocked(
      (await import("../app-preferences-service")).appPreferencesService,
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("setAgent", () => {
    it("should set the agent and update app preferences service", () => {
      backend.setAgent(mockAgent);
      expect(mockAppPreferencesService.setAgent).toHaveBeenCalledWith(
        mockAgent,
      );
    });
  });

  describe("saveColumns", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should throw error if agent not set", async () => {
      const backendWithoutAgent = new ColumnAtProtoBackend();
      await expect(backendWithoutAgent.saveColumns([])).rejects.toThrow(
        "Agent not set",
      );
    });

    it("should save columns with feed preferences", async () => {
      const columns: Column[] = [
        createMockColumn("col1", "feed"),
        createMockColumn("col2", "notifications"),
        createMockColumn("col3", "feed"),
      ];

      await backend.saveColumns(columns);

      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "col1",
            type: "feed",
            title: "Column col1",
            data: "at://feed/123",
            selectedFeedUri: "at://feed/123",
          }),
          expect.objectContaining({
            id: "col2",
            type: "notifications",
            title: "Column col2",
            data: undefined,
            selectedFeedUri: undefined,
          }),
          expect.objectContaining({
            id: "col3",
            type: "feed",
            title: "Column col3",
            data: "at://feed/123",
            selectedFeedUri: "at://feed/123",
          }),
        ]),
      );
    });

    it("should throw error if save fails", async () => {
      mockAppPreferencesService.updateColumns.mockResolvedValueOnce(false);

      await expect(backend.saveColumns([])).rejects.toThrow(
        "Failed to save columns to AT Protocol preferences",
      );
    });
  });

  describe("loadColumns", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should throw error if agent not set", async () => {
      const backendWithoutAgent = new ColumnAtProtoBackend();
      await expect(backendWithoutAgent.loadColumns()).rejects.toThrow(
        "Agent not set",
      );
    });

    it("should return empty array if no columns stored", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce(null);

      const columns = await backend.loadColumns();

      expect(columns).toEqual([]);
    });

    it("should load columns and restore feed preferences", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "feed",
            title: "Feed Column",
            data: "at://feed/123",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
            selectedFeedUri: "at://feed/selected1",
          },
          {
            id: "col2",
            type: "notifications",
            title: "Notifications",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      const columns = await backend.loadColumns();

      expect(columns).toHaveLength(2);
      expect(columns[0]).toEqual({
        id: "col1",
        type: "feed",
        title: "Feed Column",
        data: "at://feed/selected1", // Uses selectedFeedUri when available for feed columns
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Feed preferences are now stored in the column data itself
    });
  });

  describe("addColumn", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should add a new column if it doesn't exist", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "existing",
            type: "feed",
            title: "Existing",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      const newColumn = createMockColumn("new", "timeline");
      await backend.addColumn(newColumn);

      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "existing" }),
          expect.objectContaining({ id: "new", type: "timeline" }),
        ]),
      );
    });

    it("should not add duplicate columns", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "existing",
            type: "feed",
            title: "Existing",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      const duplicateColumn = createMockColumn("existing", "feed");
      await backend.addColumn(duplicateColumn);

      expect(mockAppPreferencesService.updateColumns).not.toHaveBeenCalled();
    });
  });

  describe("updateColumn", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should update an existing column", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "feed",
            title: "Old Title",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      await backend.updateColumn("col1", { title: "New Title" });

      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "col1",
          type: "feed",
          title: "New Title",
          updatedAt: expect.any(String),
        }),
      ]);
    });

    it("should not update non-existent column", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [],
        version: 1,
      });

      await backend.updateColumn("nonexistent", { title: "New Title" });

      expect(mockAppPreferencesService.updateColumns).not.toHaveBeenCalled();
    });
  });

  describe("deleteColumn", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should delete an existing column", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "feed",
            title: "Column 1",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            id: "col2",
            type: "notifications",
            title: "Column 2",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      await backend.deleteColumn("col1");

      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith([
        expect.objectContaining({ id: "col2" }),
      ]);
      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith(
        expect.not.arrayContaining([expect.objectContaining({ id: "col1" })]),
      );
    });

    it("should not call update if column doesn't exist", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "feed",
            title: "Column 1",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      await backend.deleteColumn("nonexistent");

      expect(mockAppPreferencesService.updateColumns).not.toHaveBeenCalled();
    });
  });

  describe("updateColumnFeedPreference", () => {
    beforeEach(() => {
      backend.setAgent(mockAgent);
    });

    it("should update feed preference for feed column", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "feed",
            title: "Feed Column",
            data: "at://feed/123",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      await backend.updateColumnFeedPreference("col1", "at://feed/new");

      // Should save to AT Protocol
      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalled();
    });

    it("should not save if column is not a feed type", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [
          {
            id: "col1",
            type: "notifications",
            title: "Notifications",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        version: 1,
      });

      await backend.updateColumnFeedPreference("col1", "at://feed/new");

      // Should not save to AT Protocol since it's not a feed column
      expect(mockAppPreferencesService.updateColumns).not.toHaveBeenCalled();
    });

    it("should not save if column doesn't exist", async () => {
      mockAppPreferencesService.getColumns.mockResolvedValueOnce({
        $type: "com.shadowsky.columns",
        columns: [],
        version: 1,
      });

      await backend.updateColumnFeedPreference("nonexistent", "at://feed/new");

      // Should not save to AT Protocol since column doesn't exist
      expect(mockAppPreferencesService.updateColumns).not.toHaveBeenCalled();
    });
  });

  describe("migrateFrom", () => {
    it("should migrate columns from another backend", async () => {
      backend.setAgent(mockAgent);

      const sourceBackend = {
        loadColumns: vi
          .fn()
          .mockResolvedValue([
            createMockColumn("col1", "feed"),
            createMockColumn("col2", "notifications"),
          ]),
      } as unknown as ColumnStorageBackend;

      await backend.migrateFrom(sourceBackend);

      expect(sourceBackend.loadColumns).toHaveBeenCalled();
      expect(mockAppPreferencesService.updateColumns).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "col1" }),
          expect.objectContaining({ id: "col2" }),
        ]),
      );
    });
  });
});
