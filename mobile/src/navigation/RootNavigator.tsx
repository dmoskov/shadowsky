import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {LandingScreen, OAuthCallbackScreen} from '../screens';
import {DrawerNavigator} from './DrawerNavigator';
import {useAuth} from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    // Could show a splash screen here
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: '#0a0a0f'},
        animation: 'fade',
      }}>
      {isAuthenticated ? (
        // Authenticated routes
        <Stack.Screen name="Main" component={DrawerNavigator} />
      ) : (
        // Auth routes
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen
            name="OAuthCallback"
            component={OAuthCallbackScreen}
            options={{
              // Prevent going back from callback
              gestureEnabled: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
