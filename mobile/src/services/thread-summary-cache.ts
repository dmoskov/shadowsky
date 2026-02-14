import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThreadSummaryResult } from "./ai-service";

import { createLogger } from '../utils/logger';

const logger = createLogger('ThreadSummaryCache');

const KEY_PREFIX = "@shadowsky_thread_summary_";
const INDEX_KEY = "@shadowsky_thread_summary_index";
const MAX_ENTRIES = 50;

interface CacheIndexEntry {
  uri: string;
  key: string;
  cachedAt: number;
}

function hashUri(uri: string): string {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cacheKey(uri: string): string {
  return `${KEY_PREFIX}${hashUri(uri)}`;
}

async function getIndex(): Promise<CacheIndexEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setIndex(index: CacheIndexEntry[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function getCachedSummary(uri: string): Promise<ThreadSummaryResult | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uri));
    if (!raw) return null;
    const result: ThreadSummaryResult = JSON.parse(raw);
    result.metadata = { ...result.metadata, cached: true };
    return result;
  } catch {
    return null;
  }
}

export async function cacheSummary(uri: string, result: ThreadSummaryResult): Promise<void> {
  try {
    const key = cacheKey(uri);
    let index = await getIndex();

    // Remove existing entry for this URI if present
    index = index.filter((e) => e.uri !== uri);

    // Evict oldest if at capacity
    if (index.length >= MAX_ENTRIES) {
      index.sort((a, b) => a.cachedAt - b.cachedAt);
      const evicted = index.splice(0, index.length - MAX_ENTRIES + 1);
      const keysToRemove = evicted.map((e) => e.key);
      await AsyncStorage.multiRemove(keysToRemove);
    }

    // Store entry
    index.push({ uri, key, cachedAt: Date.now() });
    await AsyncStorage.setItem(key, JSON.stringify(result));
    await setIndex(index);
  } catch (error) {
    logger.error("Failed to cache thread summary:", error);
  }
}

export async function hasCachedSummary(uri: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uri));
    return raw !== null;
  } catch {
    return false;
  }
}

export async function clearSummaryCache(): Promise<void> {
  try {
    const index = await getIndex();
    const keys = index.map((e) => e.key);
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
    await AsyncStorage.removeItem(INDEX_KEY);
  } catch (error) {
    logger.error("Failed to clear summary cache:", error);
  }
}
