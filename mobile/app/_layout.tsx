import Constants from "expo-constants";
import * as Device from "expo-device";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useRef } from "react";
import { InteractionManager, LogBox, Platform, AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Suppress known harmless warnings from dependencies
LogBox.ignoreLogs([
  // @atproto/lex-data polyfill fallbacks (expected in Hermes/RN)
  "Uint8Array.fromBase64",
  "Intl.Segmenter is not available",
  // Reanimated reduced motion (simulator setting, dev-only)
  "Reduced motion setting is enabled",
]);
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { QueryErrorHandler } from "../src/components/QueryErrorHandler";
import { AppLockScreen } from "../src/components/AppLockScreen";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { NetworkProvider } from "../src/contexts/NetworkContext";
import { PreferencesProvider, usePreferences } from "../src/contexts/PreferencesContext";
import { ThemeProvider, useTheme } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { ModerationProvider } from "../src/contexts/ModerationContext";
import { LightboxProvider } from "../src/contexts/LightboxContext";
import { VideoAutoplayProvider } from "../src/contexts/VideoAutoplayContext";
import { IPadLayoutProvider } from "../src/contexts/IPadLayoutContext";
import { JetstreamProvider } from "../src/contexts/JetstreamContext";
import { LightboxOverlay } from "../src/components/LightboxOverlay";
import { SharedTransitionProvider } from "../src/contexts/SharedTransitionContext";
import { SharedTransitionOverlay } from "../src/components/SharedTransitionOverlay";
import {
  queryClient,
  setupAppStateListener,
  setupNetworkListener,
  PersistQueryClientProvider,
  persistOptions,
  startupTimestamp,
} from "../src/shared/query-client";
import { registerBackgroundFetch } from "../src/services/background-fetch";
import {
  initializeSentry,
  setTags,
  Sentry,
} from "../src/utils/error-reporting";
import { appLockService } from "../src/services/app-lock";
import { setupOfflineStorageCleanup } from "../src/hooks/useOfflineFeed";
import { useGlobalKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { useImageMemoryManagement } from "../src/hooks/useImageMemoryManagement";
import "../src/i18n";

// Initialize Sentry as early as possible
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
initializeSentry(sentryDsn);

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  const { isAuthenticated } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Only enable app lock if user is authenticated and preference is enabled
    if (!isAuthenticated || !preferences?.appLockEnabled) {
      setIsLocked(false);
      return;
    }

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App has come to foreground
          const shouldLock = await appLockService.shouldRequireAuthentication();
          if (shouldLock && preferences.appLockEnabled) {
            setIsLocked(true);
          }
        } else if (nextAppState.match(/inactive|background/)) {
          // App is going to background
          await appLockService.recordBackgroundTime();
        }

        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, preferences?.appLockEnabled]);

  const handleUnlock = () => {
    setIsLocked(false);
  };

  if (isLocked) {
    return <AppLockScreen onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
}

function DynamicStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(app)/(tabs)/(home)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return (
    <AppLockGate>
      <Slot />
    </AppLockGate>
  );
}

function RootLayout() {
  // Enable global keyboard shortcuts (cmd+N, cmd+K, cmd+1-4)
  useGlobalKeyboardShortcuts();

  // Clear decoded image bitmaps on background/memory-warning to prevent OOM
  useImageMemoryManagement();

  useEffect(() => {
    // Critical path: AppState and network listeners are needed immediately
    // for correct query behavior and online/offline handling.
    const cleanup = setupAppStateListener();
    setupNetworkListener();

    // Deferred work: background fetch registration, offline storage cleanup,
    // and Sentry tagging are not needed for the first frame. Run them after
    // the initial render + animations complete so they don't compete with
    // the feed list layout pass.
    let offlineCleanup: (() => void) | undefined;
    const deferredHandle = InteractionManager.runAfterInteractions(() => {
      setTags({
        app_version: Constants.expoConfig?.version || "unknown",
        platform: Platform.OS,
        os_version: Platform.Version?.toString() || "unknown",
        device_model: Device.modelName || "unknown",
        device_brand: Device.brand || "unknown",
      });

      registerBackgroundFetch();

      setupOfflineStorageCleanup().then(teardown => {
        offlineCleanup = teardown;
      });
    });

    return () => {
      cleanup();
      deferredHandle.cancel();
      offlineCleanup?.();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
            onSuccess={() => {
              // Log how long cache restoration took from module load.
              // This is the time PersistQueryClientProvider spent deserializing
              // the MMKV-backed query cache before children could render.
              if (__DEV__) {
                const elapsed = Date.now() - startupTimestamp;
                // eslint-disable-next-line no-console
                console.log(`[Startup] Query cache restored in ${elapsed}ms`);
              }
            }}
          >
            <AuthProvider>
              <JetstreamProvider>
                <PreferencesProvider>
                  <ThemeProvider>
                    <NetworkProvider>
                      <VideoAutoplayProvider>
                        <ModerationProvider>
                          <ToastProvider>
                            <LightboxProvider>
                              <SharedTransitionProvider>
                                <IPadLayoutProvider>
                                  <QueryErrorHandler>
                                    <DynamicStatusBar />
                                    <AuthGate />
                                  </QueryErrorHandler>
                                  <LightboxOverlay />
                                  <SharedTransitionOverlay />
                                </IPadLayoutProvider>
                              </SharedTransitionProvider>
                            </LightboxProvider>
                          </ToastProvider>
                        </ModerationProvider>
                      </VideoAutoplayProvider>
                    </NetworkProvider>
                  </ThemeProvider>
                </PreferencesProvider>
              </JetstreamProvider>
            </AuthProvider>
          </PersistQueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Wrap the root component with Sentry for crash reporting
export default Sentry.wrap(RootLayout);
