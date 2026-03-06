/**
 * Auto-save compose text to MMKV so it survives force-kill and app crashes.
 *
 * MMKV writes are synchronous, so data is persisted before the OS can
 * terminate the process. We write on two triggers:
 *   1. Debounced (500ms) after every text change — covers force-kill, jetsam
 *   2. Immediately on AppState → background/inactive — covers normal suspend
 *
 * Thread-mode posts are serialised as JSON alongside the main text.
 *
 * Media attachments are NOT saved because local file URIs may become invalid
 * after an app kill; only text content is preserved.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { MMKV } from "react-native-mmkv";

const STORAGE_KEY_TEXT = "compose_autosave_text";
const STORAGE_KEY_TIMESTAMP = "compose_autosave_ts";
const STORAGE_KEY_THREAD = "compose_autosave_thread";
const STORAGE_KEY_THREAD_MODE = "compose_autosave_thread_mode";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const DEBOUNCE_MS = 500;

let _storage: InstanceType<typeof MMKV> | null = null;
function getStorage() {
  if (!_storage) {
    _storage = new MMKV({ id: "compose-autosave" });
  }
  return _storage;
}

// ─── Internal write helper ──────────────────────────────────────────

function persistNow(text: string, threadMode: boolean, threadTexts: string[]) {
  try {
    const storage = getStorage();
    const hasText = text.trim().length > 0;
    const hasThread =
      threadMode && threadTexts.some((t) => t.trim().length > 0);

    if (!hasText && !hasThread) return;

    storage.set(STORAGE_KEY_TEXT, text);
    storage.set(STORAGE_KEY_TIMESTAMP, Date.now());

    if (threadMode && threadTexts.length > 0) {
      storage.set(STORAGE_KEY_THREAD_MODE, true);
      storage.set(STORAGE_KEY_THREAD, JSON.stringify(threadTexts));
    } else {
      storage.delete(STORAGE_KEY_THREAD_MODE);
      storage.delete(STORAGE_KEY_THREAD);
    }
  } catch {
    // best-effort
  }
}

// ─── Public helpers ─────────────────────────────────────────────────

export interface AutoSavedCompose {
  text: string;
  threadMode: boolean;
  threadTexts: string[];
}

/**
 * Read and clear the auto-saved compose text.
 * Returns null if nothing was saved or the save has expired.
 */
export function consumeAutoSavedCompose(): AutoSavedCompose | null {
  try {
    const storage = getStorage();
    const text = storage.getString(STORAGE_KEY_TEXT);
    const ts = storage.getNumber(STORAGE_KEY_TIMESTAMP);
    const threadMode = storage.getBoolean(STORAGE_KEY_THREAD_MODE) ?? false;
    const threadJson = storage.getString(STORAGE_KEY_THREAD);

    // Always clear after reading
    storage.delete(STORAGE_KEY_TEXT);
    storage.delete(STORAGE_KEY_TIMESTAMP);
    storage.delete(STORAGE_KEY_THREAD_MODE);
    storage.delete(STORAGE_KEY_THREAD);

    if (!ts) return null;
    if (Date.now() - ts > EXPIRY_MS) return null;

    let threadTexts: string[] = [];
    if (threadJson) {
      try {
        threadTexts = JSON.parse(threadJson);
      } catch {
        threadTexts = [];
      }
    }

    const hasText = text ? text.trim().length > 0 : false;
    const hasThread = threadTexts.some((t) => t.trim().length > 0);
    if (!hasText && !hasThread) return null;

    return {
      text: text ?? "",
      threadMode,
      threadTexts,
    };
  } catch {
    return null;
  }
}

/**
 * Explicitly clear the auto-saved compose text.
 * Call this after the user posts successfully or discards.
 */
export function clearAutoSavedCompose() {
  try {
    const storage = getStorage();
    storage.delete(STORAGE_KEY_TEXT);
    storage.delete(STORAGE_KEY_TIMESTAMP);
    storage.delete(STORAGE_KEY_THREAD_MODE);
    storage.delete(STORAGE_KEY_THREAD);
  } catch {
    // best-effort
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * Persist compose text to MMKV on every change (debounced 500ms) and
 * immediately when the app moves to the background. Survives force-kill.
 *
 * @param text         Current compose text
 * @param threadMode   Whether thread mode is active
 * @param threadTexts  Array of text strings for each thread post
 */
export function useComposeAutoSave(
  text: string,
  threadMode = false,
  threadTexts: string[] = [],
) {
  const textRef = useRef(text);
  const threadModeRef = useRef(threadMode);
  const threadTextsRef = useRef(threadTexts);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    threadModeRef.current = threadMode;
  }, [threadMode]);

  useEffect(() => {
    threadTextsRef.current = threadTexts;
  }, [threadTexts]);

  // Debounced save on every text / thread change (500ms)
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      persistNow(
        textRef.current,
        threadModeRef.current,
        threadTextsRef.current,
      );
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, threadMode, threadTexts]);

  // Immediate save on AppState → background/inactive
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        // Cancel pending debounce and write immediately
        if (debounceRef.current) clearTimeout(debounceRef.current);
        persistNow(
          textRef.current,
          threadModeRef.current,
          threadTextsRef.current,
        );
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);
}
