import { AtpAgent } from "@atproto/api";
import { ATProtocolListRecord, List, ListMember } from "../types/lists";
import { createLogger } from "../utils/logger";

const logger = createLogger("ListStorage");

class ListStorage {
  private readonly COLLECTION = "com.shadowsky.list";
  private agent: AtpAgent | null = null;
  private initialized = false;

  async initialize(agent: AtpAgent): Promise<void> {
    if (!agent) {
      throw new Error("Agent is required for list storage");
    }
    this.agent = agent;
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized || !this.agent) {
      throw new Error("List storage not initialized. Call initialize() first.");
    }
  }

  private listToRecord(list: List): ATProtocolListRecord {
    return {
      $type: this.COLLECTION,
      id: list.id,
      name: list.name,
      description: list.description,
      members: list.members,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }

  private recordToList(record: ATProtocolListRecord): List {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      members: record.members || [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private getRecordKey(listId: string): string {
    return `list-${listId}`;
  }

  async getAllLists(): Promise<List[]> {
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
        .map((record) => this.recordToList(record.value as ATProtocolListRecord))
        .sort((a, b) => {
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    } catch (error) {
      logger.error("Failed to fetch lists:", error);
      return [];
    }
  }

  async getList(id: string): Promise<List | undefined> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const response = await this.agent!.api.com.atproto.repo.getRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
      });

      return this.recordToList(response.data.value as ATProtocolListRecord);
    } catch (error) {
      logger.error(`Failed to fetch list ${id}:`, error);
      return undefined;
    }
  }

  async createList(list: Omit<List, "id" | "createdAt" | "updatedAt">): Promise<List> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const now = new Date().toISOString();
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newList: List = {
        ...list,
        id,
        createdAt: now,
        updatedAt: now,
      };

      const record = this.listToRecord(newList);

      await this.agent!.api.com.atproto.repo.createRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
        record,
      });

      return newList;
    } catch (error) {
      logger.error("Failed to create list:", error);
      throw error;
    }
  }

  async updateList(id: string, updates: Partial<Omit<List, "id" | "createdAt">>): Promise<void> {
    this.ensureInitialized();

    try {
      const did = this.agent!.session?.did;
      if (!did) throw new Error("No session");

      const existingList = await this.getList(id);
      if (!existingList) {
        throw new Error(`List ${id} not found`);
      }

      const updatedList: List = {
        ...existingList,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const record = this.listToRecord(updatedList);

      await this.agent!.api.com.atproto.repo.putRecord({
        repo: did,
        collection: this.COLLECTION,
        rkey: this.getRecordKey(id),
        record,
      });
    } catch (error) {
      logger.error(`Failed to update list ${id}:`, error);
      throw error;
    }
  }

  async deleteList(id: string): Promise<void> {
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
      logger.error(`Failed to delete list ${id}:`, error);
      throw error;
    }
  }

  async addMemberToList(listId: string, member: ListMember): Promise<void> {
    this.ensureInitialized();

    try {
      const list = await this.getList(listId);
      if (!list) {
        throw new Error(`List ${listId} not found`);
      }

      const existingMember = list.members.find(m => m.did === member.did);
      if (existingMember) {
        return;
      }

      const updatedMembers = [
        ...list.members,
        { ...member, addedAt: new Date().toISOString() },
      ];

      await this.updateList(listId, { members: updatedMembers });
    } catch (error) {
      logger.error(`Failed to add member to list ${listId}:`, error);
      throw error;
    }
  }

  async removeMemberFromList(listId: string, memberDid: string): Promise<void> {
    this.ensureInitialized();

    try {
      const list = await this.getList(listId);
      if (!list) {
        throw new Error(`List ${listId} not found`);
      }

      const updatedMembers = list.members.filter(m => m.did !== memberDid);
      await this.updateList(listId, { members: updatedMembers });
    } catch (error) {
      logger.error(`Failed to remove member from list ${listId}:`, error);
      throw error;
    }
  }

  async getListsContainingMember(memberDid: string): Promise<List[]> {
    this.ensureInitialized();

    try {
      const allLists = await this.getAllLists();
      return allLists.filter(list =>
        list.members.some(m => m.did === memberDid)
      );
    } catch (error) {
      logger.error("Failed to get lists containing member:", error);
      return [];
    }
  }
}

export const listStorage = new ListStorage();
