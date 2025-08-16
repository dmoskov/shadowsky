import { AtpAgent } from "@atproto/api";
import { Column } from "../../components/SkyDeck";
import { ColumnStorageBackend } from "./column-storage-backend";

interface ColumnRecord {
  $type: "com.shadowsky.column";
  id: string;
  type: string;
  title?: string;
  data?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export class ColumnCustomRecordBackend extends ColumnStorageBackend {
  private readonly COLLECTION = "com.shadowsky.column";
  private initialized = false;

  async initialize(agent?: AtpAgent): Promise<void> {
    if (!agent) {
      throw new Error("Agent is required for custom record backend");
    }
    this.agent = agent;
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized || !this.agent) {
      throw new Error(
        "Column custom record backend not initialized. Call initialize() first.",
      );
    }
  }

  private columnToRecord(column: Column): ColumnRecord {
    return {
      $type: this.COLLECTION,
      id: column.id,
      type: column.type,
      title: column.title,
      data: column.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private recordToColumn(record: ColumnRecord): Column {
    return {
      id: record.id,
      type: record.type as any,
      title: record.title,
      data: record.data,
    };
  }

  private getRecordKey(columnId: string): string {
    // Use a stable key based on column ID
    return `column-${columnId}`;
  }

  async getAll(): Promise<Column[]> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: this.COLLECTION,
        limit: 100,
      });

      return response.data.records
        .map((record) => this.recordToColumn(record.value as ColumnRecord))
        .sort((a, b) => {
          // Ensure home column is always first
          if (a.id === "home") return -1;
          if (b.id === "home") return 1;
          return 0;
        });
    } catch (error) {
      console.error("Failed to fetch column records:", error);
      return [];
    }
  }

  async get(id: string): Promise<Column | undefined> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
      });

      return this.recordToColumn(response.data.value as ColumnRecord);
    } catch (error) {
      console.error(`Failed to fetch column ${id}:`, error);
      return undefined;
    }
  }

  async create(column: Column): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const record = this.columnToRecord(column);

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(column.id),
        record,
      });
    } catch (error) {
      console.error("Failed to create column record:", error);
      throw error;
    }
  }

  async update(id: string, column: Column): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      // Get the existing record to preserve its URI
      const existing = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
      });

      const record = this.columnToRecord(column);
      record.createdAt = (existing.data.value as ColumnRecord).createdAt; // Preserve creation time

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
        record,
      });
    } catch (error) {
      console.error("Failed to update column record:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
      });
    } catch (error) {
      console.error("Failed to delete column record:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      const columns = await this.getAll();
      for (const column of columns) {
        await this.delete(column.id);
      }
    } catch (error) {
      console.error("Failed to clear column records:", error);
      throw error;
    }
  }
}
