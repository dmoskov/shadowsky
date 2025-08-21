import { AtpAgent } from "@atproto/api";
import { ThreadDraft } from "../../services/drafts";
import { DraftStorageBackend } from "./draft-storage-backend";
import { LOCAL_STORAGE_KEYS } from "./storage-constants";

export class DraftLocalStorageBackend extends DraftStorageBackend {
  private readonly STORAGE_KEY = LOCAL_STORAGE_KEYS.DRAFTS_LEGACY;

  async initialize(agent?: AtpAgent): Promise<void> {
    this.agent = agent;
    // Local storage doesn't need initialization
  }

  async getAll(): Promise<ThreadDraft[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const drafts = JSON.parse(stored);
      return Array.isArray(drafts) ? drafts : [];
    } catch (error) {
      console.error("Failed to load drafts from localStorage:", error);
      return [];
    }
  }

  async get(id: string): Promise<ThreadDraft | undefined> {
    const drafts = await this.getAll();
    return drafts.find((draft) => draft.id === id);
  }

  async create(draft: ThreadDraft): Promise<void> {
    const drafts = await this.getAll();
    drafts.push(draft);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
  }

  async update(id: string, draft: ThreadDraft): Promise<void> {
    const drafts = await this.getAll();
    const index = drafts.findIndex((d) => d.id === id);
    if (index !== -1) {
      drafts[index] = { ...draft, id }; // Ensure ID doesn't change
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
    }
  }

  async delete(id: string): Promise<void> {
    const drafts = await this.getAll();
    const filtered = drafts.filter((draft) => draft.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
