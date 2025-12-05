import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from '../../types/navigation';
import {
  ProfileScreen,
  ThreadScreen,
  BookmarksScreen,
  MessagesScreen,
} from '../../screens';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// MyProfile screen - shows the current user's profile
function MyProfileScreen() {
  // TODO: Get current user handle from auth context
  return <ProfileScreen route={{params: {handle: 'me'}} as any} navigation={{} as any} />;
}

export function ProfileStack() {
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
        name="MyProfile"
        component={MyProfileScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({route}) => ({
          title: `@${route.params.handle}`,
        })}
      />
      <Stack.Screen
        name="Thread"
        component={ThreadScreen}
        options={{title: 'Thread'}}
      />
      <Stack.Screen
        name="Bookmarks"
        component={BookmarksScreen}
        options={{title: 'Bookmarks'}}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{title: 'Messages'}}
      />
    </Stack.Navigator>
  );
}
