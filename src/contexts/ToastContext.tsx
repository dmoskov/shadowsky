import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastContainer } from "../components/Toast";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  dismissible?: boolean;
  /** Action button to show in the toast */
  action?: ToastAction;
  /** Whether to show a countdown timer (useful for undo actions) */
  showCountdown?: boolean;
  /** Callback when toast expires (after countdown) */
  onExpire?: () => void;
}

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  dismissible: boolean;
  createdAt: number;
  /** Action button to show in the toast */
  action?: ToastAction;
  /** Whether to show a countdown timer */
  showCountdown?: boolean;
  /** Callback when toast expires */
  onExpire?: () => void;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
  /** Show an undo toast with countdown and action */
  showUndoToast: (
    message: string,
    onUndo: () => void,
    onExpire: () => void,
    duration?: number,
  ) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdCounter = useRef(0);

  const showToast = useCallback(
    (message: string, options?: ToastOptions): string => {
      const id = `toast-${++toastIdCounter.current}-${Date.now()}`;
      const type = options?.type ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];
      const dismissible = options?.dismissible ?? true;

      const newToast: ToastData = {
        id,
        message,
        type,
        duration,
        dismissible,
        createdAt: Date.now(),
        action: options?.action,
        showCountdown: options?.showCountdown,
        onExpire: options?.onExpire,
      };

      setToasts((prev) => [...prev, newToast]);

      return id;
    },
    [],
  );

  const showUndoToast = useCallback(
    (
      message: string,
      onUndo: () => void,
      onExpire: () => void,
      duration = 5000,
    ): string => {
      return showToast(message, {
        type: "warning",
        duration,
        dismissible: false,
        showCountdown: true,
        action: {
          label: "Undo",
          onClick: onUndo,
        },
        onExpire,
      });
    },
    [showToast],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({ showToast, dismissToast, dismissAllToasts, showUndoToast }),
    [showToast, dismissToast, dismissAllToasts, showUndoToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
