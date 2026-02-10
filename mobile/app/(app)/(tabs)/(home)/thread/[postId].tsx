import { useLocalSearchParams } from "expo-router";
import { ThreadScreen } from "../../../../../src/screens/shared/ThreadScreen";

export default function ThreadRoute() {
  const { postId, handle } = useLocalSearchParams<{
    postId: string;
    handle?: string;
  }>();
  return <ThreadScreen postId={postId!} handle={handle || ""} />;
}
