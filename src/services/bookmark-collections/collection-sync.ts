/**
 * Bookmark Collection AT Proto Sync
 *
 * Syncs bookmark collections and mappings to AT Protocol as a singleton record.
 * Follows the same pattern as app-preferences-service.ts: singleton record with
 * rkey "self" containing the full collections array and mappings.
 *
 * Collection: com.shadowsky.bookmarkCollections
 * Record key: self
 */

import { BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { withAtProtoRetry } from "../../utils/storage-retry";
import {
  AT_PROTO_COLLECTIONS,
  AT_PROTO_RKEYS,
} from "../storage/storage-constants";
import { BookmarkCollection, BookmarkCollectionMapping } from "./types";

const logger = createLogger("CollectionSync");

const COLLECTION = AT_PROTO_COLLECTIONS.BOOKMARK_COLLECTIONS;
const RKEY = AT_PROTO_RKEYS.BOOKMARK_COLLECTIONS;

/** Shape of the AT Proto record stored on the server. */
export interface BookmarkCollectionsRecord {
  $type: "com.shadowsky.bookmarkCollections";
  collections: BookmarkCollection[];
  mappings: BookmarkCollectionMapping[];
  version: number;
}

export class BookmarkCollectionSyncService {
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  /**
   * Fetch collections + mappings from the AT Proto server.
   * Returns null if no record exists or the agent is unavailable.
   */
  async fetchFromServer(): Promise<{
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  } | null> {
    if (!this.agent) return null;

    const did = this.agent.session?.did;
    if (!did) return null;

    try {
      const response = await withAtProtoRetry(async () => {
        return this.agent!.api.com.atproto.repo.getRecord({
          repo: did,
          collection: COLLECTION,
          rkey: RKEY,
        });
      }, "fetchBookmarkCollections");

      if (response.data.value) {
        const record = response.data
          .value as unknown as BookmarkCollectionsRecord;
        return {
          collections: record.collections || [],
          mappings: record.mappings || [],
        };
      }
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown>;
      if (errObj?.status !== 400) {
        logger.error(
          "Failed to fetch bookmark collections from AT Protocol:",
          error,
        );
      }
      // 400 = record doesn't exist yet, normal for new users
    }

    return null;
  }

  /**
   * Push local collections + mappings to the AT Proto server.
   * Uses put-then-create pattern to handle both update and first-time creation.
   */
  async pushToServer(
    collections: BookmarkCollection[],
    mappings: BookmarkCollectionMapping[],
  ): Promise<boolean> {
    if (!this.agent) return false;

    const did = this.agent.session?.did;
    if (!did) return false;

    const record: BookmarkCollectionsRecord = {
      $type: "com.shadowsky.bookmarkCollections",
      collections,
      mappings,
      version: 1,
    };

    try {
      await withAtProtoRetry(async () => {
        try {
          await this.agent!.api.com.atproto.repo.putRecord({
            repo: did,
            collection: COLLECTION,
            rkey: RKEY,
            record: record as unknown as Record<string, unknown>,
          });
        } catch (putError: unknown) {
          const putErrObj = putError as Record<string, unknown>;
          if (putErrObj?.status === 400) {
            await this.agent!.api.com.atproto.repo.createRecord({
              repo: did,
              collection: COLLECTION,
              rkey: RKEY,
              record: record as unknown as Record<string, unknown>,
            });
          } else {
            throw putError;
          }
        }
      }, "pushBookmarkCollections");

      logger.log("Successfully synced bookmark collections to AT Protocol");
      return true;
    } catch (error) {
      logger.error(
        "Failed to sync bookmark collections to AT Protocol:",
        error,
      );
      return false;
    }
  }

  /**
   * Merge server data with local data.
   * Strategy: union of collections by ID, server wins on conflicts (newer updatedAt).
   * Mappings are merged as a union of unique (bookmarkUri, collectionId) pairs.
   */
  mergeData(
    local: {
      collections: BookmarkCollection[];
      mappings: BookmarkCollectionMapping[];
    },
    server: {
      collections: BookmarkCollection[];
      mappings: BookmarkCollectionMapping[];
    },
  ): {
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  } {
    // Merge collections: union by ID, newer updatedAt wins
    const collectionMap = new Map<string, BookmarkCollection>();

    for (const c of local.collections) {
      collectionMap.set(c.id, c);
    }

    for (const c of server.collections) {
      const existing = collectionMap.get(c.id);
      if (!existing || c.updatedAt > existing.updatedAt) {
        collectionMap.set(c.id, c);
      }
    }

    const mergedCollections = Array.from(collectionMap.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    // Merge mappings: union by (bookmarkUri, collectionId) composite key
    const mappingKeys = new Set<string>();
    const mergedMappings: BookmarkCollectionMapping[] = [];

    const addMapping = (m: BookmarkCollectionMapping) => {
      const key = `${m.bookmarkUri}::${m.collectionId}`;
      if (!mappingKeys.has(key)) {
        mappingKeys.add(key);
        mergedMappings.push(m);
      }
    };

    // Add local first, then server (local addedAt preserved)
    for (const m of local.mappings) {
      addMapping(m);
    }
    for (const m of server.mappings) {
      addMapping(m);
    }

    // Remove mappings that reference deleted collections
    const validCollectionIds = new Set(mergedCollections.map((c) => c.id));
    const filteredMappings = mergedMappings.filter((m) =>
      validCollectionIds.has(m.collectionId),
    );

    // Recount bookmarks per collection
    const finalCollections = mergedCollections.map((c) => ({
      ...c,
      bookmarkCount: filteredMappings.filter((m) => m.collectionId === c.id)
        .length,
    }));

    return { collections: finalCollections, mappings: filteredMappings };
  }
}

export const bookmarkCollectionSyncService =
  new BookmarkCollectionSyncService();
