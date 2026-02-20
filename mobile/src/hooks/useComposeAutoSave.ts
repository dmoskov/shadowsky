/**
 * Auto-save compose text to MMKV when the app backgrounds.
 *
 * The AT Protocol draft system requires network, so it can't save when the OS
 * is about to kill the app. This hook persists the current compose text locally
 * via MMKV (synchronous, no network required) so it can be recovered on the
 * next cold start.
 *
 * The saved draft is a lightweight text-only snapshot — media attachments are
 * not included because local file URIs may become invalid after an app kill.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { MMKV } from "react-native-mmkv";

const STORAGE_KEY_TEXT = "compose_autosave_text";
const STORAGE_KEY_TIMESTAMP = "compose_autosave_ts";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

let _storage: InstanceType<typeof MMKV> | null = null;
function getStorage() {
  if (!_storage) {
    _storage = new MMKV({ id: "compose-autosave" });
  }
  return _storage;
}

// ─── Public helpers ─────────────────────────────────────────────────

/**
 * Read and clear the auto-saved compose text.
 * Returns null if nothing was saved or the save has expired.
 */
export function consumeAutoSavedCompose(): string | null {
  try {
    const storage = getStorage();
    const text = storage.getString(STORAGE_KEY_TEXT);
    const ts = storage.getNumber(STORAGE_KEY_TIMESTAMP);

    // Always clear after reading
    storage.delete(STORAGE_KEY_TEXT);
    storage.delete(STORAGE_KEY_TIMESTAMP);

    if (!text || !ts) return null;
    if (Date.now() - ts > EXPIRY_MS) return null;
    if (!text.trim()) return null;

    return text;
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
  } catch {
    // best-effort
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * Pass the current compose text. When the app moves to the background,
 * the text is saved to MMKV. When the user posts or discards, call
 * `clearAutoSavedCompose()`.
 */
export function useComposeAutoSave(text: string) {
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        const current = textRef.current;
        if (!current || !current.trim()) return;

        try {
          const storage = getStorage();
          storage.set(STORAGE_KEY_TEXT, current);
          storage.set(STORAGE_KEY_TIMESTAMP, Date.now());
        } catch {
          // best-effort
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);
}
