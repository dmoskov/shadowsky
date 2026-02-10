import { useLocalSearchParams } from "expo-router";
import { ListTimelineScreen } from "../../../../../src/screens/lists/ListTimelineScreen";

export default function ListRoute() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  return <ListTimelineScreen listId={listId!} />;
}
