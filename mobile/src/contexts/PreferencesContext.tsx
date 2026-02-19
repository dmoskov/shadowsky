import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  AppPreferences,
  preferencesService,
} from "../services/preferences";
import { getAtProtoClient } from "../services/atproto/client";
import { createLogger } from "../utils/logger";

const logger = createLogger('PreferencesContext');

/**
 * Try to get an authenticated BskyAgent, or return null.
 */
function getAgentOrNull() {
  try {
    const client = getAtProtoClient();
    if (client.isAuthenticated()) {
      return client.getAgent();
    }
  } catch {
    // Not authenticated
  }
  return null;
}

interface PreferencesContextType {
  preferences: AppPreferences | null;
  loading: boolean;
  updatePreference: (
    key: keyof AppPreferences,
    value: unknown,
  ) => Promise<void>;
  updatePreferences: (updates: Partial<AppPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize synchronously from MMKV — no async gap on cold start.
  // preferencesService.getSync() reads from the MMKV C++ store, which is
  // already loaded in memory by the time JS executes.
  const [preferences, setPreferences] = useState<AppPreferences | null>(
    () => preferencesService.getSync(),
  );
  const [loading, setLoading] = useState(false);
  const hasSyncedFromServer = useRef(false);

  // Run one-time AsyncStorage → MMKV migration in the background.
  // This is a no-op if MMKV already has data (every launch after the first).
  useEffect(() => {
    preferencesService.migrateFromAsyncStorage().then(() => {
      // Refresh state in case migration brought in new data
      setPreferences(preferencesService.getSync());
    }).catch((error) => {
      logger.error('Migration failed:', error);
    });
  }, []);

  // On startup, merge server preferences with local (server wins for
  // cross-platform settings, local wins for device-specific).
  useEffect(() => {
    if (hasSyncedFromServer.current) return;

    const agent = getAgentOrNull();
    if (!agent) return;

    hasSyncedFromServer.current = true;
    preferencesService.mergeFromAtProto(agent).then((merged) => {
      if (merged) {
        setPreferences(merged);
      }
    }).catch((error) => {
      logger.error('Failed to merge server preferences on startup:', error);
    });
  });

  const updatePreference = useCallback(
    async (key: keyof AppPreferences, value: unknown) => {
      try {
        await preferencesService.set(key, value);
        setPreferences(preferencesService.getSync());

        // Fire-and-forget: push syncable changes to AT Proto
        if (preferencesService.isSyncableKey(key)) {
          const agent = getAgentOrNull();
          if (agent) {
            preferencesService.pushToAtProto(agent).catch((error) => {
              logger.error('Background AT Proto push failed:', error);
            });
          }
        }
      } catch (error) {
        logger.error('Failed to update preference:', error);
        throw error;
      }
    },
    [],
  );

  const updatePreferences = useCallback(
    async (updates: Partial<AppPreferences>) => {
      try {
        await preferencesService.setMultiple(updates);
        setPreferences(preferencesService.getSync());

        // Fire-and-forget: push if any updated key is syncable
        const hasSyncable = Object.keys(updates).some((k) =>
          preferencesService.isSyncableKey(k as keyof AppPreferences),
        );
        if (hasSyncable) {
          const agent = getAgentOrNull();
          if (agent) {
            preferencesService.pushToAtProto(agent).catch((error) => {
              logger.error('Background AT Proto push failed:', error);
            });
          }
        }
      } catch (error) {
        logger.error('Failed to update preferences:', error);
        throw error;
      }
    },
    [],
  );

  const resetPreferences = useCallback(async () => {
    try {
      await preferencesService.reset();
      setPreferences(preferencesService.getSync());

      // Also push the reset (defaults) to AT Proto
      const agent = getAgentOrNull();
      if (agent) {
        preferencesService.pushToAtProto(agent).catch((error) => {
          logger.error('Background AT Proto push after reset failed:', error);
        });
      }
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      throw error;
    }
  }, []);

  const refreshPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const prefs = await preferencesService.get();
      setPreferences(prefs);
    } catch (error) {
      logger.error('Failed to refresh preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      loading,
      updatePreference,
      updatePreferences,
      resetPreferences,
      refreshPreferences,
    }),
    [
      preferences,
      loading,
      updatePreference,
      updatePreferences,
      resetPreferences,
      refreshPreferences,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
