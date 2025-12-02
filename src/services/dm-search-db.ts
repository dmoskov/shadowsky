import { debug } from "@bsky/shared";

// Types for indexed DM messages
export interface IndexedDmMessage {
  id: string;
  conversationId: string;
  text: string;
  senderDid: string;
  senderHandle?: string;
  senderDisplayName?: string;
  sentAt: Date;
  hasMedia: boolean;
  hasLinks: boolean;
  indexedAt: Date;
}

export interface DmSearchFilters {
  senderDid?: string;
  startDate?: Date;
  endDate?: Date;
  contentType?: "all" | "media" | "links" | "text";
  conversationId?: string;
}

export interface DmSearchResult {
  message: IndexedDmMessage;
  matchSnippet: string;
  matchPosition: number;
}

const MAX_INDEXED_MESSAGES = 10000;

class DmSearchDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "BlueskyDmSearch";
  private readonly DB_VERSION = 1;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open DM search database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("messages")) {
          const messageStore = db.createObjectStore("messages", {
            keyPath: "id",
          });
          // Index for text search (we'll do manual filtering)
          messageStore.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          messageStore.createIndex("senderDid", "senderDid", { unique: false });
          messageStore.createIndex("sentAt", "sentAt", { unique: false });
          messageStore.createIndex("hasMedia", "hasMedia", { unique: false });
          messageStore.createIndex("hasLinks", "hasLinks", { unique: false });
          // Compound index for conversation + date
          messageStore.createIndex(
            "conversation_date",
            ["conversationId", "sentAt"],
            { unique: false },
          );
        }
      };
    });

    return this.initPromise;
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  // Index a single message
  async indexMessage(message: {
    id: string;
    conversationId: string;
    text: string;
    senderDid: string;
    senderHandle?: string;
    senderDisplayName?: string;
    sentAt: string | Date;
  }): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    const hasMedia = this.detectMedia(message.text);
    const hasLinks = this.detectLinks(message.text);

    const indexedMessage: IndexedDmMessage = {
      id: message.id,
      conversationId: message.conversationId,
      text: message.text,
      senderDid: message.senderDid,
      senderHandle: message.senderHandle,
      senderDisplayName: message.senderDisplayName,
      sentAt: new Date(message.sentAt),
      hasMedia,
      hasLinks,
      indexedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");

      // Use put to update if exists, add if new
      const request = store.put(indexedMessage);

      request.onsuccess = () => {
        this.cleanupOldMessages().catch((error) =>
          debug.error("Failed to cleanup old DM messages:", error),
        );
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Batch index multiple messages
  async indexMessages(
    messages: Array<{
      id: string;
      conversationId: string;
      text: string;
      senderDid: string;
      senderHandle?: string;
      senderDisplayName?: string;
      sentAt: string | Date;
    }>,
  ): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");

      for (const message of messages) {
        const hasMedia = this.detectMedia(message.text);
        const hasLinks = this.detectLinks(message.text);

        const indexedMessage: IndexedDmMessage = {
          id: message.id,
          conversationId: message.conversationId,
          text: message.text,
          senderDid: message.senderDid,
          senderHandle: message.senderHandle,
          senderDisplayName: message.senderDisplayName,
          sentAt: new Date(message.sentAt),
          hasMedia,
          hasLinks,
          indexedAt: new Date(),
        };

        store.put(indexedMessage);
      }

      transaction.oncomplete = () => {
        this.cleanupOldMessages().catch((error) =>
          debug.error("Failed to cleanup old DM messages:", error),
        );
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Search messages with filters
  async searchMessages(
    query: string,
    filters?: DmSearchFilters,
    limit: number = 50,
  ): Promise<DmSearchResult[]> {
    await this.initialize();
    const db = this.ensureDB();
    const queryLower = query.toLowerCase().trim();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const results: DmSearchResult[] = [];

      let cursorRequest: IDBRequest<IDBCursorWithValue | null>;

      // If filtering by conversation, use that index
      if (filters?.conversationId) {
        const index = store.index("conversationId");
        cursorRequest = index.openCursor(
          IDBKeyRange.only(filters.conversationId),
        );
      } else if (filters?.senderDid) {
        const index = store.index("senderDid");
        cursorRequest = index.openCursor(IDBKeyRange.only(filters.senderDid));
      } else {
        cursorRequest = store.openCursor();
      }

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && results.length < limit) {
          const message = cursor.value as IndexedDmMessage;

          // Apply filters
          if (this.matchesFilters(message, filters)) {
            // Text search
            const textLower = message.text.toLowerCase();
            const matchIndex = textLower.indexOf(queryLower);

            if (queryLower === "" || matchIndex !== -1) {
              results.push({
                message,
                matchSnippet: this.createSnippet(
                  message.text,
                  matchIndex,
                  queryLower.length,
                ),
                matchPosition: matchIndex,
              });
            }
          }

          cursor.continue();
        } else {
          // Sort by date descending
          results.sort(
            (a, b) =>
              new Date(b.message.sentAt).getTime() -
              new Date(a.message.sentAt).getTime(),
          );
          resolve(results.slice(0, limit));
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  // Get all indexed messages for a conversation
  async getConversationMessages(
    conversationId: string,
  ): Promise<IndexedDmMessage[]> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const index = store.index("conversationId");
      const messages: IndexedDmMessage[] = [];

      const request = index.openCursor(IDBKeyRange.only(conversationId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Sort by date ascending
          messages.sort(
            (a, b) =>
              new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
          );
          resolve(messages);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Check if a message is already indexed
  async isMessageIndexed(messageId: string): Promise<boolean> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const request = store.get(messageId);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get unique senders from indexed messages
  async getIndexedSenders(): Promise<
    Array<{ did: string; handle?: string; displayName?: string }>
  > {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const senderMap = new Map<
        string,
        { did: string; handle?: string; displayName?: string }
      >();

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const message = cursor.value as IndexedDmMessage;
          if (!senderMap.has(message.senderDid)) {
            senderMap.set(message.senderDid, {
              did: message.senderDid,
              handle: message.senderHandle,
              displayName: message.senderDisplayName,
            });
          }
          cursor.continue();
        } else {
          resolve(Array.from(senderMap.values()));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all indexed messages
  async clearIndex(): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get index statistics
  async getStats(): Promise<{
    totalMessages: number;
    uniqueConversations: number;
    oldestMessage?: Date;
    newestMessage?: Date;
  }> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const conversationSet = new Set<string>();
      let totalMessages = 0;
      let oldestMessage: Date | undefined;
      let newestMessage: Date | undefined;

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const message = cursor.value as IndexedDmMessage;
          totalMessages++;
          conversationSet.add(message.conversationId);

          const sentAt = new Date(message.sentAt);
          if (!oldestMessage || sentAt < oldestMessage) {
            oldestMessage = sentAt;
          }
          if (!newestMessage || sentAt > newestMessage) {
            newestMessage = sentAt;
          }

          cursor.continue();
        } else {
          resolve({
            totalMessages,
            uniqueConversations: conversationSet.size,
            oldestMessage,
            newestMessage,
          });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Helper: Detect if message contains media references
  private detectMedia(text: string): boolean {
    // Check for common image/video URL patterns
    const mediaPatterns = [
      /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)/i,
      /cdn\.bsky\.app/i,
      /media\./i,
      /\[image\]/i,
      /\[video\]/i,
    ];

    return mediaPatterns.some((pattern) => pattern.test(text));
  }

  // Helper: Detect if message contains links
  private detectLinks(text: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+/i;
    return urlPattern.test(text);
  }

  // Helper: Check if message matches filters
  private matchesFilters(
    message: IndexedDmMessage,
    filters?: DmSearchFilters,
  ): boolean {
    if (!filters) return true;

    // Sender filter
    if (filters.senderDid && message.senderDid !== filters.senderDid) {
      return false;
    }

    // Date range filters
    if (filters.startDate) {
      const messageDate = new Date(message.sentAt);
      if (messageDate < filters.startDate) return false;
    }

    if (filters.endDate) {
      const messageDate = new Date(message.sentAt);
      if (messageDate > filters.endDate) return false;
    }

    // Content type filter
    if (filters.contentType && filters.contentType !== "all") {
      switch (filters.contentType) {
        case "media":
          if (!message.hasMedia) return false;
          break;
        case "links":
          if (!message.hasLinks) return false;
          break;
        case "text":
          if (message.hasMedia || message.hasLinks) return false;
          break;
      }
    }

    // Conversation filter
    if (
      filters.conversationId &&
      message.conversationId !== filters.conversationId
    ) {
      return false;
    }

    return true;
  }

  // Helper: Create a snippet around the match
  private createSnippet(
    text: string,
    matchIndex: number,
    matchLength: number,
  ): string {
    if (matchIndex === -1) {
      // No match, return first part of text
      return text.length > 100 ? text.slice(0, 100) + "..." : text;
    }

    const contextLength = 40;
    const start = Math.max(0, matchIndex - contextLength);
    const end = Math.min(text.length, matchIndex + matchLength + contextLength);

    let snippet = text.slice(start, end);

    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";

    return snippet;
  }

  // Cleanup old messages if we exceed the limit
  private async cleanupOldMessages(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const index = store.index("sentAt");
      const messages: { id: string; sentAt: Date }[] = [];

      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          messages.push({
            id: cursor.value.id,
            sentAt: cursor.value.sentAt,
          });
          cursor.continue();
        } else {
          // If we have more than MAX_INDEXED_MESSAGES, delete the oldest ones
          if (messages.length > MAX_INDEXED_MESSAGES) {
            messages.sort(
              (a, b) =>
                new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
            );
            const toDelete = messages.slice(MAX_INDEXED_MESSAGES);

            const deleteTransaction = db.transaction(["messages"], "readwrite");
            const deleteStore = deleteTransaction.objectStore("messages");

            for (const msg of toDelete) {
              deleteStore.delete(msg.id);
            }

            deleteTransaction.oncomplete = () => resolve();
            deleteTransaction.onerror = () => reject(deleteTransaction.error);
          } else {
            resolve();
          }
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let dmSearchDBInstance: DmSearchDB | null = null;

export async function getDmSearchDB(): Promise<DmSearchDB> {
  if (!dmSearchDBInstance) {
    dmSearchDBInstance = new DmSearchDB();
    await dmSearchDBInstance.initialize();
  }
  return dmSearchDBInstance;
}

export { DmSearchDB };
