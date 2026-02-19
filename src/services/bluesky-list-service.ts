import { AppBskyGraphList, AtpAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";

const logger = createLogger("BlueskyListService");

interface RetryableError extends Error {
  status?: number;
}

function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const err = error as RetryableError;

  if (err.message?.toLowerCase().includes("network")) return true;
  if (err.message?.toLowerCase().includes("timeout")) return true;
  if (err.message?.toLowerCase().includes("fetch")) return true;
  if (err.message?.toLowerCase().includes("econnrefused")) return true;
  if (err.message?.toLowerCase().includes("etimedout")) return true;

  if (err.status) {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) return true;
  }

  return false;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts = 5,
  delays = [100, 500, 2000, 5000],
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxAttempts) {
        logger.error(
          `${operationName} failed after ${attempt} attempt(s):`,
          error,
        );
        throw error;
      }

      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      logger.log(
        `${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export interface BlueskyList {
  uri: string;
  cid: string;
  name: string;
  description?: string;
  avatar?: string;
  listItemCount?: number;
  indexedAt: string;
  viewer?: {
    muted?: boolean;
    blocked?: string;
  };
}

export interface BlueskyListMember {
  uri: string;
  subject: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
}

class BlueskyListService {
  private agent: AtpAgent | null = null;
  private initialized = false;

  async initialize(agent: AtpAgent): Promise<void> {
    if (!agent) {
      throw new Error("Agent is required for list service");
    }
    this.agent = agent;
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized || !this.agent) {
      throw new Error("List service not initialized. Call initialize() first.");
    }
  }

  async getMyLists(): Promise<BlueskyList[]> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const allLists: BlueskyList[] = [];
      let cursor: string | undefined;

      do {
        const response = await this.agent!.app.bsky.graph.getLists({
          actor: did,
          limit: 100,
          cursor,
        });

        allLists.push(
          ...response.data.lists.map((list) => ({
            uri: list.uri,
            cid: list.cid,
            name: list.name,
            description: list.description,
            avatar: list.avatar,
            listItemCount: list.listItemCount,
            indexedAt: list.indexedAt,
            viewer: list.viewer,
          })),
        );

        cursor = response.data.cursor;
      } while (cursor);

      return allLists;
    } catch (error) {
      logger.error("Failed to fetch lists:", error);
      throw error;
    }
  }

  async getList(uri: string): Promise<BlueskyList | null> {
    this.ensureInitialized();

    try {
      const response = await this.agent!.app.bsky.graph.getList({
        list: uri,
        limit: 1,
      });

      const list = response.data.list;
      return {
        uri: list.uri,
        cid: list.cid,
        name: list.name,
        description: list.description,
        avatar: list.avatar,
        listItemCount: list.listItemCount,
        indexedAt: list.indexedAt,
        viewer: list.viewer,
      };
    } catch (error) {
      logger.error(`Failed to fetch list ${uri}:`, error);
      return null;
    }
  }

  async getListMembers(uri: string): Promise<BlueskyListMember[]> {
    this.ensureInitialized();

    try {
      const members: BlueskyListMember[] = [];
      let cursor: string | undefined;

      do {
        const response = await this.agent!.app.bsky.graph.getList({
          list: uri,
          limit: 100,
          cursor,
        });

        members.push(
          ...response.data.items.map((item) => ({
            uri: item.uri,
            subject: {
              did: item.subject.did,
              handle: item.subject.handle,
              displayName: item.subject.displayName,
              avatar: item.subject.avatar,
            },
          })),
        );

        cursor = response.data.cursor;
      } while (cursor);

      return members;
    } catch (error) {
      logger.error(`Failed to fetch list members for ${uri}:`, error);
      return [];
    }
  }

  async createList(
    name: string,
    description?: string,
    avatar?: Blob,
  ): Promise<BlueskyList> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      let avatarBlob;
      if (avatar) {
        const uploadResponse = await this.agent!.uploadBlob(avatar, {
          encoding: avatar.type,
        });
        avatarBlob = uploadResponse.data.blob;
      }

      const record: AppBskyGraphList.Record = {
        $type: "app.bsky.graph.list",
        purpose: "app.bsky.graph.defs#curatelist",
        name,
        description,
        avatar: avatarBlob,
        createdAt: new Date().toISOString(),
      };

      const response = await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        record,
      });

      return {
        uri: response.data.uri,
        cid: response.data.cid,
        name,
        description,
        avatar: avatarBlob ? undefined : undefined,
        listItemCount: 0,
        indexedAt: new Date().toISOString(),
      };
    }, "Create list");
  }

  async updateList(
    uri: string,
    updates: { name?: string; description?: string },
  ): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const existingList = await this.getList(uri);
      if (!existingList) {
        throw new Error(`List ${uri} not found`);
      }

      const rkey = uri.split("/").pop();
      if (!rkey) throw new Error("Invalid list URI");

      const record: AppBskyGraphList.Record = {
        $type: "app.bsky.graph.list",
        purpose: "app.bsky.graph.defs#curatelist",
        name: updates.name || existingList.name,
        description:
          updates.description !== undefined
            ? updates.description
            : existingList.description,
        createdAt: existingList.indexedAt,
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        rkey,
        record,
      });
    }, `Update list ${uri}`);
  }

  async deleteList(uri: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const rkey = uri.split("/").pop();
      if (!rkey) throw new Error("Invalid list URI");

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: "app.bsky.graph.list",
        rkey,
      });
    }, `Delete list ${uri}`);
  }

  async addMemberToList(listUri: string, memberDid: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const record = {
        $type: "app.bsky.graph.listitem",
        subject: memberDid,
        list: listUri,
        createdAt: new Date().toISOString(),
      };

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: "app.bsky.graph.listitem",
        record,
      });
    }, `Add member to list ${listUri}`);
  }

  async removeMemberFromList(listItemUri: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const rkey = listItemUri.split("/").pop();
      if (!rkey) throw new Error("Invalid list item URI");

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: "app.bsky.graph.listitem",
        rkey,
      });
    }, "Remove member from list");
  }

  async getListsContainingMember(memberDid: string): Promise<string[]> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const allLists = await this.getMyLists();
      const listsWithMember: string[] = [];

      for (const list of allLists) {
        const members = await this.getListMembers(list.uri);
        if (members.some((m) => m.subject.did === memberDid)) {
          listsWithMember.push(list.uri);
        }
      }

      return listsWithMember;
    } catch (error) {
      logger.error("Failed to get lists containing member:", error);
      return [];
    }
  }
}

export const blueskyListService = new BlueskyListService();
