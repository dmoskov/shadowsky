import { ComposeScreen } from "../../src/screens/compose/ComposeScreen";
import { useLocalSearchParams } from "expo-router";

export default function ComposeRoute() {
  const params = useLocalSearchParams();

  // Parse replyTo and quoteTo from params
  const replyTo = params.replyTo ? JSON.parse(params.replyTo as string) : undefined;
  const quoteTo = params.quoteTo ? JSON.parse(params.quoteTo as string) : undefined;
  const draftId = params.draftId as string | undefined;

  return <ComposeScreen replyTo={replyTo} quoteTo={quoteTo} draftId={draftId} />;
}
