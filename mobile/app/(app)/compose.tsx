import { ComposeScreen } from "../../src/screens/compose/ComposeScreen";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Feature flag: set to true to use the native SwiftUI compose screen on iOS
const USE_NATIVE_COMPOSE = false;

// Lazy-load native compose to avoid eager requireNativeModule crash
const getComposeScreenNative = () =>
  require("../../src/screens/compose/ComposeScreenNative").ComposeScreenNative;

export default function ComposeRoute() {
  const params = useLocalSearchParams();
  const [sharedImages, setSharedImages] = useState<string[] | undefined>(undefined);

  // Parse replyTo and quoteTo from params
  const replyTo = params.replyTo ? JSON.parse(params.replyTo as string) : undefined;
  const quoteTo = params.quoteTo ? JSON.parse(params.quoteTo as string) : undefined;
  const draftId = params.draftId as string | undefined;

  // Handle shared content from iOS Share Extension
  const sharedUrl = params.url as string | undefined;
  const sharedText = params.text as string | undefined;
  const initialText = params.initialText as string | undefined;
  const hasImages = params.hasImages === "true";

  // Load shared images from App Group if the Share Extension passed images
  useEffect(() => {
    if (!hasImages || Platform.OS !== "ios") return;

    let mod: typeof import("../../modules/share-intent");
    try {
      mod = require("../../modules/share-intent");
    } catch {
      return;
    }

    const content = mod.getSharedContent();
    if (content?.images && content.images.length > 0) {
      const imagePaths: string[] = [];
      for (const filename of content.images) {
        const filePath = mod.getSharedImagePath(filename);
        if (filePath) {
          imagePaths.push(filePath);
        }
      }
      if (imagePaths.length > 0) {
        setSharedImages(imagePaths);
      }
      // Clear after reading
      mod.clearSharedContent();
    }
  }, [hasImages]);

  const Compose = USE_NATIVE_COMPOSE && Platform.OS === "ios" ? getComposeScreenNative() : ComposeScreen;

  return (
    <Compose
      replyTo={replyTo}
      quoteTo={quoteTo}
      draftId={draftId}
      sharedUrl={sharedUrl}
      sharedText={sharedText}
      initialText={initialText}
      sharedImages={sharedImages}
    />
  );
}
