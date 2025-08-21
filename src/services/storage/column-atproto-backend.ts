import { BskyAgent } from "@atproto/api";
import { columnFeedPrefs } from "../../utils/cookies";
import { appPreferencesService } from "../app-preferences-service";
import { ColumnStorageBackend } from "./column-storage-backend";
import { Column, StoredColumn } from "./types";

export class ColumnAtProtoBackend implements ColumnStorageBackend {
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null): void {
    this.agent = agent;
    appPreferencesService.setAgent(agent);
  }

  async saveColumns(columns: Column[]): Promise<void> {
    if (!this.agent) {
      throw new Error("Agent not set");
    }

    const columnData = columns.map((col) => {
      const storedCol = col as StoredColumn;
      // Get feed preference from cookies for feed-type columns
      const selectedFeedUri =
        col.type === "feed"
          ? columnFeedPrefs.getFeedForColumn(col.id) || undefined
          : undefined;

      return {
        id: col.id,
        type: col.type as string, // Convert to string for storage
        title: col.title,
        data: col.data,
        createdAt: storedCol.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        selectedFeedUri,
      };
    });

    const success = await appPreferencesService.updateColumns(columnData);
    if (!success) {
      throw new Error("Failed to save columns to AT Protocol preferences");
    }
  }

  async loadColumns(): Promise<Column[]> {
    if (!this.agent) {
      throw new Error("Agent not set");
    }

    const columnsData = await appPreferencesService.getColumns();
    if (!columnsData || !columnsData.columns) {
      return [];
    }

    // Restore feed preferences from AT Protocol to cookies
    columnsData.columns.forEach((col) => {
      if (col.type === "feed" && col.selectedFeedUri) {
        columnFeedPrefs.setFeedForColumn(col.id, col.selectedFeedUri);
      }
    });

    return columnsData.columns.map((col) => ({
      id: col.id,
      type: col.type as Column["type"], // Convert from string to ColumnType
      title: col.title,
      data: col.data,
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    }));
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

  async updateColumnFeedPreference(
    columnId: string,
    feedUri: string,
  ): Promise<void> {
    // First update the cookie (for immediate UI response)
    columnFeedPrefs.setFeedForColumn(columnId, feedUri);

    // Then update AT Protocol storage
    const columns = await this.loadColumns();
    const column = columns.find((c) => c.id === columnId);

    if (column && column.type === "feed") {
      // Re-save all columns to include the updated feed preference
      await this.saveColumns(columns);
    }
  }
}
