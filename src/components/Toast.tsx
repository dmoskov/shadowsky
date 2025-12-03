import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from "lucide-react";
import type { ToastData, ToastType } from "../contexts/ToastContext";

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

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
  const toastRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const Icon = TOAST_ICONS[toast.type];
  const colorClass = TOAST_COLORS[toast.type];
  const borderColorClass = TOAST_BORDER_COLORS[toast.type];

  const dismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  useEffect(() => {
    if (toast.duration > 0 && !isDragging) {
      timeoutRef.current = setTimeout(dismiss, toast.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.duration, toast.id, isDragging]);

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
      className={`
        pointer-events-auto relative flex w-full max-w-sm items-start gap-3
        rounded-lg border border-bsky-border-primary border-l-4
        bg-bsky-bg-secondary p-4 shadow-lg
        ${borderColorClass}
        ${isExiting ? "animate-toast-out" : "animate-toast-in"}
        ${isDragging ? "cursor-grabbing" : "cursor-grab"}
      `}
      style={{
        transform: `translateX(${translateX}px)`,
        opacity: translateX > 0 ? 1 - translateX / 300 : 1,
        transition: isDragging ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div className={`flex-shrink-0 rounded-full p-1 ${colorClass} bg-opacity-20`}>
        <Icon
          className={`h-5 w-5 ${colorClass.replace("bg-", "text-")}`}
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-bsky-text-primary break-words">
          {toast.message}
        </p>
      </div>

      {toast.dismissible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="flex-shrink-0 rounded-md p-1 text-bsky-text-tertiary
                     hover:bg-bsky-bg-hover hover:text-bsky-text-primary
                     focus:outline-none focus:ring-2 focus:ring-bsky-primary
                     transition-colors duration-150"
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
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {toasts.map((toast) => (
          <div key={toast.id}>
            {toast.type}: {toast.message}
          </div>
        ))}
      </div>

      {/* Visual toast container - bottom-right, stacking upward */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2
                   pointer-events-none max-h-screen overflow-hidden"
        style={{ maxHeight: "calc(100vh - 32px)" }}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}
