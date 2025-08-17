import { AtpAgent } from "@atproto/api";
import { ColumnStorageBackend } from "./column-storage-backend";
import { Column, StoredColumn } from "./types";

const STORAGE_KEY = "shadowsky_columns";

export class ColumnLocalStorageBackend implements ColumnStorageBackend {
  setAgent(_agent: AtpAgent | null): void {
    // Local storage doesn't need agent
  }

  async saveColumns(columns: Column[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch (error) {
      console.error("Failed to save columns to localStorage:", error);
      throw error;
    }
  }

  async loadColumns(): Promise<Column[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
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
