/**
 * Navigation state restoration hook.
 *
 * Persists the current URL path to MMKV when the app moves to the background
 * and provides the saved path for restoration on cold start. Saved state
 * expires after 30 minutes to avoid restoring deeply stale screens.
 */

import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { usePathname } from "expo-router";
import { MMKV } from "react-native-mmkv";

const STORAGE_KEY_PATH = "nav_restore_path";
const STORAGE_KEY_TIMESTAMP = "nav_restore_ts";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Routes that should NOT be restored (e.g. compose — the draft system handles
 * that case separately, and modals / auth screens would break if restored).
 */
const NON_RESTORABLE_PREFIXES = [
  "/(auth)",
  "/(onboarding)",
  "/(app)/compose",
];

/**
 * Routes that are considered the "home" default — no need to persist these
 * because the app already starts there.
 */
const HOME_ROUTES = [
  "/",
  "/(app)/(tabs)/(home)",
  "/(app)/(tabs)/(home)/",
];

let _storage: InstanceType<typeof MMKV> | null = null;
function getStorage() {
  if (!_storage) {
    _storage = new MMKV({ id: "nav-state-restore" });
  }
  return _storage;
}

// ─── Public helpers (callable outside React) ────────────────────────

/**
 * Read the persisted route if it exists and hasn't expired.
 * Returns null when there is nothing to restore.
 * Clears storage after reading so the restore is one-shot.
 */
export function consumeSavedRoute(): string | null {
  try {
    const storage = getStorage();
    const path = storage.getString(STORAGE_KEY_PATH);
    const ts = storage.getNumber(STORAGE_KEY_TIMESTAMP);

    // Always clear after reading — one-shot restore
    storage.delete(STORAGE_KEY_PATH);
    storage.delete(STORAGE_KEY_TIMESTAMP);

    if (!path || !ts) return null;

    const age = Date.now() - ts;
    if (age > EXPIRY_MS) return null;

    // Don't restore home routes — that's the default anyway
    if (HOME_ROUTES.includes(path)) return null;

    return path;
  } catch {
    return null;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * Call this once inside the root layout (after auth gate).
 * It listens for AppState changes and persists the current pathname
 * every time the app moves to the background.
 */
export function useStateRestoration() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // Keep ref up-to-date so the AppState callback always sees the latest value
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        const current = pathnameRef.current;
        if (!current) return;

        // Skip non-restorable routes
        const skip = NON_RESTORABLE_PREFIXES.some((prefix) =>
          current.startsWith(prefix),
        );
        if (skip) return;

        // Skip home routes — no point persisting the default
        if (HOME_ROUTES.includes(current)) return;

        try {
          const storage = getStorage();
          storage.set(STORAGE_KEY_PATH, current);
          storage.set(STORAGE_KEY_TIMESTAMP, Date.now());
        } catch {
          // Silently ignore storage errors — best-effort persistence
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);
}

// ─── Cold-start hook for the root layout ────────────────────────────

/**
 * Returns a route to restore (or null) on cold start.
 * Should be called once in the root layout before the auth gate redirects.
 * The value is computed synchronously from MMKV on first render and then
 * cleared so subsequent reads return null.
 */
export function useRestoredRoute(): string | null {
  const [route] = useState<string | null>(() => consumeSavedRoute());
  return route;
}
