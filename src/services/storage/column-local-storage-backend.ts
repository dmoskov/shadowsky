import { AtpAgent } from "@atproto/api";
import { Column } from "../../components/SkyDeck";
import { ColumnStorageBackend } from "./column-storage-backend";

export class ColumnLocalStorageBackend extends ColumnStorageBackend {
  private readonly STORAGE_KEY = "skyDeckColumns";

  async initialize(agent?: AtpAgent): Promise<void> {
    this.agent = agent;
    // Local storage doesn't need initialization
  }

  async getAll(): Promise<Column[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const columns = JSON.parse(stored);
      return Array.isArray(columns) ? columns : [];
    } catch (error) {
      console.error("Failed to load columns from localStorage:", error);
      return [];
    }
  }

  async get(id: string): Promise<Column | undefined> {
    const columns = await this.getAll();
    return columns.find((col) => col.id === id);
  }

  async create(column: Column): Promise<void> {
    const columns = await this.getAll();
    columns.push(column);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(columns));
  }

  async update(id: string, column: Column): Promise<void> {
    const columns = await this.getAll();
    const index = columns.findIndex((col) => col.id === id);
    if (index !== -1) {
      columns[index] = { ...column, id }; // Ensure ID doesn't change
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(columns));
    }
  }

  async delete(id: string): Promise<void> {
    const columns = await this.getAll();
    const filtered = columns.filter((col) => col.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
