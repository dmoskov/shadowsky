import { AtpAgent } from "@atproto/api";
import { ColumnStorageBackend } from "./column-storage-backend";
import { LOCAL_STORAGE_KEYS } from "./storage-constants";
import { Column, StoredColumn } from "./types";

export class ColumnLocalStorageBackend implements ColumnStorageBackend {
  setAgent(_agent: AtpAgent | null): void {
    // Local storage doesn't need agent
  }

  async saveColumns(columns: Column[]): Promise<void> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMNS, JSON.stringify(columns));
      // Also update the legacy key to maintain compatibility with SkyDeck
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.COLUMNS_LEGACY,
        JSON.stringify(columns),
      );
    } catch (error) {
      console.error("Failed to save columns to localStorage:", error);
      throw error;
    }
  }

  async loadColumns(): Promise<Column[]> {
    try {
      // Check if we've already migrated
      const migrated = localStorage.getItem(
        LOCAL_STORAGE_KEYS.COLUMNS_MIGRATED,
      );

      // First try to load from new key
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMNS);

      // If no data in new key and haven't migrated yet, check legacy key
      if (!data && !migrated) {
        const legacyData = localStorage.getItem(
          LOCAL_STORAGE_KEYS.COLUMNS_LEGACY,
        );
        if (legacyData) {
          // Parse and validate legacy data
          try {
            const legacyColumns = JSON.parse(legacyData);
            if (Array.isArray(legacyColumns) && legacyColumns.length > 0) {
              // Save to new key
              await this.saveColumns(legacyColumns);
              // Mark as migrated
              localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMNS_MIGRATED, "true");
              return legacyColumns;
            }
          } catch (e) {
            console.error("Failed to parse legacy columns:", e);
          }
        }
      }

      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load columns from localStorage:", error);
      return [];
    }
  }

  async addColumn(column: Column): Promise<void> {
    const columns = await this.loadColumns();
    const exists = columns.some((c) => c.id === column.id);

    if (!exists) {
      columns.push(column);
      await this.saveColumns(columns);
    }
  }

  async updateColumn(
    columnId: string,
    updates: Partial<Column>,
  ): Promise<void> {
    const columns = await this.loadColumns();
    const index = columns.findIndex((c) => c.id === columnId);

    if (index !== -1) {
      columns[index] = {
        ...columns[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      } as StoredColumn;
      await this.saveColumns(columns);
    }
  }

  async deleteColumn(columnId: string): Promise<void> {
    const columns = await this.loadColumns();
    const filtered = columns.filter((c) => c.id !== columnId);

    if (filtered.length !== columns.length) {
      await this.saveColumns(filtered);
    }
  }

  async migrateFrom(sourceBackend: ColumnStorageBackend): Promise<void> {
    const columns = await sourceBackend.loadColumns();
    await this.saveColumns(columns);
  }
}
