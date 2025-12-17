import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {LandingScreen} from '../screens';
import {DrawerNavigator} from './DrawerNavigator';
import {useAuth} from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    // Show splash screen while loading auth state
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
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
        // Auth routes - only Landing screen for app password authentication
        <Stack.Screen name="Landing" component={LandingScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
