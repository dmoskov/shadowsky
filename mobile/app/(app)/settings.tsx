import { useLocalSearchParams } from "expo-router";
import { SettingsScreen } from "../../src/screens/settings/SettingsScreen";

export default function SettingsRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <SettingsScreen section={section} />;
}
