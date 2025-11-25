import { AtpAgent } from "@atproto/api";
import {
  AddCollaboratorRequest,
  AddListItemRequest,
  CollaborativeList,
  CollaborativeListDetails,
  CollaboratorRole,
  CreateCollaborativeListRequest,
  DiscoverableList,
  hasPermission,
  ListActivity,
  ListActivityType,
  ListCollaborator,
  ListFollower,
  ListInvitation,
  ListItem,
  ListItemType,
  UpdateCollaborativeListRequest,
} from "../types/collaborative-list";
import { createLogger } from "../utils/logger";
import {
  AT_PROTO_COLLECTIONS,
  LOCAL_STORAGE_KEYS,
} from "./storage/storage-constants";

const logger = createLogger("CollaborativeListService");

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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * AT Protocol record types for collaborative lists
 */
interface ATProtoCollaborativeListRecord {
  $type: "com.shadowsky.collaborativeList";
  id: string;
  name: string;
  description?: string;
  visibility: "public" | "private";
  itemType: "account" | "post" | "topic";
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ATProtoListItemRecord {
  $type: "com.shadowsky.collaborativeListItem";
  id: string;
  listId: string;
  type: ListItemType;
  targetUri: string;
  addedBy: string;
  note?: string;
  createdAt: string;
}

interface ATProtoCollaboratorRecord {
  $type: "com.shadowsky.collaborativeListCollaborator";
  listId: string;
  userDid: string;
  role: CollaboratorRole;
  addedBy: string;
  createdAt: string;
}

interface ATProtoFollowerRecord {
  $type: "com.shadowsky.collaborativeListFollower";
  listId: string;
  userDid: string;
  createdAt: string;
}

interface ATProtoInvitationRecord {
  $type: "com.shadowsky.collaborativeListInvitation";
  id: string;
  listId: string;
  inviteeDid: string;
  role: CollaboratorRole;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt?: string;
  createdAt: string;
}

/**
 * Service for managing collaborative lists
 */
class CollaborativeListService {
  private agent: AtpAgent | null = null;
  private initialized = false;
  private cachedLists: Map<string, CollaborativeList> = new Map();
  private cachedItems: Map<string, ListItem[]> = new Map();
  private cachedCollaborators: Map<string, ListCollaborator[]> = new Map();

  async initialize(agent: AtpAgent): Promise<void> {
    if (!agent) {
      throw new Error("Agent is required for collaborative list service");
    }
    this.agent = agent;
    this.initialized = true;
    await this.loadFromLocalStorage();
  }

  private ensureInitialized() {
    if (!this.initialized || !this.agent) {
      throw new Error(
        "Collaborative list service not initialized. Call initialize() first.",
      );
    }
  }

  private getDid(): string {
    const did = this.agent?.session?.did;
    if (!did) throw new Error("No session");
    return did;
  }

