import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '../../types/navigation';
import {
  HomeScreen,
  TimelineScreen,
  ThreadScreen,
  ProfileScreen,
  ListTimelineScreen,
} from '../../screens';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
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
        name="Home"
        component={HomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{title: 'Timeline'}}
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
      <Stack.Screen
        name="ListTimeline"
        component={ListTimelineScreen}
        options={{title: 'List'}}
      />
    </Stack.Navigator>
  );
}
