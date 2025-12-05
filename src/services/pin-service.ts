import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";

const logger = createLogger("PinService");

const PIN_COLLECTION = "com.shadowsky.pin";
const MAX_PINS = 5;

export interface PinRecord {
  $type: "com.shadowsky.pin";
  postUri: string;
  postCid: string;
  pinnedAt: string;
  order: number;
  [key: string]: unknown;
}

export interface PinnedPost {
  uri: string;
  record: PinRecord;
  post?: AppBskyFeedDefs.PostView;
}

class PinService {
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  async getPinnedPosts(did: string): Promise<PinnedPost[]> {
    if (!this.agent) {
      return [];
    }

    try {
      const result = await this.agent.com.atproto.repo.listRecords({
        repo: did,
        collection: PIN_COLLECTION,
        limit: MAX_PINS,
      });

      const pins: PinnedPost[] = result.data.records.map((record) => ({
        uri: record.uri,
        record: record.value as unknown as PinRecord,
      }));

      // Sort by order
      pins.sort((a, b) => a.record.order - b.record.order);

      return pins;
    } catch (error) {
      // 400 error usually means collection doesn't exist yet (no pins)
      if ((error as { status?: number }).status !== 400) {
        logger.error("Failed to get pinned posts:", error);
      }
      return [];
    }
  }

  async getPinnedPostsWithDetails(
    did: string,
  ): Promise<(PinnedPost & { post: AppBskyFeedDefs.PostView })[]> {
    if (!this.agent) {
      return [];
    }

    const pins = await this.getPinnedPosts(did);
    if (pins.length === 0) {
      return [];
    }

    try {
      // Fetch post details for all pinned posts
      const postUris = pins.map((pin) => pin.record.postUri);
      const postsResult = await this.agent.getPosts({ uris: postUris });

      // Map posts to pins
      const postsMap = new Map<string, AppBskyFeedDefs.PostView>();
      for (const post of postsResult.data.posts) {
        postsMap.set(post.uri, post);
      }

      return pins
        .map((pin) => {
          const post = postsMap.get(pin.record.postUri);
          if (!post) return null;
          return { ...pin, post };
        })
        .filter(
          (pin): pin is PinnedPost & { post: AppBskyFeedDefs.PostView } =>
            pin !== null,
        );
    } catch (error) {
      logger.error("Failed to fetch pinned post details:", error);
      return [];
    }
  }

  async isPinned(postUri: string): Promise<boolean> {
    if (!this.agent || !this.agent.session?.did) {
      return false;
    }

    try {
      const pins = await this.getPinnedPosts(this.agent.session.did);
      return pins.some((pin) => pin.record.postUri === postUri);
    } catch {
      return false;
    }
  }

  async pinPost(postUri: string, postCid: string): Promise<string | null> {
    if (!this.agent || !this.agent.session?.did) {
      logger.error("No agent or session available for pinning post");
      return null;
    }

    try {
      // Check current pin count
      const existingPins = await this.getPinnedPosts(this.agent.session.did);
      if (existingPins.length >= MAX_PINS) {
        logger.error(`Maximum of ${MAX_PINS} pinned posts allowed`);
        return null;
      }

      // Check if already pinned
      if (existingPins.some((pin) => pin.record.postUri === postUri)) {
        logger.log("Post is already pinned");
        return null;
      }

      // Calculate new order (add to end)
      const maxOrder = existingPins.reduce(
        (max, pin) => Math.max(max, pin.record.order),
        -1,
      );

      const record: PinRecord = {
        $type: "com.shadowsky.pin",
        postUri,
        postCid,
        pinnedAt: new Date().toISOString(),
        order: maxOrder + 1,
      };

      // Generate a unique rkey from the post URI
      const rkey = postUri.split("/").pop() || Date.now().toString();

      const result = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session.did,
        collection: PIN_COLLECTION,
        rkey,
        record,
      });

      logger.log("Post pinned:", result.data.uri);
      return result.data.uri;
    } catch (error) {
      logger.error("Failed to pin post:", error);
      return null;
    }
  }

  async unpinPost(postUri: string): Promise<boolean> {
    if (!this.agent || !this.agent.session?.did) {
      logger.error("No agent or session available for unpinning post");
      return false;
    }

    try {
      const pins = await this.getPinnedPosts(this.agent.session.did);
      const pin = pins.find((p) => p.record.postUri === postUri);

      if (!pin) {
        logger.log("Post is not pinned");
        return false;
      }

      // Extract rkey from pin URI
      const rkey = pin.uri.split("/").pop();
      if (!rkey) {
        logger.error("Could not extract rkey from pin URI");
        return false;
      }

      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session.did,
        collection: PIN_COLLECTION,
        rkey,
      });

      logger.log("Post unpinned");
      return true;
    } catch (error) {
      logger.error("Failed to unpin post:", error);
      return false;
    }
  }

  async reorderPins(pinUris: string[]): Promise<boolean> {
    if (!this.agent || !this.agent.session?.did) {
      logger.error("No agent or session available for reordering pins");
      return false;
    }

    try {
      const pins = await this.getPinnedPosts(this.agent.session.did);
      const pinMap = new Map(pins.map((p) => [p.record.postUri, p]));

      // Update order for each pin
      for (let i = 0; i < pinUris.length; i++) {
        const pin = pinMap.get(pinUris[i]);
        if (!pin) continue;

        const rkey = pin.uri.split("/").pop();
        if (!rkey) continue;

        // Only update if order changed
        if (pin.record.order !== i) {
          const updatedRecord: PinRecord = {
            ...pin.record,
            order: i,
          };

          await this.agent.com.atproto.repo.putRecord({
            repo: this.agent.session.did,
            collection: PIN_COLLECTION,
            rkey,
            record: updatedRecord,
          });
        }
      }

      logger.log("Pins reordered");
      return true;
    } catch (error) {
      logger.error("Failed to reorder pins:", error);
      return false;
    }
  }

  getMaxPins(): number {
    return MAX_PINS;
  }
}

export const pinService = new PinService();
