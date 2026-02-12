import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  AppPreferences,
  preferencesService,
} from "../services/preferences";

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
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await preferencesService.get();
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = useCallback(
    async (key: keyof AppPreferences, value: unknown) => {
      try {
        await preferencesService.set(key, value);
        // Reload preferences to ensure consistency
        const updated = await preferencesService.get();
        setPreferences(updated);
      } catch (error) {
        console.error("Failed to update preference:", error);
        throw error;
      }
    },
    [],
  );

  const updatePreferences = useCallback(
    async (updates: Partial<AppPreferences>) => {
      try {
        await preferencesService.setMultiple(updates);
        // Reload preferences to ensure consistency
        const updated = await preferencesService.get();
        setPreferences(updated);
      } catch (error) {
        console.error("Failed to update preferences:", error);
        throw error;
      }
    },
    [],
  );

  const resetPreferences = useCallback(async () => {
    try {
      await preferencesService.reset();
      const prefs = await preferencesService.get();
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to reset preferences:", error);
      throw error;
    }
  }, []);

  const refreshPreferences = useCallback(async () => {
    await loadPreferences();
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
