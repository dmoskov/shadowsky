import { QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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

    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
