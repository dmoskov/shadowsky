import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const IDLE_TIMEOUT_MS = 2000;

interface ScrollChromeContextValue {
  /** Whether the chrome (top header + bottom tab bar) should be visible */
  chromeVisible: boolean;
  /** Call on every scroll event to trigger chrome hiding + reset idle timer */
  onScrollActivity: () => void;
  /** Force-show chrome (e.g. when near top, on tab press) */
  showChrome: () => void;
}

const ScrollChromeContext = createContext<ScrollChromeContextValue>({
  chromeVisible: true,
  onScrollActivity: () => {},
  showChrome: () => {},
});

export function ScrollChromeProvider({ children }: { children: React.ReactNode }) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showChrome = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setChromeVisible(true);
  }, []);

  const onScrollActivity = useCallback(() => {
    setChromeVisible(false);

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setChromeVisible(true);
      idleTimerRef.current = null;
    }, IDLE_TIMEOUT_MS);
  }, []);

  return (
    <ScrollChromeContext.Provider value={{ chromeVisible, onScrollActivity, showChrome }}>
      {children}
    </ScrollChromeContext.Provider>
  );
}

export function useScrollChrome() {
  return useContext(ScrollChromeContext);
}
