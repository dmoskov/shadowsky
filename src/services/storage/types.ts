import { AtpAgent } from "@atproto/api";
import type { Column } from "../../components/SkyDeck";

export type StorageType = "local" | "custom" | "official";

// Re-export Column type for other storage modules
export type { Column };

// Extended Column type for storage with timestamps
export interface StoredColumn extends Column {
  createdAt?: string;
  updatedAt?: string;
}

export interface StorageBackend<T> {
  initialize(agent?: AtpAgent): Promise<void>;
  getAll(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(item: T): Promise<void>;
  update(id: string, item: T): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  export(): Promise<T[]>;
  import(items: T[]): Promise<void>;
}
