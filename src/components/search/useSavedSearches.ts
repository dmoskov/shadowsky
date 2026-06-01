import { debug } from "@bsky/shared";
import { useCallback, useMemo, useState } from "react";
import { type SavedSearch } from "./search-utils";

const STORAGE_KEY = "bsky-saved-searches";
const MAX_ENTRIES = 20;

/**
 * Manages the user's saved searches (localStorage-backed).
 * Pass the current query string so `isSearchSaved` can reflect it.
 * Extracted from SearchTabbed to keep the component focused on rendering.
 */
export function useSavedSearches(currentQuery: string) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setSavedSearches((prev) => {
      // Don't add duplicates
      if (prev.some((s) => s.query === query)) return prev;

      const newSearch: SavedSearch = {
        id: `saved-${Date.now()}`,
        query: query.trim(),
        createdAt: Date.now(),
      };
      const updated = [newSearch, ...prev].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to save search:", error);
      }
      return updated;
    });
  }, []);

  const removeSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        debug.error("Failed to remove saved search:", error);
      }
      return updated;
    });
  }, []);

  const isSearchSaved = useMemo(() => {
    return savedSearches.some((s) => s.query === currentQuery.trim());
  }, [savedSearches, currentQuery]);

  return { savedSearches, saveSearch, removeSavedSearch, isSearchSaved };
}
