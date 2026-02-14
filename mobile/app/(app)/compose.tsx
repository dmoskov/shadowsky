import { ComposeScreen } from "../../src/screens/compose/ComposeScreen";
import { useLocalSearchParams } from "expo-router";

export default function ComposeRoute() {
  const params = useLocalSearchParams();

  // Parse replyTo and quoteTo from params
  const replyTo = params.replyTo ? JSON.parse(params.replyTo as string) : undefined;
  const quoteTo = params.quoteTo ? JSON.parse(params.quoteTo as string) : undefined;
  const draftId = params.draftId as string | undefined;

  // Handle shared content from iOS Share Extension
  const sharedUrl = params.url as string | undefined;
  const sharedText = params.text as string | undefined;
  const initialText = params.initialText as string | undefined;

  return (
    <ComposeScreen
      replyTo={replyTo}
      quoteTo={quoteTo}
      draftId={draftId}
      sharedUrl={sharedUrl}
      sharedText={sharedText}
      initialText={initialText}
    />
  );
}
