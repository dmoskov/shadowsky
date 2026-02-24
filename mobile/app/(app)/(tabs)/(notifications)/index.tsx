import { Platform, View } from "react-native";
import { NotificationsScreen } from "../../../../src/screens/notifications/NotificationsScreen";
import { NativeNotificationsList } from "../../../../modules/native-notifications-list/src/NativeNotificationsListView";

export default function NotificationsRoute() {
  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }}>
        <NativeNotificationsList style={{ flex: 1 }} />
      </View>
    );
  }

  return <NotificationsScreen />;
}
