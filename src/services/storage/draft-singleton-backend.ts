import { AtpAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { ShadowSkyDrafts } from "../app-preferences-service";
import { ThreadDraft } from "../drafts";
import { DraftStorageBackend } from "./draft-storage-backend";
import { AT_PROTO_COLLECTIONS, AT_PROTO_RKEYS } from "./storage-constants";

const logger = createLogger("DraftSingletonBackend");

export class DraftSingletonBackend extends DraftStorageBackend {
  private recordUri?: string;
  private draftsCache: Map<string, ThreadDraft> = new Map();
  private errorCallback?: (error: Error, action: string) => void;

  setErrorCallback(callback: (error: Error, action: string) => void) {
    this.errorCallback = callback;
  }

  private handleError(error: any, action: string): void {
    if (this.errorCallback) {
      this.errorCallback(error, action);
    } else {
      logger.error(`Failed to ${action}:`, error);
    }
  }

  async initialize(agent?: AtpAgent): Promise<void> {
    this.agent = agent;
    if (!this.agent) {
      throw new Error("Agent required for AT Protocol storage");
    }
    await this.loadDraftsFromRepo();
  }

  private async loadDraftsFromRepo(): Promise<void> {
    this.draftsCache.clear();

    try {
      const did = this.agent?.session?.did;
      if (!did) {
        throw new Error("No DID available");
      }

      // Try to get the singleton drafts record
      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.DRAFTS,
        rkey: AT_PROTO_RKEYS.DRAFTS,
      });

      if (response.data.value) {
        const draftsData = response.data.value as unknown as ShadowSkyDrafts;
        this.recordUri = response.data.uri;

        // Convert to ThreadDraft format and load into cache
        draftsData.drafts.forEach((draft) => {
          const threadDraft: ThreadDraft = {
            id: draft.id,
            title: draft.text.substring(0, 50), // Use first 50 chars as title
            content: draft.text,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            // Convert images format if present
            images: draft.images?.map((img) => ({
              file: img.data || img.url || "", // Handle both base64 and URL
              alt: img.alt,
            })),
          };
          this.draftsCache.set(draft.id, threadDraft);
        });

        logger.log(
          `Loaded ${draftsData.drafts.length} drafts from AT Protocol`,
        );
      }
    } catch (error: any) {
      if (error?.status === 400) {
        // Record doesn't exist yet, which is normal for new users
        logger.log("No drafts record found, will create on first save");
      } else {
        this.handleError(error, "load drafts");
      }
    }
  }

  async getAll(): Promise<ThreadDraft[]> {
    return Array.from(this.draftsCache.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async get(id: string): Promise<ThreadDraft | undefined> {
    return this.draftsCache.get(id);
  }

  async create(draft: ThreadDraft): Promise<void> {
    this.draftsCache.set(draft.id, draft);
    await this.saveDrafts();
  }

  async update(id: string, draft: ThreadDraft): Promise<void> {
    if (!this.draftsCache.has(id)) {
      throw new Error(`Draft ${id} not found`);
    }
    this.draftsCache.set(id, {
      ...draft,
      id,
      updatedAt: new Date().toISOString(),
    });
    await this.saveDrafts();
  }

  async delete(id: string): Promise<void> {
    this.draftsCache.delete(id);
    await this.saveDrafts();
  }

  async clear(): Promise<void> {
    this.draftsCache.clear();
    await this.saveDrafts();
  }

  async export(): Promise<ThreadDraft[]> {
    return await this.getAll();
  }

  async import(drafts: ThreadDraft[]): Promise<void> {
    // Clear existing and import new
    this.draftsCache.clear();
    drafts.forEach((draft) => {
      this.draftsCache.set(draft.id, draft);
    });
    await this.saveDrafts();
  }

  private async saveDrafts(): Promise<void> {
    try {
      const did = this.agent?.session?.did;
      if (!did) {
        throw new Error("No DID available");
      }

      const draftsData: ShadowSkyDrafts = {
        $type: AT_PROTO_COLLECTIONS.DRAFTS,
        drafts: Array.from(this.draftsCache.values()).map((draft) => ({
          id: draft.id,
          text: draft.content, // Map content to text
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          // Convert images format if present
          images: draft.images?.map((img) => ({
            alt: img.alt,
            data: img.file, // Assume file is base64 data
          })),
        })),
        version: 1,
      };

      if (this.recordUri) {
        // Update existing record
        await this.agent!.api.com.atproto.repo.putRecord({
          repo: did,
          collection: AT_PROTO_COLLECTIONS.DRAFTS,
          rkey: AT_PROTO_RKEYS.DRAFTS,
          record: draftsData as any,
        });
      } else {
        // Create new record
        const response = await this.agent!.api.com.atproto.repo.createRecord({
          repo: did,
          collection: AT_PROTO_COLLECTIONS.DRAFTS,
          rkey: AT_PROTO_RKEYS.DRAFTS,
          record: draftsData as any,
        });
        this.recordUri = response.data.uri;
      }

      logger.log(`Saved ${this.draftsCache.size} drafts to AT Protocol`);
    } catch (error) {
      logger.error("Failed to save drafts:", error);
      throw error;
    }
  }
}
