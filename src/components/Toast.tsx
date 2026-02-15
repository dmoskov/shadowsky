import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Layers,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ToastData,
  ToastPriority,
  ToastType,
} from "../contexts/ToastContext";

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  /** Position in the visible stack (0 = most recent) */
  stackPosition?: number;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  /** Number of toasts queued but not visible */
  queuedCount?: number;
}

const COUNTDOWN_UPDATE_INTERVAL = 100; // Update countdown every 100ms for smooth animation

const TOAST_ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: "bg-asph-success",
  error: "bg-asph-error",
  warning: "bg-asph-warning",
  info: "bg-asph-info",
};

const TOAST_BORDER_COLORS: Record<ToastType, string> = {
  success: "border-l-asph-success",
  error: "border-l-asph-error",
  warning: "border-l-asph-warning",
  info: "border-l-asph-info",
};

/** Priority indicator styling */
const PRIORITY_INDICATORS: Record<
  ToastPriority,
  { label: string; className: string } | null
> = {
  low: null, // No indicator for low priority
  normal: null, // No indicator for normal priority
  high: { label: "High Priority", className: "bg-asph-warning text-white" },
  urgent: { label: "Urgent", className: "bg-asph-error text-white" },
};

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

export function Toast({
  toast,
  onDismiss,
  stackPosition: _stackPosition = 0,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [remainingTime, setRemainingTime] = useState(toast.duration);
  const [actionTriggered, setActionTriggered] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const Icon = TOAST_ICONS[toast.type];
  const colorClass = TOAST_COLORS[toast.type];
  const borderColorClass = TOAST_BORDER_COLORS[toast.type];
  const priorityIndicator = PRIORITY_INDICATORS[toast.priority];

  const dismiss = useCallback(
    (skipExpire = false) => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      // Only call onExpire if toast wasn't dismissed via action and not skipped
      if (!skipExpire && !actionTriggered && toast.onExpire) {
        toast.onExpire();
      }
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    },
    [actionTriggered, onDismiss, toast.id, toast.onExpire],
  );

  const handleAction = useCallback(() => {
    if (toast.action && !actionTriggered) {
      setActionTriggered(true);
      toast.action.onClick();
      // Dismiss immediately after action, skip expire callback
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }
  }, [actionTriggered, onDismiss, toast.action, toast.id]);

  // Handle countdown timer for undo toasts
  useEffect(() => {
    if (toast.showCountdown && toast.duration > 0 && !isDragging) {
      const startTime = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, toast.duration - elapsed);
        setRemainingTime(remaining);

        if (remaining <= 0) {
          clearInterval(countdownRef.current);
        }
      }, COUNTDOWN_UPDATE_INTERVAL);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [toast.showCountdown, toast.duration, isDragging]);

  useEffect(() => {
    if (toast.duration > 0 && !isDragging) {
      timeoutRef.current = setTimeout(() => dismiss(false), toast.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.duration, isDragging, dismiss]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!toast.dismissible) return;

    startXRef.current = e.touches[0].clientX;
    startTimeRef.current = Date.now();
    setIsDragging(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !toast.dismissible) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    setTranslateX(Math.max(0, diff));
  };

  const handleTouchEnd = () => {
    if (!isDragging || !toast.dismissible) return;

    const elapsed = Date.now() - startTimeRef.current;
    const velocity = translateX / elapsed;

    if (translateX > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      setTranslateX(300);
      setTimeout(() => onDismiss(toast.id), 200);
    } else {
      setTranslateX(0);
      setIsDragging(false);

      if (toast.duration > 0) {
        timeoutRef.current = setTimeout(dismiss, toast.duration);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!toast.dismissible) return;

    startXRef.current = e.clientX;
    startTimeRef.current = Date.now();
    setIsDragging(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      setTranslateX(Math.max(0, diff));
    };

    const handleMouseUp = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const velocity = translateX / elapsed;

      if (translateX > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
        setTranslateX(300);
        setTimeout(() => onDismiss(toast.id), 200);
      } else {
        setTranslateX(0);
        setIsDragging(false);

        if (toast.duration > 0) {
          timeoutRef.current = setTimeout(dismiss, toast.duration);
        }
      }

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border border-l-4 border-asph-border-primary bg-asph-bg-secondary p-4 shadow-lg ${borderColorClass} ${isExiting ? "animate-toast-spring-out" : "animate-toast-spring-in"} ${isDragging ? "cursor-grabbing" : "cursor-grab"} `}
      style={{
        transform: `translateX(${translateX}px)`,
        opacity: translateX > 0 ? 1 - translateX / 300 : 1,
        transition: isDragging
          ? "none"
          : "transform 200ms ease-out, opacity 200ms ease-out",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`flex-shrink-0 rounded-full p-1 ${colorClass} bg-opacity-20`}
      >
        <Icon
          className={`h-5 w-5 ${colorClass.replace("bg-", "text-")}`}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* Priority indicator badge */}
        {priorityIndicator && (
          <span
            className={`mb-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${priorityIndicator.className}`}
          >
            {priorityIndicator.label}
          </span>
        )}
        <div className="flex items-center gap-2">
          <p className="flex-1 break-words text-sm font-medium text-asph-text-primary">
            {toast.message}
          </p>
          {/* Countdown timer */}
          {toast.showCountdown && remainingTime > 0 && (
            <span className="flex-shrink-0 font-mono text-xs text-asph-text-secondary">
              {Math.ceil(remainingTime / 1000)}s
            </span>
          )}
        </div>
        {/* Action button */}
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAction();
            }}
            disabled={actionTriggered}
            className="hover:bg-asph-primary-hover mt-2 min-h-[44px] rounded-md bg-asph-primary px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asph-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {toast.action.label}
          </button>
        )}
        {/* Progress bar for countdown */}
        {toast.showCountdown && toast.duration > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-asph-bg-tertiary">
            <div
              className="h-full bg-asph-warning transition-all duration-100 ease-linear"
              style={{
                width: `${(remainingTime / toast.duration) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {toast.dismissible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(true);
          }}
          className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md p-2 text-asph-text-tertiary transition-colors duration-150 hover:bg-asph-bg-hover hover:text-asph-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asph-primary"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
  queuedCount = 0,
}: ToastContainerProps) {
  return (
    <>
      {/* ARIA live region for screen readers */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {toasts.map((toast) => (
          <div key={toast.id}>
            {toast.type}: {toast.message}
          </div>
        ))}
        {queuedCount > 0 && (
          <div>
            {queuedCount} more notification{queuedCount > 1 ? "s" : ""} in queue
          </div>
        )}
      </div>

      {/* Visual toast container - bottom-right, stacking upward */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-h-screen flex-col-reverse gap-2 overflow-hidden"
        style={{ maxHeight: "calc(100vh - 32px)" }}
      >
        {/* Queue indicator - shows when there are more toasts waiting */}
        {queuedCount > 0 && (
          <div
            className="pointer-events-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-lg border border-asph-border-primary bg-asph-bg-tertiary px-3 py-2 text-xs text-asph-text-secondary shadow-sm"
            role="status"
            aria-label={`${queuedCount} more notification${queuedCount > 1 ? "s" : ""} waiting`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              +{queuedCount} more notification{queuedCount > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Visible toasts */}
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            stackPosition={index}
          />
        ))}
      </div>
    </>
  );
}
