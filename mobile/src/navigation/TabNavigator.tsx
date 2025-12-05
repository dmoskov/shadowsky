import React from 'react';
import {View, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {TabParamList} from '../types/navigation';
import {HomeStack} from './stacks/HomeStack';
import {SearchStack} from './stacks/SearchStack';
import {NotificationsStack} from './stacks/NotificationsStack';
import {ProfileStack} from './stacks/ProfileStack';
import {ComposeScreen} from '../screens';

const Tab = createBottomTabNavigator<TabParamList>();

// Simple icon components (placeholder - replace with react-native-svg icons)
function HomeIcon({focused}: {focused: boolean}) {
  return (
    <View
      style={[styles.icon, focused ? styles.iconFocused : styles.iconDefault]}
    />
  );
}

function SearchIcon({focused}: {focused: boolean}) {
  return (
    <View
      style={[
        styles.icon,
        styles.searchIcon,
        focused ? styles.iconFocused : styles.iconDefault,
      ]}
    />
  );
}

function ComposeIcon({focused}: {focused: boolean}) {
  return (
    <View style={[styles.composeIcon, focused && styles.composeIconFocused]} />
  );
}

function NotificationsIcon({focused}: {focused: boolean}) {
  return (
    <View
      style={[
        styles.icon,
        styles.bellIcon,
        focused ? styles.iconFocused : styles.iconDefault,
      ]}
    />
  );
}

function ProfileIcon({focused}: {focused: boolean}) {
  return (
    <View
      style={[
        styles.icon,
        styles.profileIcon,
        focused ? styles.iconFocused : styles.iconDefault,
      ]}
    />
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
        options={{
          tabBarIcon: HomeIcon,
          tabBarAccessibilityLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="SearchStack"
        component={SearchStack}
        options={{
          tabBarIcon: SearchIcon,
          tabBarAccessibilityLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Compose"
        component={ComposeScreen}
        options={{
          tabBarIcon: ComposeIcon,
          tabBarAccessibilityLabel: 'Compose new post',
          // Present as modal
          presentation: 'modal',
        }}
      />
      <Tab.Screen
        name="NotificationsStack"
        component={NotificationsStack}
        options={{
          tabBarIcon: NotificationsIcon,
          tabBarAccessibilityLabel: 'Notifications',
          // TODO: Add badge for unread count
        }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          tabBarIcon: ProfileIcon,
          tabBarAccessibilityLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  iconDefault: {
    backgroundColor: '#6b7280',
  },
  iconFocused: {
    backgroundColor: '#3b82f6',
  },
  searchIcon: {
    borderRadius: 12,
  },
  bellIcon: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  profileIcon: {
    borderRadius: 12,
  },
  composeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
  },
  composeIconFocused: {
    backgroundColor: '#2563eb',
  },
});
