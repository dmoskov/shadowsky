import { AtpAgent } from "@atproto/api";
import { ThreadDraft } from "./drafts";
import { DraftCustomRecordBackend } from "./storage/draft-custom-record-backend";
import { DraftLocalStorageBackend } from "./storage/draft-local-storage-backend";
import { DraftStorageBackend } from "./storage/draft-storage-backend";
import { StorageType } from "./storage/types";

export class DraftService {
  private backend: DraftStorageBackend;
  private storageType: StorageType = "local";
  private agent?: AtpAgent | null;

  constructor() {
    // Default to local storage
    this.backend = new DraftLocalStorageBackend();
  }

  async initialize(agent: AtpAgent, storageType: StorageType) {
    this.agent = agent;
    this.storageType = storageType;

    // Initialize the appropriate backend
    if (storageType === "custom") {
      this.backend = new DraftCustomRecordBackend();
    } else {
      this.backend = new DraftLocalStorageBackend();
    }

    await this.backend.initialize(agent);
  }

  setAgent(agent: AtpAgent | null) {
    this.agent = agent || undefined;
  }

  getStorageType(): StorageType {
    return this.storageType;
  }

  async getDrafts(): Promise<ThreadDraft[]> {
    return this.backend.getAll();
  }

  async getDraft(id: string): Promise<ThreadDraft | undefined> {
    return this.backend.get(id);
  }

  async createDraft(draft: ThreadDraft): Promise<void> {
    return this.backend.create(draft);
  }

  async updateDraft(id: string, draft: ThreadDraft): Promise<void> {
    return this.backend.update(id, draft);
  }

  async deleteDraft(id: string): Promise<void> {
    return this.backend.delete(id);
  }

  async getDraftCount(): Promise<number> {
    const drafts = await this.backend.getAll();
    return drafts.length;
  }

  async exportAllDrafts(): Promise<ThreadDraft[]> {
    return this.backend.export();
  }

  async importDrafts(drafts: ThreadDraft[]): Promise<number> {
    await this.backend.import(drafts);
    return drafts.length;
  }

  async migrateStorage(
    fromType: StorageType,
    toType: StorageType,
  ): Promise<void> {
    if (fromType === toType) return;

    // Export from current backend
    const drafts = await this.backend.export();

    // Initialize new backend
    const newBackend =
      toType === "custom"
        ? new DraftCustomRecordBackend()
        : new DraftLocalStorageBackend();

    await newBackend.initialize(this.agent || undefined);

    // Import to new backend
    await newBackend.import(drafts);

    // Switch to new backend
    this.backend = newBackend;
    this.storageType = toType;
  }

  async clearAllDrafts(): Promise<void> {
    return this.backend.clear();
  }
}

// Singleton instance
export const draftService = new DraftService();
