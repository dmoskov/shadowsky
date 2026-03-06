import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { addKeyCommandListener, KeyCommand } from "../../modules/keyboard-shortcuts";

/**
 * Registers iPad hardware keyboard shortcuts via native UIKeyCommand.
 *
 * Unlike the expo-key-event based useKeyboardShortcuts hook, this uses a
 * native Expo module that registers UIKeyCommand instances on a child
 * UIViewController. This gives two benefits:
 *
 * 1. Shortcuts appear in the iPadOS discoverability overlay (hold Cmd key)
 * 2. Shortcuts work regardless of which view is focused
 *
 * Call this once in the root app layout for iPad (IPadAppLayout).
 *
 * Shortcuts:
 * - Cmd+N: New post (compose)
 * - Cmd+K: Search
 * - Cmd+1: Home tab
 * - Cmd+2: Search tab
 * - Cmd+3: Feeds tab
 * - Cmd+4: Notifications tab
 * - Cmd+5: Profile tab
 * - Cmd+R: Refresh (event only, no default navigation)
 * - Cmd+Enter: Submit (event only, no default navigation)
 *
 * @param overrides - Optional map of command names to custom handler functions.
 *   When provided, the custom handler runs instead of the default navigation.
 */
export function useIPadKeyboardShortcuts(
  overrides?: Partial<Record<KeyCommand, () => void>>,
) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = addKeyCommandListener((command) => {
      // Check for a custom override first
      if (overrides?.[command]) {
        overrides[command]!();
        return;
      }

      // Default navigation behavior
      switch (command) {
        case "compose":
          router.push("/(app)/compose");
          break;
        case "search":
          router.push("/(app)/(tabs)/(search)");
          break;
        case "tab:home":
          router.push("/(app)/(tabs)/(home)");
          break;
        case "tab:search":
          router.push("/(app)/(tabs)/(search)");
          break;
        case "tab:feeds":
          router.push("/(app)/(tabs)/(feeds)");
          break;
        case "tab:notifications":
          router.push("/(app)/(tabs)/(notifications)");
          break;
        case "tab:profile":
          router.push("/(app)/(tabs)/(profile)");
          break;
        case "refresh":
        case "submit":
          // These commands have no default navigation.
          // They only fire when an override is provided.
          break;
      }
    });

    return () => subscription.remove();
  }, [router, overrides]);
}
