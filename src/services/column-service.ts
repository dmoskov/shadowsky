import { AtpAgent } from "@atproto/api";
import { Column } from "../components/SkyDeck";
import { ColumnAtProtoBackend } from "./storage/column-atproto-backend";
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
      this.backend = new ColumnAtProtoBackend();
      this.backend.setAgent(agent);
    } else {
      this.backend = new ColumnLocalStorageBackend();
    }
  }

  setAgent(agent: AtpAgent | null) {
    this.agent = agent || undefined;
  }

  getStorageType(): StorageType {
    return this.storageType;
  }

  async getColumns(): Promise<Column[]> {
    return this.backend.loadColumns();
  }

  async getColumn(id: string): Promise<Column | undefined> {
    const columns = await this.backend.loadColumns();
    return columns.find((c) => c.id === id);
  }

  async createColumn(column: Column): Promise<void> {
    return this.backend.addColumn(column);
  }

  async updateColumn(id: string, column: Partial<Column>): Promise<void> {
    return this.backend.updateColumn(id, column as Column);
  }

  async deleteColumn(id: string): Promise<void> {
    return this.backend.deleteColumn(id);
  }

  async getColumnCount(): Promise<number> {
    const columns = await this.backend.loadColumns();
    return columns.length;
  }

  async exportAllColumns(): Promise<Column[]> {
    return this.backend.loadColumns();
  }

  async importColumns(columns: Column[]): Promise<number> {
    await this.backend.saveColumns(columns);
    return columns.length;
  }

  async migrateStorage(
    fromType: StorageType,
    toType: StorageType,
  ): Promise<void> {
    if (fromType === toType) return;

    // Export from current backend
    await this.backend.loadColumns();

    // Initialize new backend
    let newBackend: ColumnStorageBackend;
    if (toType === "custom") {
      newBackend = new ColumnAtProtoBackend();
      if (this.agent) {
        newBackend.setAgent(this.agent);
      }
    } else {
      newBackend = new ColumnLocalStorageBackend();
    }

    // Migrate data
    await newBackend.migrateFrom(this.backend);

    // Switch to new backend
    this.backend = newBackend;
    this.storageType = toType;
  }

  async clearAllColumns(): Promise<void> {
    return this.backend.saveColumns([]);
  }
}

// Singleton instance
export const columnService = new ColumnService();
