import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeyEvent } from 'expo-key-event';

export type KeyboardShortcutHandler = () => void;

export interface KeyboardShortcuts {
  onCmdN?: KeyboardShortcutHandler;
  onCmdK?: KeyboardShortcutHandler;
  onCmd1?: KeyboardShortcutHandler;
  onCmd2?: KeyboardShortcutHandler;
  onCmd3?: KeyboardShortcutHandler;
  onCmd4?: KeyboardShortcutHandler;
  onArrowUp?: KeyboardShortcutHandler;
  onArrowDown?: KeyboardShortcutHandler;
  onCmdEnter?: KeyboardShortcutHandler;
}

/**
 * Hook for handling keyboard shortcuts on iPad with physical keyboard
 * Supports:
 * - cmd+N: New post
 * - cmd+K: Search
 * - cmd+1-4: Tab switching
 * - Arrow keys: Feed navigation
 * - cmd+Enter: Submit post
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts = {}) {
  const router = useRouter();
  const { keyEvent } = useKeyEvent({ captureModifiers: true });

  useEffect(() => {
    // Only enable keyboard shortcuts on iOS (iPad)
    if (Platform.OS !== 'ios' || !keyEvent) {
      return;
    }

    const { key, metaKey, ctrlKey } = keyEvent;

    // Check for cmd/meta modifier
    const hasCmd = metaKey || ctrlKey;

    // cmd+N: New post
    if (hasCmd && key.toLowerCase() === 'n') {
      if (shortcuts.onCmdN) {
        shortcuts.onCmdN();
      } else {
        router.push('/(app)/compose');
      }
      return;
    }

    // cmd+K: Search
    if (hasCmd && key.toLowerCase() === 'k') {
      if (shortcuts.onCmdK) {
        shortcuts.onCmdK();
      } else {
        router.push('/(app)/(tabs)/(search)');
      }
      return;
    }

    // cmd+1: Home tab
    if (hasCmd && (key === '1' || key === 'Digit1')) {
      if (shortcuts.onCmd1) {
        shortcuts.onCmd1();
      } else {
        router.push('/(app)/(tabs)/(home)');
      }
      return;
    }

    // cmd+2: Search tab
    if (hasCmd && (key === '2' || key === 'Digit2')) {
      if (shortcuts.onCmd2) {
        shortcuts.onCmd2();
      } else {
        router.push('/(app)/(tabs)/(search)');
      }
      return;
    }

    // cmd+3: Notifications tab
    if (hasCmd && (key === '3' || key === 'Digit3')) {
      if (shortcuts.onCmd3) {
        shortcuts.onCmd3();
      } else {
        router.push('/(app)/(tabs)/(notifications)');
      }
      return;
    }

    // cmd+4: Profile tab
    if (hasCmd && (key === '4' || key === 'Digit4')) {
      if (shortcuts.onCmd4) {
        shortcuts.onCmd4();
      } else {
        router.push('/(app)/(tabs)/(profile)');
      }
      return;
    }

    // cmd+Enter: Submit (only if handler provided)
    if (hasCmd && (key === 'Enter' || key === '\n')) {
      if (shortcuts.onCmdEnter) {
        shortcuts.onCmdEnter();
      }
      return;
    }

    // Arrow Up (without cmd modifier)
    if (!hasCmd && key === 'ArrowUp') {
      if (shortcuts.onArrowUp) {
        shortcuts.onArrowUp();
      }
      return;
    }

    // Arrow Down (without cmd modifier)
    if (!hasCmd && key === 'ArrowDown') {
      if (shortcuts.onArrowDown) {
        shortcuts.onArrowDown();
      }
      return;
    }
  }, [keyEvent, shortcuts, router]);
}

/**
 * Global keyboard shortcuts that work app-wide
 * Call this in the root layout component
 */
export function useGlobalKeyboardShortcuts() {
  useKeyboardShortcuts({
    // Global shortcuts like cmd+N and cmd+K are handled by default
    // Tab switching shortcuts are also handled globally
  });
}
