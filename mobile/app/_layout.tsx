import { QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
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
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { NetworkProvider } from "../src/contexts/NetworkContext";
import { PreferencesProvider } from "../src/contexts/PreferencesContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import {
  queryClient,
  setupAppStateListener,
  cleanupAppStateListener,
  setupNetworkListener,
} from "../src/shared/query-client";
import { registerBackgroundFetch } from "../src/services/background-fetch";

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

  return <Slot />;
}

export default function RootLayout() {
  useEffect(() => {
    // Setup AppState listener for query invalidation on foreground
    const cleanup = setupAppStateListener();

    // Setup network listener for online/offline handling
    setupNetworkListener();

    // Register background fetch for fresh content
    registerBackgroundFetch();

    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <NetworkProvider>
              <AuthProvider>
                <PreferencesProvider>
                  <ToastProvider>
                    <QueryErrorHandler>
                      <StatusBar style="light" />
                      <AuthGate />
                    </QueryErrorHandler>
                  </ToastProvider>
                </PreferencesProvider>
              </AuthProvider>
            </NetworkProvider>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
