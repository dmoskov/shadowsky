/**
 * useGifPicker - State management for GIF picker
 *
 * Manages GIF search, selection, and integration with composer
 */

import { useCallback, useEffect, useState } from "react";
import type { TenorGif } from "../services/tenor";

import { createLogger } from '../utils/logger';

const logger = createLogger('Usegifpicker');
import {
  getBestGifUrl,
  getGifDimensions,
  getTrending,
  searchGifs,
} from "../services/tenor";

export interface SelectedGif {
  id: string;
  url: string;
  title: string;
  width: number;
  height: number;
  tenorUrl: string; // Original Tenor page URL
}

export function useGifPicker() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [trending, setTrending] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGif, setSelectedGif] = useState<SelectedGif | null>(null);

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (isVisible && trending.length === 0) {
      loadTrending();
    }
  }, [isVisible]);

  const loadTrending = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await getTrending(20);
      setTrending(results);
    } catch (err) {
      logger.error('Error loading trending GIFs:', err);
      setError(
        err instanceof Error ? err.message : "Failed to load trending GIFs",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await searchGifs(query, 20);
      setGifs(results);
    } catch (err) {
      logger.error('Error searching GIFs:', err);
      setError(err instanceof Error ? err.message : "Failed to search GIFs");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      // Debounce is handled by the component
      search(query);
    },
    [search],
  );

  const selectGif = useCallback((gif: TenorGif) => {
    const url = getBestGifUrl(gif);
    const dimensions = getGifDimensions(gif);

    setSelectedGif({
      id: gif.id,
      url,
      title: gif.title || gif.content_description,
      width: dimensions.width,
      height: dimensions.height,
      tenorUrl: gif.url,
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedGif(null);
  }, []);

  const open = useCallback(() => {
    setIsVisible(true);
  }, []);

  const close = useCallback(() => {
    setIsVisible(false);
    setSearchQuery("");
    setGifs([]);
    setError(null);
  }, []);

  const displayGifs = searchQuery.trim() ? gifs : trending;

  return {
    // State
    isVisible,
    searchQuery,
    gifs: displayGifs,
    loading,
    error,
    selectedGif,

    // Actions
    open,
    close,
    search: handleSearchChange,
    selectGif,
    clearSelection,
  };
}