  /**
   * Load lists from local storage for quick initial access
   */
  private async loadFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(
        LOCAL_STORAGE_KEYS.COLLABORATIVE_LISTS,
      );
      if (stored) {
        const lists: CollaborativeList[] = JSON.parse(stored);
        lists.forEach((list) => this.cachedLists.set(list.id, list));
      }
    } catch (error) {
      logger.error(
        "Failed to load collaborative lists from local storage:",
        error,
      );
    }
  }

  /**
   * Save lists to local storage
   */
  private saveToLocalStorage(): void {
    try {
      const lists = Array.from(this.cachedLists.values());
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.COLLABORATIVE_LISTS,
        JSON.stringify(lists),
      );
    } catch (error) {
      logger.error(
        "Failed to save collaborative lists to local storage:",
        error,
      );
    }
  }

  /**
   * Save items to local storage
   */
  private saveItemsToLocalStorage(): void {
    try {
      const itemsMap: Record<string, ListItem[]> = {};
      this.cachedItems.forEach((items, listId) => {
        itemsMap[listId] = items;
      });
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.COLLABORATIVE_LIST_ITEMS,
        JSON.stringify(itemsMap),
      );
    } catch (error) {
      logger.error("Failed to save list items to local storage:", error);
    }
  }

  /**
   * Create a new collaborative list
   */
  async createList(
    request: CreateCollaborativeListRequest,
  ): Promise<CollaborativeList> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();
      const now = new Date().toISOString();
      const id = generateId();

      const record: ATProtoCollaborativeListRecord = {
        $type: "com.shadowsky.collaborativeList",
        id,
        name: request.name,
        description: request.description,
        visibility: request.visibility,
        itemType: request.itemType,
        tags: request.tags,
        createdAt: now,
        updatedAt: now,
      };

      // Create the list record in AT Protocol
      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LISTS,
        rkey: id,
        record,
      });

      // Add owner as a collaborator
      await this.addCollaboratorInternal(id, did, "owner", did);

      const list: CollaborativeList = {
        id,
        name: request.name,
        description: request.description,
        visibility: request.visibility,
        ownerDid: did,
        createdAt: now,
        updatedAt: now,
        itemCount: 0,
        followerCount: 0,
        collaboratorCount: 1,
        itemType: request.itemType,
        tags: request.tags,
      };

      this.cachedLists.set(id, list);
      this.saveToLocalStorage();

      logger.log(`Created collaborative list: ${list.name} (${list.id})`);
      return list;
    }, "Create collaborative list");
  }

  /**
   * Get a collaborative list by ID
   */
  async getList(id: string): Promise<CollaborativeList | null> {
    this.ensureInitialized();

    // Check cache first
    if (this.cachedLists.has(id)) {
      return this.cachedLists.get(id)!;
    }

    try {
      const did = this.getDid();

      // Try to fetch from AT Protocol
      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LISTS,
        rkey: id,
      });

      const record = response.data.value as ATProtoCollaborativeListRecord;

      const list: CollaborativeList = {
        id: record.id,
        name: record.name,
        description: record.description,
        visibility: record.visibility,
        ownerDid: did,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        itemCount: await this.getItemCount(id),
        followerCount: await this.getFollowerCount(id),
        collaboratorCount: await this.getCollaboratorCount(id),
        itemType: record.itemType,
        tags: record.tags,
      };

      this.cachedLists.set(id, list);
      this.saveToLocalStorage();

      return list;
    } catch (error) {
      logger.error(`Failed to fetch list ${id}:`, error);
      return null;
    }
  }

  /**
   * Get detailed list information including collaborators and items
   */
  async getListDetails(id: string): Promise<CollaborativeListDetails | null> {
    const list = await this.getList(id);
    if (!list) return null;

    const [collaborators, items, followers, recentActivity] = await Promise.all(
      [
        this.getCollaborators(id),
        this.getItems(id),
        this.getFollowers(id),
        this.getActivity(id, 20),
      ],
    );

    return {
      ...list,
      collaborators,
      items,
      followers,
      recentActivity,
    };
  }

  /**
   * Get all lists for the current user
   */
  async getMyLists(): Promise<CollaborativeList[]> {
    this.ensureInitialized();

    try {
      const did = this.getDid();

      // Fetch all collaborative list records
      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LISTS,
        limit: 100,
      });

      const lists: CollaborativeList[] = [];

      for (const record of response.data.records) {
        const data = record.value as ATProtoCollaborativeListRecord;
        const list: CollaborativeList = {
          id: data.id,
          name: data.name,
          description: data.description,
          visibility: data.visibility,
          ownerDid: did,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          itemCount: await this.getItemCount(data.id),
          followerCount: await this.getFollowerCount(data.id),
          collaboratorCount: await this.getCollaboratorCount(data.id),
          itemType: data.itemType,
          tags: data.tags,
        };
        lists.push(list);
        this.cachedLists.set(list.id, list);
      }

      this.saveToLocalStorage();
      return lists.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } catch (error) {
      logger.error("Failed to fetch my lists:", error);
      // Fall back to cached lists
      return Array.from(this.cachedLists.values());
    }
  }

  /**
   * Update a collaborative list
   */
  async updateList(
    id: string,
    updates: UpdateCollaborativeListRequest,
  ): Promise<CollaborativeList> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();
      const existingList = await this.getList(id);

      if (!existingList) {
        throw new Error(`List ${id} not found`);
      }

      // Check permissions
      const role = await this.getUserRole(id, did);
      if (!role || !hasPermission(role, "canEditListDetails")) {
        throw new Error("You don't have permission to edit this list");
      }

      const now = new Date().toISOString();

      const record: ATProtoCollaborativeListRecord = {
        $type: "com.shadowsky.collaborativeList",
        id,
        name: updates.name || existingList.name,
        description:
          updates.description !== undefined
            ? updates.description
            : existingList.description,
        visibility: updates.visibility || existingList.visibility,
        itemType: existingList.itemType,
        tags: updates.tags !== undefined ? updates.tags : existingList.tags,
        createdAt: existingList.createdAt,
        updatedAt: now,
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LISTS,
        rkey: id,
        record,
      });

      const updatedList: CollaborativeList = {
        ...existingList,
        name: record.name,
        description: record.description,
        visibility: record.visibility,
        tags: record.tags,
        updatedAt: now,
      };

      this.cachedLists.set(id, updatedList);
      this.saveToLocalStorage();

      // Log activity
      await this.logActivity(id, "list_updated", { updates });

      return updatedList;
    }, `Update list ${id}`);
  }

  /**
   * Delete a collaborative list
   */
  async deleteList(id: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Check permissions
      const role = await this.getUserRole(id, did);
      if (!role || !hasPermission(role, "canDeleteList")) {
        throw new Error("You don't have permission to delete this list");
      }

      // Delete items first
      const items = await this.getItems(id);
      for (const item of items) {
        await this.removeItem(id, item.id);
      }

      // Delete collaborators
      // Note: In a real implementation, we'd also clean up collaborator records

      // Delete the list record
      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LISTS,
        rkey: id,
      });

      this.cachedLists.delete(id);
      this.cachedItems.delete(id);
      this.cachedCollaborators.delete(id);
      this.saveToLocalStorage();

      logger.log(`Deleted collaborative list: ${id}`);
    }, `Delete list ${id}`);
  }

  // ==================== Item Management ====================

  /**
   * Add an item to a list
   */
  async addItem(request: AddListItemRequest): Promise<ListItem> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();
      const { listId, type, targetUri, note } = request;

      // Check permissions
      const role = await this.getUserRole(listId, did);
      if (!role || !hasPermission(role, "canAddItems")) {
        throw new Error("You don't have permission to add items to this list");
      }

      const now = new Date().toISOString();
      const id = generateId();

      const record: ATProtoListItemRecord = {
        $type: "com.shadowsky.collaborativeListItem",
        id,
        listId,
        type,
        targetUri,
        addedBy: did,
        note,
        createdAt: now,
      };

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_ITEMS,
        rkey: id,
        record,
      });

      const item: ListItem = {
        id,
        listId,
        type,
        targetUri,
        addedAt: now,
        addedBy: did,
        note,
      };

      // Update cache
      const items = this.cachedItems.get(listId) || [];
      items.push(item);
      this.cachedItems.set(listId, items);
      this.saveItemsToLocalStorage();

      // Update list item count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.itemCount++;
        list.updatedAt = now;
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }

      // Log activity
      await this.logActivity(listId, "item_added", {
        itemId: id,
        type,
        targetUri,
      });

      return item;
    }, "Add item to list");
  }

  /**
   * Remove an item from a list
   */
  async removeItem(listId: string, itemId: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Check permissions
      const role = await this.getUserRole(listId, did);
      if (!role || !hasPermission(role, "canRemoveItems")) {
        throw new Error(
          "You don't have permission to remove items from this list",
        );
      }

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_ITEMS,
        rkey: itemId,
      });

      // Update cache
      const items = this.cachedItems.get(listId) || [];
      const updatedItems = items.filter((item) => item.id !== itemId);
      this.cachedItems.set(listId, updatedItems);
      this.saveItemsToLocalStorage();

      // Update list item count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.itemCount = Math.max(0, list.itemCount - 1);
        list.updatedAt = new Date().toISOString();
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }

      // Log activity
      await this.logActivity(listId, "item_removed", { itemId });
    }, "Remove item from list");
  }

  /**
   * Get all items in a list
   */
  async getItems(listId: string): Promise<ListItem[]> {
    this.ensureInitialized();

    // Check cache first
    if (this.cachedItems.has(listId)) {
      return this.cachedItems.get(listId)!;
    }

    try {
      const did = this.getDid();

      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_ITEMS,
        limit: 100,
      });

      const items: ListItem[] = response.data.records
        .map((record) => record.value as ATProtoListItemRecord)
        .filter((record) => record.listId === listId)
        .map((record) => ({
          id: record.id,
          listId: record.listId,
          type: record.type,
          targetUri: record.targetUri,
          addedAt: record.createdAt,
          addedBy: record.addedBy,
          note: record.note,
        }));

      this.cachedItems.set(listId, items);
      return items;
    } catch (error) {
      logger.error(`Failed to fetch items for list ${listId}:`, error);
      return [];
    }
  }

  private async getItemCount(listId: string): Promise<number> {
    const items = await this.getItems(listId);
    return items.length;
  }

  // ==================== Collaborator Management ====================

  /**
   * Add a collaborator to a list (internal method)
   */
  private async addCollaboratorInternal(
    listId: string,
    userDid: string,
    role: CollaboratorRole,
    addedBy: string,
  ): Promise<void> {
    const record: ATProtoCollaboratorRecord = {
      $type: "com.shadowsky.collaborativeListCollaborator",
      listId,
      userDid,
      role,
      addedBy,
      createdAt: new Date().toISOString(),
    };

    const rkey = `${listId}-${userDid.replace(/:/g, "-")}`;

    await this.agent!.api.com.atproto.repo.createRecord({
      repo: this.getDid(),
      collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_COLLABORATORS,
      rkey,
      record,
    });
  }

  /**
   * Add a collaborator to a list
   */
  async addCollaborator(request: AddCollaboratorRequest): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();
      const { listId, userDid, role } = request;

      // Check permissions
      const currentRole = await this.getUserRole(listId, did);
      if (
        !currentRole ||
        !hasPermission(currentRole, "canInviteCollaborators")
      ) {
        throw new Error(
          "You don't have permission to add collaborators to this list",
        );
      }

      await this.addCollaboratorInternal(listId, userDid, role, did);

      // Update cache
      const collaborators = this.cachedCollaborators.get(listId) || [];
      collaborators.push({
        did: userDid,
        handle: "", // Will be populated when fetched
        role,
        addedAt: new Date().toISOString(),
        addedBy: did,
      });
      this.cachedCollaborators.set(listId, collaborators);

      // Update list collaborator count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.collaboratorCount++;
        list.updatedAt = new Date().toISOString();
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }

      // Log activity
      await this.logActivity(listId, "collaborator_added", { userDid, role });
    }, "Add collaborator");
  }

  /**
   * Remove a collaborator from a list
   */
  async removeCollaborator(listId: string, userDid: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Check permissions
      const currentRole = await this.getUserRole(listId, did);
      if (
        !currentRole ||
        !hasPermission(currentRole, "canRemoveCollaborators")
      ) {
        throw new Error(
          "You don't have permission to remove collaborators from this list",
        );
      }

      // Cannot remove the owner
      const targetRole = await this.getUserRole(listId, userDid);
      if (targetRole === "owner") {
        throw new Error("Cannot remove the owner of the list");
      }

      const rkey = `${listId}-${userDid.replace(/:/g, "-")}`;

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_COLLABORATORS,
        rkey,
      });

      // Update cache
      const collaborators = this.cachedCollaborators.get(listId) || [];
      const updatedCollaborators = collaborators.filter(
        (c) => c.did !== userDid,
      );
      this.cachedCollaborators.set(listId, updatedCollaborators);

      // Update list collaborator count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.collaboratorCount = Math.max(1, list.collaboratorCount - 1);
        list.updatedAt = new Date().toISOString();
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }

      // Log activity
      await this.logActivity(listId, "collaborator_removed", { userDid });
    }, "Remove collaborator");
  }

  /**
   * Update a collaborator's role
   */
  async updateCollaboratorRole(
    listId: string,
    userDid: string,
    newRole: CollaboratorRole,
  ): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Check permissions
      const currentRole = await this.getUserRole(listId, did);
      if (!currentRole || !hasPermission(currentRole, "canChangeRoles")) {
        throw new Error("You don't have permission to change roles");
      }

      // Cannot change owner role
      const targetRole = await this.getUserRole(listId, userDid);
      if (targetRole === "owner") {
        throw new Error("Cannot change the owner's role");
      }

      const rkey = `${listId}-${userDid.replace(/:/g, "-")}`;

      const record: ATProtoCollaboratorRecord = {
        $type: "com.shadowsky.collaborativeListCollaborator",
        listId,
        userDid,
        role: newRole,
        addedBy: did,
        createdAt: new Date().toISOString(),
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_COLLABORATORS,
        rkey,
        record,
      });

      // Update cache
      const collaborators = this.cachedCollaborators.get(listId) || [];
      const collaborator = collaborators.find((c) => c.did === userDid);
      if (collaborator) {
        collaborator.role = newRole;
      }
      this.cachedCollaborators.set(listId, collaborators);

      // Log activity
      await this.logActivity(listId, "role_changed", { userDid, newRole });
    }, "Update collaborator role");
  }

  /**
   * Get all collaborators for a list
   */
  async getCollaborators(listId: string): Promise<ListCollaborator[]> {
    this.ensureInitialized();

    if (this.cachedCollaborators.has(listId)) {
      return this.cachedCollaborators.get(listId)!;
    }

    try {
      const did = this.getDid();

      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_COLLABORATORS,
        limit: 100,
      });

      const collaborators: ListCollaborator[] = response.data.records
        .map((record) => record.value as ATProtoCollaboratorRecord)
        .filter((record) => record.listId === listId)
        .map((record) => ({
          did: record.userDid,
          handle: "", // Would need to fetch profile
          role: record.role,
          addedAt: record.createdAt,
          addedBy: record.addedBy,
        }));

      this.cachedCollaborators.set(listId, collaborators);
      return collaborators;
    } catch (error) {
      logger.error(`Failed to fetch collaborators for list ${listId}:`, error);
      return [];
    }
  }

  private async getCollaboratorCount(listId: string): Promise<number> {
    const collaborators = await this.getCollaborators(listId);
    return collaborators.length;
  }

  /**
   * Get the current user's role for a list
   */
  async getUserRole(
    listId: string,
    userDid?: string,
  ): Promise<CollaboratorRole | null> {
    const did = userDid || this.getDid();
    const collaborators = await this.getCollaborators(listId);
    const collaborator = collaborators.find((c) => c.did === did);
    return collaborator?.role || null;
  }

  // ==================== Following ====================

  /**
   * Follow a list
   */
  async followList(listId: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      const record: ATProtoFollowerRecord = {
        $type: "com.shadowsky.collaborativeListFollower",
        listId,
        userDid: did,
        createdAt: new Date().toISOString(),
      };

      const rkey = `${listId}-${did.replace(/:/g, "-")}`;

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_FOLLOWERS,
        rkey,
        record,
      });

      // Update list follower count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.followerCount++;
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }
    }, "Follow list");
  }

  /**
   * Unfollow a list
   */
  async unfollowList(listId: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();
      const rkey = `${listId}-${did.replace(/:/g, "-")}`;

      await this.agent!.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_FOLLOWERS,
        rkey,
      });

      // Update list follower count
      const list = this.cachedLists.get(listId);
      if (list) {
        list.followerCount = Math.max(0, list.followerCount - 1);
        this.cachedLists.set(listId, list);
        this.saveToLocalStorage();
      }
    }, "Unfollow list");
  }

  /**
   * Check if the current user is following a list
   */
  async isFollowing(listId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const did = this.getDid();
      const rkey = `${listId}-${did.replace(/:/g, "-")}`;

      await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_FOLLOWERS,
        rkey,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all followers of a list
   */
  async getFollowers(listId: string): Promise<ListFollower[]> {
    this.ensureInitialized();

    try {
      const did = this.getDid();

      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_FOLLOWERS,
        limit: 100,
      });

      const followers: ListFollower[] = response.data.records
        .map((record) => record.value as ATProtoFollowerRecord)
        .filter((record) => record.listId === listId)
        .map((record) => ({
          did: record.userDid,
          handle: "", // Would need to fetch profile
          followedAt: record.createdAt,
        }));

      return followers;
    } catch (error) {
      logger.error(`Failed to fetch followers for list ${listId}:`, error);
      return [];
    }
  }

  private async getFollowerCount(listId: string): Promise<number> {
    const followers = await this.getFollowers(listId);
    return followers.length;
  }

  // ==================== Invitations ====================

  /**
   * Create an invitation to join a list
   */
  async createInvitation(
    listId: string,
    inviteeDid: string,
    role: CollaboratorRole,
    expiresInHours: number = 168, // 1 week default
  ): Promise<ListInvitation> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Check permissions
      const currentRole = await this.getUserRole(listId, did);
      if (
        !currentRole ||
        !hasPermission(currentRole, "canInviteCollaborators")
      ) {
        throw new Error("You don't have permission to invite collaborators");
      }

      const now = new Date();
      const id = generateId();
      const expiresAt = new Date(
        now.getTime() + expiresInHours * 60 * 60 * 1000,
      );

      const list = await this.getList(listId);
      if (!list) {
        throw new Error("List not found");
      }

      const record: ATProtoInvitationRecord = {
        $type: "com.shadowsky.collaborativeListInvitation",
        id,
        listId,
        inviteeDid,
        role,
        status: "pending",
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
      };

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        rkey: id,
        record,
      });

      return {
        id,
        listId,
        listName: list.name,
        inviterDid: did,
        inviterHandle: "", // Would need to fetch
        inviteeDid,
        role,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "pending",
      };
    }, "Create invitation");
  }

  /**
   * Accept an invitation to join a list
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      // Get the invitation
      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        rkey: invitationId,
      });

      const invitation = response.data.value as ATProtoInvitationRecord;

      // Check if invitation is for current user
      if (invitation.inviteeDid !== did) {
        throw new Error("This invitation is not for you");
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        throw new Error("This invitation has expired");
      }

      // Check if already accepted
      if (invitation.status !== "pending") {
        throw new Error(`Invitation already ${invitation.status}`);
      }

      // Add user as collaborator
      await this.addCollaboratorInternal(
        invitation.listId,
        did,
        invitation.role,
        did,
      );

      // Update invitation status
      const updatedRecord: ATProtoInvitationRecord = {
        ...invitation,
        status: "accepted",
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        rkey: invitationId,
        record: updatedRecord,
      });

      // Log activity
      await this.logActivity(invitation.listId, "collaborator_added", {
        userDid: did,
        role: invitation.role,
        viaInvitation: true,
      });
    }, "Accept invitation");
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string): Promise<void> {
    this.ensureInitialized();

    return retryWithBackoff(async () => {
      const did = this.getDid();

      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        rkey: invitationId,
      });

      const invitation = response.data.value as ATProtoInvitationRecord;

      if (invitation.inviteeDid !== did) {
        throw new Error("This invitation is not for you");
      }

      const updatedRecord: ATProtoInvitationRecord = {
        ...invitation,
        status: "declined",
      };

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        rkey: invitationId,
        record: updatedRecord,
      });
    }, "Decline invitation");
  }

  /**
   * Get pending invitations for the current user
   */
  async getMyInvitations(): Promise<ListInvitation[]> {
    this.ensureInitialized();

    try {
      const did = this.getDid();

      const response = await this.agent!.api.com.atproto.repo.listRecords({
        repo: did,
        collection: AT_PROTO_COLLECTIONS.COLLABORATIVE_LIST_INVITATIONS,
        limit: 100,
      });

      const invitations: ListInvitation[] = [];

      for (const record of response.data.records) {
        const data = record.value as ATProtoInvitationRecord;

        if (data.inviteeDid === did && data.status === "pending") {
          // Check if expired
          if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
            continue;
          }

          const list = await this.getList(data.listId);

          invitations.push({
            id: data.id,
            listId: data.listId,
            listName: list?.name || "Unknown List",
            inviterDid: "", // Would need to track
            inviterHandle: "",
            inviteeDid: data.inviteeDid,
            role: data.role,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            status: data.status,
          });
        }
      }

      return invitations;
    } catch (error) {
      logger.error("Failed to fetch invitations:", error);
      return [];
    }
  }

  // ==================== Discovery ====================

  /**
   * Discover public lists (would need a relay/indexer in production)
   * For now, returns the user's own public lists
   */
  async discoverLists(
    query?: string,
    itemType?: ListItemType,
  ): Promise<DiscoverableList[]> {
    this.ensureInitialized();

    const myLists = await this.getMyLists();

    let filtered = myLists.filter((list) => list.visibility === "public");

    if (itemType) {
      filtered = filtered.filter((list) => list.itemType === itemType);
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (list) =>
          list.name.toLowerCase().includes(lowerQuery) ||
          list.description?.toLowerCase().includes(lowerQuery) ||
          list.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
      );
    }

    return filtered.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      avatar: list.avatar,
      ownerHandle: "", // Would need to fetch
      ownerDisplayName: "",
      itemCount: list.itemCount,
      followerCount: list.followerCount,
      collaboratorCount: list.collaboratorCount,
      tags: list.tags,
      itemType: list.itemType,
      isFollowing: false, // Would need to check
    }));
  }

  // ==================== Activity Logging ====================

  /**
   * Log an activity for a list
   */
  private async logActivity(
    listId: string,
    type: ListActivityType,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const did = this.getDid();

      // In a full implementation, this would create activity records
      // For now, we just log to the console
      logger.log(`Activity on list ${listId}: ${type}`, {
        actor: did,
        details,
      });
    } catch (error) {
      // Don't fail the main operation if activity logging fails
      logger.error("Failed to log activity:", error);
    }
  }

  /**
   * Get recent activity for a list
   */
  async getActivity(
    listId: string,
    limit: number = 50,
  ): Promise<ListActivity[]> {
    // In a full implementation, this would fetch activity records
    // For now, return empty array
    logger.log(`Fetching activity for list ${listId}, limit: ${limit}`);
    return [];
  }

  // ==================== Cache Management ====================

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedLists.clear();
    this.cachedItems.clear();
    this.cachedCollaborators.clear();
    localStorage.removeItem(LOCAL_STORAGE_KEYS.COLLABORATIVE_LISTS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.COLLABORATIVE_LIST_ITEMS);
  }

  /**
   * Refresh list data from AT Protocol
   */
  async refreshList(listId: string): Promise<CollaborativeList | null> {
    this.cachedLists.delete(listId);
    this.cachedItems.delete(listId);
    this.cachedCollaborators.delete(listId);
    return this.getList(listId);
  }
}

export const collaborativeListService = new CollaborativeListService();
