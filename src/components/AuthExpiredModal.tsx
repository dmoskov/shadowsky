import { LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

type ModalState = "entering" | "open" | "exiting" | "closed";

interface AuthExpiredModalProps {
  isOpen: boolean;
  onReLogin: () => void;
  reason?: string;
}

export function AuthExpiredModal({
  isOpen,
  onReLogin,
  reason,
}: AuthExpiredModalProps) {
  const [modalState, setModalState] = useState<ModalState>("closed");
  const containerRef = useFocusTrap<HTMLDivElement>(
    modalState === "entering" || modalState === "open",
  );

  useEffect(() => {
    if (isOpen && modalState === "closed") {
      setModalState("entering");
    } else if (
      !isOpen &&
      (modalState === "entering" || modalState === "open")
    ) {
      setModalState("exiting");
    }
  }, [isOpen, modalState]);

  const handleEntranceEnd = useCallback(() => {
    if (modalState === "entering") {
      setModalState("open");
    }
  }, [modalState]);

  const handleExitEnd = useCallback(() => {
    if (modalState === "exiting") {
      setModalState("closed");
    }
  }, [modalState]);

  const handleReLogin = useCallback(() => {
    setModalState("exiting");
    onReLogin();
  }, [onReLogin]);

  if (modalState === "closed") return null;

  const isEntering = modalState === "entering";
  const isExiting = modalState === "exiting";

  const backdropAnimationClass = isEntering
    ? "animate-enter-fade"
    : isExiting
      ? "animate-exit-fade"
      : "";

  const contentAnimationClass = isEntering
    ? "animate-enter-scale"
    : isExiting
      ? "animate-exit-scale"
      : "";

  return (
    <div
      className={`modal-backdrop ${backdropAnimationClass}`}
      onAnimationEnd={isExiting ? handleExitEnd : undefined}
      role="presentation"
      data-state={modalState}
    >
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-expired-title"
        aria-describedby="auth-expired-description"
        className={`modal-container modal-auto-height modal-md bg-white dark:bg-gray-900 ${contentAnimationClass}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={isEntering ? handleEntranceEnd : undefined}
        data-state={modalState}
      >
        <div className="flex items-start gap-3 p-6">
          <LogOut
            className="mt-1 h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h3
              id="auth-expired-title"
              className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Session Expired
            </h3>
            <div
              id="auth-expired-description"
              className="text-asph-text-secondary"
            >
              <p className="mb-2">
                Your session has expired or your authentication is no longer
                valid. Please log in again to continue.
              </p>
              {reason && (
                <p className="text-sm text-asph-text-tertiary">
                  Reason: {reason}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={handleReLogin}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log In Again
          </button>
        </div>
      </div>
    </div>
  );
}
