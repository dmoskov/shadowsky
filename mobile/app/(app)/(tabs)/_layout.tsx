import React from 'react';
import {Tabs} from 'expo-router';
import {useIPadLayout} from '../../../src/contexts/IPadLayoutContext';
import {useTheme} from '../../../src/contexts/ThemeContext';
import {CustomTabBar} from '../../../src/components/CustomTabBar';

export default function TabsLayout() {
  const {isMultiColumn} = useIPadLayout();
  const {colors} = useTheme();

  return (
    <Tabs
      tabBar={props =>
        isMultiColumn ? null : <CustomTabBar {...props} />
      }
      screenOptions={{
        headerShown: false,
        tabBarStyle: isMultiColumn ? {display: 'none'} : undefined,
        tabBarActiveTintColor: colors.info,
        tabBarInactiveTintColor: colors.textTertiary,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search tab',
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarAccessibilityLabel: 'Notifications tab',
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tabs>
  );
}
