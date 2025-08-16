import { AtpAgent } from "@atproto/api";
import { ThreadDraft } from "../../services/drafts";
import { StorageBackend } from "./types";

export abstract class DraftStorageBackend
  implements StorageBackend<ThreadDraft>
{
  protected agent?: AtpAgent;

  abstract initialize(agent?: AtpAgent): Promise<void>;
  abstract getAll(): Promise<ThreadDraft[]>;
  abstract get(id: string): Promise<ThreadDraft | undefined>;
  abstract create(draft: ThreadDraft): Promise<void>;
  abstract update(id: string, draft: ThreadDraft): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract clear(): Promise<void>;

  async export(): Promise<ThreadDraft[]> {
    return this.getAll();
  }

  async import(drafts: ThreadDraft[]): Promise<void> {
    // Clear existing drafts
    await this.clear();

    // Import new drafts
    for (const draft of drafts) {
      await this.create(draft);
    }
  }
}
