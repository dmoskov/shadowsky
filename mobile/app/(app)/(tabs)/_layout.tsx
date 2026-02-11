import {Tabs} from 'expo-router';
import {Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useUnreadCount} from '../../../src/hooks/api/useNotifications';

function NotificationsBadge() {
  const {data: unreadCount} = useUnreadCount();

  if (!unreadCount || unreadCount === 0) {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        right: -6,
        top: -3,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}>
      <Text
        style={{
          color: '#ffffff',
          fontSize: 11,
          fontWeight: '700',
        }}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
}

function NotificationsIcon({
  color,
  focused,
}: {
  color: string;
  focused: boolean;
}) {
  return (
    <View style={{position: 'relative'}}>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
        size={24}
        color={color}
      />
      <NotificationsBadge />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#1f2937',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({color, focused}) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'Search',
          tabBarIcon: ({color, focused}) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarIcon: ({color, focused}) => (
            <NotificationsIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({color, focused}) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
