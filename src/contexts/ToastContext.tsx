import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastContainer } from "../components/Toast";

export type ToastType = "success" | "error" | "warning" | "info";

/** Toast priority levels for queue management */
export type ToastPriority = "low" | "normal" | "high" | "urgent";

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
  /** Priority level for queue ordering (default: normal) */
  priority?: ToastPriority;
  /** Group ID for deduplication - only one toast per group shown at a time */
  groupId?: string;
  /** Whether this toast should replace existing toasts with the same groupId */
  replaceGroup?: boolean;
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
  /** Priority level for queue ordering */
  priority: ToastPriority;
  /** Group ID for deduplication */
  groupId?: string;
}

/** Queue configuration options */
export interface ToastQueueConfig {
  /** Maximum number of visible toasts (default: 3) */
  maxVisible: number;
  /** Rate limit: minimum ms between toasts (default: 300) */
  rateLimitMs: number;
  /** Whether to enable grouping/deduplication (default: true) */
  enableGrouping: boolean;
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
  /** Get current queue stats */
  getQueueStats: () => { visible: number; queued: number; total: number };
  /** Update queue configuration */
  updateQueueConfig: (config: Partial<ToastQueueConfig>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

/** Priority weights for sorting (higher = shown first) */
const PRIORITY_WEIGHTS: Record<ToastPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

const DEFAULT_QUEUE_CONFIG: ToastQueueConfig = {
  maxVisible: 3,
  rateLimitMs: 300,
  enableGrouping: true,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // All toasts (both visible and queued)
  const [allToasts, setAllToasts] = useState<ToastData[]>([]);
  // Queue configuration
  const [queueConfig, setQueueConfig] =
    useState<ToastQueueConfig>(DEFAULT_QUEUE_CONFIG);
  // Rate limiting
  const lastToastTimeRef = useRef<number>(0);
  const pendingToastsRef = useRef<ToastData[]>([]);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const toastIdCounter = useRef(0);

  /**
   * Sort toasts by priority (urgent first) and then by creation time
   */
  const sortToastsByPriority = useCallback(
    (toasts: ToastData[]): ToastData[] => {
      return [...toasts].sort((a, b) => {
        const priorityDiff =
          PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // For same priority, urgent/high should be newest first, low/normal oldest first
        if (a.priority === "urgent" || a.priority === "high") {
          return b.createdAt - a.createdAt; // Newest first for high priority
        }
        return a.createdAt - b.createdAt; // Oldest first for normal priority
      });
    },
    [],
  );

  /**
   * Get visible toasts (limited by maxVisible) and queued toasts
   */
  const { visibleToasts, queuedToasts } = useMemo(() => {
    const sorted = sortToastsByPriority(allToasts);
    return {
      visibleToasts: sorted.slice(0, queueConfig.maxVisible),
      queuedToasts: sorted.slice(queueConfig.maxVisible),
    };
  }, [allToasts, queueConfig.maxVisible, sortToastsByPriority]);

  /**
   * Process pending toasts with rate limiting
   */
  const processPendingToasts = useCallback(() => {
    if (pendingToastsRef.current.length === 0) return;

    const now = Date.now();
    const timeSinceLastToast = now - lastToastTimeRef.current;

    if (timeSinceLastToast >= queueConfig.rateLimitMs) {
      // Process next pending toast
      const nextToast = pendingToastsRef.current.shift();
      if (nextToast) {
        lastToastTimeRef.current = now;
        setAllToasts((prev) => [...prev, nextToast]);
      }

      // Schedule next processing if more pending
      if (pendingToastsRef.current.length > 0) {
        rateLimitTimerRef.current = setTimeout(
          processPendingToasts,
          queueConfig.rateLimitMs,
        );
      }
    } else {
      // Schedule for when rate limit allows
      const delay = queueConfig.rateLimitMs - timeSinceLastToast;
      rateLimitTimerRef.current = setTimeout(processPendingToasts, delay);
    }
  }, [queueConfig.rateLimitMs]);

  /**
   * Add a toast to the queue with rate limiting
   */
  const addToastToQueue = useCallback(
    (toast: ToastData) => {
      const now = Date.now();
      const timeSinceLastToast = now - lastToastTimeRef.current;

      // Urgent toasts bypass rate limiting
      if (
        toast.priority === "urgent" ||
        timeSinceLastToast >= queueConfig.rateLimitMs
      ) {
        lastToastTimeRef.current = now;
        setAllToasts((prev) => [...prev, toast]);
      } else {
        // Add to pending queue
        pendingToastsRef.current.push(toast);
        // Schedule processing if not already scheduled
        if (!rateLimitTimerRef.current) {
          const delay = queueConfig.rateLimitMs - timeSinceLastToast;
          rateLimitTimerRef.current = setTimeout(processPendingToasts, delay);
        }
      }
    },
    [queueConfig.rateLimitMs, processPendingToasts],
  );

  // Cleanup rate limit timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions): string => {
      const id = `toast-${++toastIdCounter.current}-${Date.now()}`;
      const type = options?.type ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];
      const dismissible = options?.dismissible ?? true;
      const priority = options?.priority ?? "normal";
      const groupId = options?.groupId;

      // Handle grouping/deduplication
      if (groupId && queueConfig.enableGrouping) {
        if (options?.replaceGroup) {
          // Remove existing toasts with the same groupId
          setAllToasts((prev) =>
            prev.filter((toast) => toast.groupId !== groupId),
          );
          // Also remove from pending queue
          pendingToastsRef.current = pendingToastsRef.current.filter(
            (toast) => toast.groupId !== groupId,
          );
        } else {
          // Check if a toast with this groupId already exists
          const existingInQueue = allToasts.some(
            (toast) => toast.groupId === groupId,
          );
          const existingInPending = pendingToastsRef.current.some(
            (toast) => toast.groupId === groupId,
          );
          if (existingInQueue || existingInPending) {
            // Skip this toast, return the id of the existing one
            return id;
          }
        }
      }

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
        priority,
        groupId,
      };

      addToastToQueue(newToast);
      return id;
    },
    [addToastToQueue, allToasts, queueConfig.enableGrouping],
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
        priority: "high", // Undo toasts should have high priority
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
    setAllToasts((prev) => prev.filter((toast) => toast.id !== id));
    // Also remove from pending queue if present
    pendingToastsRef.current = pendingToastsRef.current.filter(
      (toast) => toast.id !== id,
    );
  }, []);

  const dismissAllToasts = useCallback(() => {
    setAllToasts([]);
    pendingToastsRef.current = [];
    if (rateLimitTimerRef.current) {
      clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = undefined;
    }
  }, []);

  const getQueueStats = useCallback(() => {
    return {
      visible: visibleToasts.length,
      queued: queuedToasts.length + pendingToastsRef.current.length,
      total: allToasts.length + pendingToastsRef.current.length,
    };
  }, [visibleToasts.length, queuedToasts.length, allToasts.length]);

  const updateQueueConfig = useCallback((config: Partial<ToastQueueConfig>) => {
    setQueueConfig((prev) => ({ ...prev, ...config }));
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      showToast,
      dismissToast,
      dismissAllToasts,
      showUndoToast,
      getQueueStats,
      updateQueueConfig,
    }),
    [
      showToast,
      dismissToast,
      dismissAllToasts,
      showUndoToast,
      getQueueStats,
      updateQueueConfig,
    ],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={visibleToasts}
        queuedCount={queuedToasts.length + pendingToastsRef.current.length}
        onDismiss={dismissToast}
      />
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
