import { AtpAgent } from "@atproto/api";
import { Column } from "../../components/SkyDeck";
import { StorageBackend } from "./types";

export abstract class ColumnStorageBackend implements StorageBackend<Column> {
  protected agent?: AtpAgent;

  abstract initialize(agent?: AtpAgent): Promise<void>;
  abstract getAll(): Promise<Column[]>;
  abstract get(id: string): Promise<Column | undefined>;
  abstract create(column: Column): Promise<void>;
  abstract update(id: string, column: Column): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract clear(): Promise<void>;

  async export(): Promise<Column[]> {
    return this.getAll();
  }

  async import(columns: Column[]): Promise<void> {
    // Clear existing columns
    await this.clear();

    // Import new columns
    for (const column of columns) {
      await this.create(column);
    }
  }
}
