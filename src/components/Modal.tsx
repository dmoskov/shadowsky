import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

export type ModalType = "alert" | "confirm";
export type ModalVariant = "info" | "warning" | "error" | "success";
type ModalState = "entering" | "open" | "exiting" | "closed";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
  variant?: ModalVariant;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

const variantIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const variantColors = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
  success: "text-green-600 dark:text-green-400",
};

export function Modal({
  isOpen,
  onClose,
  type,
  variant = "info",
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
}: ModalProps) {
  const [modalState, setModalState] = useState<ModalState>("closed");
  const containerRef = useFocusTrap<HTMLDivElement>(
    modalState === "entering" || modalState === "open",
  );

  // Handle isOpen prop changes
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

  // Transition from entering to open after entrance animation
  const handleEntranceEnd = useCallback(() => {
    if (modalState === "entering") {
      setModalState("open");
    }
  }, [modalState]);

  // Transition from exiting to closed after exit animation
  const handleExitEnd = useCallback(() => {
    if (modalState === "exiting") {
      setModalState("closed");
      onClose(); // Notify parent that modal has fully closed
    }
  }, [modalState, onClose]);

  const handleClose = useCallback(() => {
    setModalState("exiting");
  }, []);

  const Icon = variantIcons[variant];
  const iconColor = variantColors[variant];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    handleClose();
  };

  const handleBackdropClick = () => {
    if (type === "alert") {
      handleClose();
    }
  };

  // Don't render if modal is fully closed
  if (modalState === "closed") return null;

  // Determine animation classes based on state
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
      onClick={handleBackdropClick}
      onAnimationEnd={isExiting ? handleExitEnd : undefined}
      role="presentation"
      data-state={modalState}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        className={`modal-container modal-auto-height modal-md bg-white dark:bg-gray-900 ${contentAnimationClass}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={isEntering ? handleEntranceEnd : undefined}
        data-state={modalState}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6">
          <Icon
            className={`mt-1 h-6 w-6 flex-shrink-0 ${iconColor}`}
            aria-hidden="true"
          />
          <div className="flex-1">
            {title && (
              <h3
                id="modal-title"
                className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {title}
              </h3>
            )}
            <div
              id="modal-description"
              className="whitespace-pre-wrap text-gray-600 dark:text-gray-300"
            >
              {message}
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          {type === "confirm" && (
            <button
              onClick={handleClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
