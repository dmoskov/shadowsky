import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NotificationsStackParamList} from '../../types/navigation';
import {
  NotificationsScreen,
  NotificationsAnalyticsScreen,
  ThreadScreen,
  ProfileScreen,
} from '../../screens';

const Stack = createNativeStackNavigator<NotificationsStackParamList>();

export function NotificationsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0a0a0f',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#0a0a0f',
        },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="NotificationsAnalytics"
        component={NotificationsAnalyticsScreen}
        options={{title: 'Analytics'}}
      />
      <Stack.Screen
        name="Thread"
        component={ThreadScreen}
        options={{title: 'Thread'}}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({route}) => ({
          title: `@${route.params.handle}`,
        })}
      />
    </Stack.Navigator>
  );
}
