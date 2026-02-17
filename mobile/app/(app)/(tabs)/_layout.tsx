import {Tabs} from 'expo-router';
import {Text, View} from 'react-native';
import {HomeIcon, SearchIcon, BellIcon, PersonIcon} from '../../../src/components/icons';
import {useUnreadCount} from '../../../src/hooks/api/useNotifications';
import {useIPadLayout} from '../../../src/contexts/IPadLayoutContext';
import {useTheme} from '../../../src/contexts/ThemeContext';
import {triggerHaptic} from '../../../src/utils/haptics';

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
      }}
      accessible={true}
      accessibilityLabel={`${unreadCount} unread notifications`}
      accessibilityRole="text">
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
      <BellIcon size={24} color={color} filled={focused} />
      <NotificationsBadge />
    </View>
  );
}

export default function TabsLayout() {
  const {isMultiColumn} = useIPadLayout();
  const {colors} = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isMultiColumn
          ? {display: 'none'}
          : {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 1,
            },
        tabBarActiveTintColor: colors.info,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
      screenListeners={{
        tabPress: () => {
          triggerHaptic('light');
        },
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({color, focused}) => (
            <HomeIcon size={24} color={color} filled={focused} accessibilityLabel="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search tab',
          tabBarIcon: ({color}) => (
            <SearchIcon size={24} color={color} accessibilityLabel="Search" />
          ),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Notifications',
          tabBarAccessibilityLabel: 'Notifications tab',
          tabBarIcon: ({color, focused}) => (
            <NotificationsIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({color, focused}) => (
            <PersonIcon size={24} color={color} filled={focused} accessibilityLabel="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}
