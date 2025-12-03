import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { ToastContainer } from "../components/Toast";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  dismissible: boolean;
  createdAt: number;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
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
      };

      setToasts((prev) => [...prev, newToast]);

      return id;
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAllToasts }}>
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
