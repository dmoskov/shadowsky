import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import type {DrawerParamList} from '../types/navigation';
import {TabNavigator} from './TabNavigator';
import {
  SettingsScreen,
  AnalyticsScreen,
  ScheduledPostsScreen,
  ListsScreen,
} from '../screens';

const Drawer = createDrawerNavigator<DrawerParamList>();

interface DrawerItemProps {
  label: string;
  onPress: () => void;
  isActive?: boolean;
}

function DrawerItem({label, onPress, isActive}: DrawerItemProps) {
  return (
    <TouchableOpacity
      style={[styles.drawerItem, isActive && styles.drawerItemActive]}
      onPress={onPress}>
      <Text
        style={[styles.drawerItemText, isActive && styles.drawerItemTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const {navigation, state} = props;
  const currentRoute = state.routeNames[state.index];

  return (
    <DrawerContentScrollView {...props} style={styles.drawerContent}>
      {/* User header */}
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>S</Text>
        </View>
        <Text style={styles.username}>ShadowSky User</Text>
        <Text style={styles.handle}>@user.bsky.social</Text>
      </View>

      {/* Navigation items */}
      <View style={styles.drawerItems}>
        <DrawerItem
          label="Home"
          isActive={currentRoute === 'Tabs'}
          onPress={() => navigation.navigate('Tabs')}
        />
        <DrawerItem
          label="Lists"
          isActive={currentRoute === 'Lists'}
          onPress={() => navigation.navigate('Lists')}
        />
        <DrawerItem
          label="Scheduled Posts"
          isActive={currentRoute === 'ScheduledPosts'}
          onPress={() => navigation.navigate('ScheduledPosts')}
        />
        <DrawerItem
          label="Analytics"
          isActive={currentRoute === 'Analytics'}
          onPress={() => navigation.navigate('Analytics')}
        />

        <View style={styles.divider} />

        <DrawerItem
          label="Settings"
          isActive={currentRoute === 'Settings'}
          onPress={() => navigation.navigate('Settings', {})}
        />
      </View>

      {/* App version */}
      <View style={styles.drawerFooter}>
        <Text style={styles.version}>ShadowSky v0.7.0</Text>
      </View>
    </DrawerContentScrollView>
  );
}

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: styles.drawer,
        drawerType: 'front',
        overlayColor: 'rgba(0, 0, 0, 0.7)',
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}>
      <Drawer.Screen name="Tabs" component={TabNavigator} />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerStyle: {backgroundColor: '#0a0a0f'},
          headerTintColor: '#ffffff',
        }}
      />
      <Drawer.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          headerShown: true,
          headerStyle: {backgroundColor: '#0a0a0f'},
          headerTintColor: '#ffffff',
        }}
      />
      <Drawer.Screen
        name="ScheduledPosts"
        component={ScheduledPostsScreen}
        options={{
          headerShown: true,
          headerStyle: {backgroundColor: '#0a0a0f'},
          headerTintColor: '#ffffff',
          title: 'Scheduled Posts',
        }}
      />
      <Drawer.Screen
        name="Lists"
        component={ListsScreen}
        options={{
          headerShown: true,
          headerStyle: {backgroundColor: '#0a0a0f'},
          headerTintColor: '#ffffff',
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: '#0a0a0f',
    width: 280,
  },
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  handle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  drawerItems: {
    paddingVertical: 8,
  },
  drawerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 44, // WCAG 2.1 touch target minimum
  },
  drawerItemActive: {
    backgroundColor: '#1f2937',
  },
  drawerItemText: {
    color: '#ffffff',
    fontSize: 16,
  },
  drawerItemTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  drawerFooter: {
    padding: 20,
    marginTop: 'auto',
  },
  version: {
    color: '#6b7280',
    fontSize: 12,
  },
});
