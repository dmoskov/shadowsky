import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as KeyEvent from 'react-native-keyevent';

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

  useEffect(() => {
    // Only enable keyboard shortcuts on iOS (iPad)
    if (Platform.OS !== 'ios') {
      return;
    }

    const keyDownListener = (keyEvent: any) => {
      const { pressedKey, keyCode, action } = keyEvent;

      // Only handle keyDown events
      if (action !== 'keyDown') {
        return;
      }

      // Check for cmd/meta modifier
      const hasCmd = keyEvent.metaKey || keyEvent.ctrlKey;

      // cmd+N: New post
      if (hasCmd && (pressedKey === 'n' || pressedKey === 'N')) {
        if (shortcuts.onCmdN) {
          shortcuts.onCmdN();
        } else {
          router.push('/(app)/compose');
        }
        return;
      }

      // cmd+K: Search
      if (hasCmd && (pressedKey === 'k' || pressedKey === 'K')) {
        if (shortcuts.onCmdK) {
          shortcuts.onCmdK();
        } else {
          router.push('/(app)/(tabs)/(search)');
        }
        return;
      }

      // cmd+1: Home tab
      if (hasCmd && (pressedKey === '1' || keyCode === 30)) {
        if (shortcuts.onCmd1) {
          shortcuts.onCmd1();
        } else {
          router.push('/(app)/(tabs)/(home)');
        }
        return;
      }

      // cmd+2: Search tab
      if (hasCmd && (pressedKey === '2' || keyCode === 31)) {
        if (shortcuts.onCmd2) {
          shortcuts.onCmd2();
        } else {
          router.push('/(app)/(tabs)/(search)');
        }
        return;
      }

      // cmd+3: Notifications tab
      if (hasCmd && (pressedKey === '3' || keyCode === 32)) {
        if (shortcuts.onCmd3) {
          shortcuts.onCmd3();
        } else {
          router.push('/(app)/(tabs)/(notifications)');
        }
        return;
      }

      // cmd+4: Profile tab
      if (hasCmd && (pressedKey === '4' || keyCode === 33)) {
        if (shortcuts.onCmd4) {
          shortcuts.onCmd4();
        } else {
          router.push('/(app)/(tabs)/(profile)');
        }
        return;
      }

      // cmd+Enter: Submit (only if handler provided)
      if (hasCmd && (keyCode === 66 || pressedKey === '\n' || pressedKey === 'Enter')) {
        if (shortcuts.onCmdEnter) {
          shortcuts.onCmdEnter();
        }
        return;
      }

      // Arrow Up
      if (keyCode === 19 || pressedKey === 'ArrowUp') {
        if (shortcuts.onArrowUp) {
          shortcuts.onArrowUp();
        }
        return;
      }

      // Arrow Down
      if (keyCode === 20 || pressedKey === 'ArrowDown') {
        if (shortcuts.onArrowDown) {
          shortcuts.onArrowDown();
        }
        return;
      }
    };

    KeyEvent.onKeyDownListener(keyDownListener);

    return () => {
      KeyEvent.removeKeyDownListener();
    };
  }, [shortcuts, router]);
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
