import { Platform, View } from "react-native";
import { useScrollChrome } from "../../../../src/contexts/ScrollChromeContext";
import { NotificationsScreen } from "../../../../src/screens/notifications/NotificationsScreen";
import { NativeNotificationsList } from "../../../../modules/native-notifications-list/src/NativeNotificationsListView";

export default function NotificationsRoute() {
  const { handleScroll } = useScrollChrome();
  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }}>
        <NativeNotificationsList
          style={{ flex: 1 }}
          onScroll={(e) => handleScroll(e.nativeEvent.y)}
        />
      </View>
    );
  }

  return <NotificationsScreen />;
}
