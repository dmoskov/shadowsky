import { Platform } from "react-native";
import { NotificationsScreen } from "../../../../src/screens/notifications/NotificationsScreen";
import { NativeNotificationsList } from "../../../../modules/native-notifications-list/src/NativeNotificationsListView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";

export default function NotificationsRoute() {
  const insets = useSafeAreaInsets();

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <NativeNotificationsList style={{ flex: 1 }} />
      </View>
    );
  }

  return <NotificationsScreen />;
}
