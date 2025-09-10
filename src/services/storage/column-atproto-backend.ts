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

    const columnData = columns.map((col: any) => {
      const storedCol = col as StoredColumn;

      const columnItem: any = {
        id: col.id,
        type: col.type as string, // Convert to string for storage
        title: col.title,
        data: col.data,
        createdAt: storedCol.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // For feed columns, get the selectedFeedUri from cookies
      if (col.type === "feed") {
        const selectedFeedUri =
          col.selectedFeedUri || columnFeedPrefs.getFeedForColumn(col.id);
        columnItem.selectedFeedUri = selectedFeedUri || undefined;
      } else {
        // For non-feed columns, include undefined selectedFeedUri
        columnItem.selectedFeedUri = undefined;
      }

      return columnItem;
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

    // Restore feed preferences from selectedFeedUri
    for (const col of columnsData.columns) {
      if (col.type === "feed" && col.selectedFeedUri) {
        columnFeedPrefs.setFeedForColumn(col.id, col.selectedFeedUri);
      }
    }

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
    // Always update the cookie regardless of column existence or type
    columnFeedPrefs.setFeedForColumn(columnId, feedUri);

    // Update the column's data field if it exists and is a feed column
    const columns = await this.loadColumns();
    const columnIndex = columns.findIndex((c) => c.id === columnId);

    if (columnIndex !== -1 && columns[columnIndex].type === "feed") {
      columns[columnIndex].data = feedUri;
      await this.saveColumns(columns);
    }
  }
}
