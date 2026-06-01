import { debug } from "@bsky/shared";
import { useState } from "react";

const STORAGE_KEY = "bsky-search-history";
const MAX_ENTRIES = 10;

/**
 * Manages the recent-search history list (localStorage-backed).
 * Extracted from SearchTabbed to keep the component focused on rendering.
 */
export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToSearchHistory = (query: string) => {
    if (!query.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((q) => q !== query);
      const updated = [query, ...filtered].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to save search history:", error);
      }
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      debug.error("Failed to clear search history:", error);
    }
  };

  return { searchHistory, addToSearchHistory, clearSearchHistory };
}
