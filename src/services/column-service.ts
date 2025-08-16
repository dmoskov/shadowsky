import { AtpAgent } from "@atproto/api";
import { Column } from "../components/SkyDeck";
import { ColumnCustomRecordBackend } from "./storage/column-custom-record-backend";
import { ColumnLocalStorageBackend } from "./storage/column-local-storage-backend";
import { ColumnStorageBackend } from "./storage/column-storage-backend";
import { StorageType } from "./storage/types";

export class ColumnService {
  private backend: ColumnStorageBackend;
  private storageType: StorageType = "local";
  private agent?: AtpAgent | null;

  constructor() {
    // Default to local storage
    this.backend = new ColumnLocalStorageBackend();
  }

  async initialize(agent: AtpAgent, storageType: StorageType) {
    this.agent = agent;
    this.storageType = storageType;

    // Initialize the appropriate backend
    if (storageType === "custom") {
      this.backend = new ColumnCustomRecordBackend();
    } else {
      this.backend = new ColumnLocalStorageBackend();
    }

    await this.backend.initialize(agent);
  }

  setAgent(agent: AtpAgent | null) {
    this.agent = agent || undefined;
  }

  getStorageType(): StorageType {
    return this.storageType;
  }

  async getColumns(): Promise<Column[]> {
    return this.backend.getAll();
  }

  async getColumn(id: string): Promise<Column | undefined> {
    return this.backend.get(id);
  }

  async createColumn(column: Column): Promise<void> {
    return this.backend.create(column);
  }

  async updateColumn(id: string, column: Column): Promise<void> {
    return this.backend.update(id, column);
  }

  async deleteColumn(id: string): Promise<void> {
    return this.backend.delete(id);
  }

  async getColumnCount(): Promise<number> {
    const columns = await this.backend.getAll();
    return columns.length;
  }

  async exportAllColumns(): Promise<Column[]> {
    return this.backend.export();
  }

  async importColumns(columns: Column[]): Promise<number> {
    await this.backend.import(columns);
    return columns.length;
  }

  async migrateStorage(
    fromType: StorageType,
    toType: StorageType,
  ): Promise<void> {
    if (fromType === toType) return;

    // Export from current backend
    const columns = await this.backend.export();

    // Initialize new backend
    const newBackend =
      toType === "custom"
        ? new ColumnCustomRecordBackend()
        : new ColumnLocalStorageBackend();

    await newBackend.initialize(this.agent || undefined);

    // Import to new backend
    await newBackend.import(columns);

    // Switch to new backend
    this.backend = newBackend;
    this.storageType = toType;
  }

  async clearAllColumns(): Promise<void> {
    return this.backend.clear();
  }
}

// Singleton instance
export const columnService = new ColumnService();
