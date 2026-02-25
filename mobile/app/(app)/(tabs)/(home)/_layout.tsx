import { Stack, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DrawerMenuButton } from "../../../../src/components/DrawerMenuButton";
import { ChatBubbleIcon } from "../../../../src/components/icons";
import { ScreenErrorBoundary } from "../../../../src/components/ScreenErrorBoundary";
import { useTheme } from "../../../../src/contexts/ThemeContext";
import { useUnreadMessageCount } from "../../../../src/hooks/api/useMessages";
import { useResetTabOnBlur } from "../../../../src/hooks/useResetTabOnBlur";

function MessagesHeaderButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const unreadCount = useUnreadMessageCount();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(app)/messages")}
      style={headerStyles.messagesButton}
      accessibilityLabel={
        unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"
      }
      accessibilityRole="button"
    >
      <ChatBubbleIcon size={24} color={colors.text} />
      {unreadCount > 0 && (
        <View style={[headerStyles.badge, { backgroundColor: colors.danger }]}>
          <Text style={headerStyles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const headerStyles = StyleSheet.create({
  messagesButton: {
    padding: 6,
    marginRight: 4,
  },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default function HomeLayout() {
  const { colors } = useTheme();
  useResetTabOnBlur();

  return (
    <ScreenErrorBoundary screenName="Home">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: "Back",
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Home",
            headerLeft: () => <DrawerMenuButton />,
            headerRight: () => <MessagesHeaderButton />,
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="timeline" options={{ title: "Timeline" }} />
        <Stack.Screen
          name="thread/[postId]"
          options={{
            title: "Thread",
            animation: "fade",
            animationDuration: 280,
          }}
        />
        <Stack.Screen name="profile/[handle]" options={{ title: "Profile" }} />
        <Stack.Screen name="list/[listId]" options={{ title: "List" }} />
      </Stack>
    </ScreenErrorBoundary>
  );
}
