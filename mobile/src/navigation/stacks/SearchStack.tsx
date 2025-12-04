import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {SearchStackParamList} from '../../types/navigation';
import {SearchScreen, ThreadScreen, ProfileScreen} from '../../screens';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack() {
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
        name="Search"
        component={SearchScreen}
        options={{headerShown: false}}
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
