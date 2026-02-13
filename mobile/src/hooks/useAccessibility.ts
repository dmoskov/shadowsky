import {useState, useEffect} from 'react';
import {AccessibilityInfo} from 'react-native';

/**
 * Hook to detect if screen reader (VoiceOver/TalkBack) is enabled
 */
export function useScreenReader(): boolean {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  useEffect(() => {
    // Check initial state
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return screenReaderEnabled;
}

/**
 * Hook to detect if reduce motion is enabled
 */
export function useReducedMotion(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    // Check initial state
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

/**
 * Hook to get accessibility info
 */
export function useAccessibilityInfo() {
  const screenReaderEnabled = useScreenReader();
  const reduceMotionEnabled = useReducedMotion();

  return {
    screenReaderEnabled,
    reduceMotionEnabled,
  };
}
