import { AtpAgent } from "@atproto/api";
import { Column } from "./types";

export interface ColumnStorageBackend {
  setAgent(agent: AtpAgent | null): void;
  saveColumns(columns: Column[]): Promise<void>;
  loadColumns(): Promise<Column[]>;
  addColumn(column: Column): Promise<void>;
  updateColumn(columnId: string, updates: Partial<Column>): Promise<void>;
  deleteColumn(columnId: string): Promise<void>;
  migrateFrom(sourceBackend: ColumnStorageBackend): Promise<void>;
  updateColumnFeedPreference?(columnId: string, feedUri: string): Promise<void>;
}
