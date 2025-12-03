import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastData, ToastType } from "../contexts/ToastContext";

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const COUNTDOWN_UPDATE_INTERVAL = 100; // Update countdown every 100ms for smooth animation

const TOAST_ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: "bg-bsky-success",
  error: "bg-bsky-error",
  warning: "bg-bsky-warning",
  info: "bg-bsky-info",
};

const TOAST_BORDER_COLORS: Record<ToastType, string> = {
  success: "border-l-bsky-success",
  error: "border-l-bsky-error",
  warning: "border-l-bsky-warning",
  info: "border-l-bsky-info",
};

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

export function Toast({ toast, onDismiss }: ToastProps) {
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
      className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border border-l-4 border-bsky-border-primary bg-bsky-bg-secondary p-4 shadow-lg ${borderColorClass} ${isExiting ? "animate-toast-out" : "animate-toast-in"} ${isDragging ? "cursor-grabbing" : "cursor-grab"} `}
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
        <div className="flex items-center gap-2">
          <p className="flex-1 break-words text-sm font-medium text-bsky-text-primary">
            {toast.message}
          </p>
          {/* Countdown timer */}
          {toast.showCountdown && remainingTime > 0 && (
            <span className="flex-shrink-0 font-mono text-xs text-bsky-text-secondary">
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
            className="hover:bg-bsky-primary-hover mt-2 rounded-md bg-bsky-primary px-3 py-1.5 text-xs font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-bsky-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {toast.action.label}
          </button>
        )}
        {/* Progress bar for countdown */}
        {toast.showCountdown && toast.duration > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bsky-bg-tertiary">
            <div
              className="h-full bg-bsky-warning transition-all duration-100 ease-linear"
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
          className="flex-shrink-0 rounded-md p-1 text-bsky-text-tertiary transition-colors duration-150 hover:bg-bsky-bg-hover hover:text-bsky-text-primary focus:outline-none focus:ring-2 focus:ring-bsky-primary"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <>
      {/* ARIA live region for screen readers */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {toasts.map((toast) => (
          <div key={toast.id}>
            {toast.type}: {toast.message}
          </div>
        ))}
      </div>

      {/* Visual toast container - bottom-right, stacking upward */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-h-screen flex-col-reverse gap-2 overflow-hidden"
        style={{ maxHeight: "calc(100vh - 32px)" }}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}
