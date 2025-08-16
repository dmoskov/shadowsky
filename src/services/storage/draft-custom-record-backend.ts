import { AtpAgent } from "@atproto/api";
import { ThreadDraft } from "../../services/drafts";
import { DraftStorageBackend } from "./draft-storage-backend";

interface DraftRecord {
  $type: "com.shadowsky.draft";
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string;
  posts?: string[];
  postOrder?: number[];
  media?: Array<{
    file: string;
    alt: string;
    type: "image" | "video";
    postIndex?: number;
  }>;
  [key: string]: unknown;
}

export class DraftCustomRecordBackend extends DraftStorageBackend {
  private readonly COLLECTION = "com.shadowsky.draft";
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
        "Draft custom record backend not initialized. Call initialize() first.",
      );
    }
  }

  private draftToRecord(draft: ThreadDraft): DraftRecord {
    return {
      $type: this.COLLECTION,
      id: draft.id,
      title: draft.title,
      content: draft.content,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      scheduledFor: draft.scheduledFor,
      posts: draft.posts,
      postOrder: draft.postOrder,
      media: draft.media,
    };
  }

  private recordToDraft(record: DraftRecord): ThreadDraft {
    const draft: ThreadDraft = {
      id: record.id,
      title: record.title,
      content: record.content,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    // Add optional fields if present
    if (record.scheduledFor) draft.scheduledFor = record.scheduledFor;
    if (record.posts) draft.posts = record.posts;
    if (record.postOrder) draft.postOrder = record.postOrder;
    if (record.media) draft.media = record.media;

    return draft;
  }

  private getRecordKey(draftId: string): string {
    // Use a stable key based on draft ID
    return `draft-${draftId}`;
  }

  async getAll(): Promise<ThreadDraft[]> {
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
        .map((record) => this.recordToDraft(record.value as DraftRecord))
        .sort((a, b) => {
          // Sort by updatedAt descending (newest first)
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    } catch (error) {
      console.error("Failed to fetch draft records:", error);
      return [];
    }
  }

  async get(id: string): Promise<ThreadDraft | undefined> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
      });

      return this.recordToDraft(response.data.value as DraftRecord);
    } catch (error) {
      console.error(`Failed to fetch draft ${id}:`, error);
      return undefined;
    }
  }

  async create(draft: ThreadDraft): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const record = this.draftToRecord(draft);

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(draft.id),
        record,
      });
    } catch (error) {
      console.error("Failed to create draft record:", error);
      throw error;
    }
  }

  async update(id: string, draft: ThreadDraft): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const record = this.draftToRecord(draft);

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
        record,
      });
    } catch (error) {
      console.error("Failed to update draft record:", error);
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
      console.error("Failed to delete draft record:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      const drafts = await this.getAll();
      for (const draft of drafts) {
        await this.delete(draft.id);
      }
    } catch (error) {
      console.error("Failed to clear draft records:", error);
      throw error;
    }
  }
}
