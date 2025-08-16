import { AtpAgent } from "@atproto/api";

export type StorageType = "local" | "custom";

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
