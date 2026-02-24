// Polyfill APIs missing in Hermes (must be first import)
import "../src/polyfills";

import Constants from "expo-constants";
import * as Device from "expo-device";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useRef } from "react";
import { Appearance, InteractionManager, LogBox, Platform, AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Suppress known harmless warnings from dependencies
LogBox.ignoreLogs([
  // Reanimated reduced motion (simulator setting, dev-only)
  "Reduced motion setting is enabled",
  // React Query persistence: dehydrated-as-pending warning (dev-only, expected)
  "A query that was dehydrated as pending",
  // expo-av deprecation notice (migration to expo-video tracked separately)
  "Expo AV has been deprecated",
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
  isSentryInitialized,
  captureException,
  setTags,
  Sentry,
} from "../src/utils/error-reporting";
import { appLockService } from "../src/services/app-lock";
import { setupOfflineStorageCleanup } from "../src/hooks/useOfflineFeed";
import { useGlobalKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { useImageMemoryManagement } from "../src/hooks/useImageMemoryManagement";
import { usePendingMutationsWarning } from "../src/hooks/usePendingMutationsWarning";
import { useWidgetSync } from "../src/hooks/useWidgetSync";
import { useStateRestoration, useRestoredRoute } from "../src/hooks/useStateRestoration";
import "../src/i18n";

// Initialize Sentry as early as possible
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
initializeSentry(sentryDsn);

// Global unhandled error handler — catches JS errors and unhandled promise
// rejections that slip past React error boundaries (e.g. async callbacks,
// event handlers). Reports them to Sentry so they don't go unnoticed.
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    captureException(error, { extra: { isFatal: !!isFatal, source: "globalHandler" } });
    defaultHandler(error, isFatal);
  });
}

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

  useEffect(() => {
    // Sync native UIKit/SwiftUI appearance with the app's theme preference.
    // Without this, native UIHostingControllers use the system appearance
    // instead of the app's chosen theme, causing light/dark mode mismatches.
    Appearance.setColorScheme(isDark ? "dark" : "light");
  }, [isDark]);

  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function WidgetSyncManager() {
  useWidgetSync();
  return null;
}

function PendingMutationsWarningManager() {
  usePendingMutationsWarning();
  return null;
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const restoredRoute = useRestoredRoute();

  // Persist navigation state when the app moves to the background
  useStateRestoration();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (isAuthenticated && inAuthGroup) {
      // Check if user needs onboarding
      const { onboardingService } = require("../src/services/onboarding/onboarding-service");
      if (!onboardingService.isCompleted()) {
        router.replace("/(onboarding)");
      } else if (restoredRoute) {
        // Restore saved navigation state from a previous session
        router.replace(restoredRoute as any);
      } else {
        router.replace("/(app)/(tabs)/(home)");
      }
    } else if (!isAuthenticated && inOnboardingGroup) {
      router.replace("/(auth)");
    }
  }, [isAuthenticated, isLoading, segments, router, restoredRoute]);

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
                <WidgetSyncManager />
                <PreferencesProvider>
                  <ThemeProvider>
                    <NetworkProvider>
                      <VideoAutoplayProvider>
                        <ModerationProvider>
                          <ToastProvider>
                            <PendingMutationsWarningManager />
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

// Wrap the root component with Sentry for crash reporting.
// Only apply Sentry.wrap when Sentry was actually initialized (requires a DSN).
// Calling Sentry.wrap without Sentry.init produces a noisy startup warning.
export default isSentryInitialized() ? Sentry.wrap(RootLayout) : RootLayout;
