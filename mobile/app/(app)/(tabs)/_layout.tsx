import {Tabs} from 'expo-router';
import {Text, View} from 'react-native';
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

function NotificationsIcon({color}: {color: string}) {
  return (
    <View style={{position: 'relative'}}>
      <Text style={{color, fontSize: 20}}>N</Text>
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
          tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>H</Text>,
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'Search',
          tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>S</Text>,
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarIcon: ({color}) => <NotificationsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>P</Text>,
        }}
      />
    </Tabs>
  );
}
