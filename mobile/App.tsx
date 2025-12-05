import React from 'react';
import {StatusBar, LogBox} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RootNavigator, linking} from './src/navigation';
import {AuthProvider} from './src/contexts/AuthContext';

// Suppress specific warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Configure React Query for mobile
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Shorter stale time for mobile - data changes frequently
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Aggressive garbage collection for mobile memory
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: unknown) => {
        const err = error as {status?: number};
        // Don't retry rate limits or auth errors
        if (err?.status === 429 || err?.status === 401) return false;
        return failureCount < 2;
      },
      // Don't refetch on reconnect by default (save data)
      refetchOnReconnect: false,
      // Don't refetch when app comes to foreground by default
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Navigation theme to match app styling
const navigationTheme = {
  dark: true,
  colors: {
    primary: '#3b82f6',
    background: '#0a0a0f',
    card: '#0a0a0f',
    text: '#ffffff',
    border: '#1f2937',
    notification: '#ef4444',
  },
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar
              barStyle="light-content"
              backgroundColor="#0a0a0f"
              translucent={false}
            />
            <NavigationContainer
              linking={linking}
              theme={navigationTheme}
              onStateChange={(state) => {
                // Track navigation state changes for analytics
                if (__DEV__) {
                  console.log('Navigation state:', state?.routes[state.index]?.name);
                }
              }}
              onReady={() => {
                // Hide splash screen here if using one
                if (__DEV__) {
                  console.log('Navigation ready');
                }
              }}>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
