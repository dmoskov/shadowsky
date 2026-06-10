import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Button } from "./ui/Button";
import { Modal as ModalShell, ModalClose, ModalFooter } from "./ui/Modal";

export type ModalType = "alert" | "confirm";
export type ModalVariant = "info" | "warning" | "error" | "success";

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
  info: "text-asph-info",
  warning: "text-asph-warning",
  error: "text-asph-error",
  success: "text-asph-success",
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
  const Icon = variantIcons[variant];
  const iconColor = variantColors[variant];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      labelledBy="modal-title"
      describedBy="modal-description"
      closeOnBackdrop={type === "alert"}
      className="bg-asph-bg-secondary"
    >
      {(close) => (
        <>
          <div className="flex items-start gap-3 p-6">
            <Icon
              className={`mt-1 h-6 w-6 flex-shrink-0 ${iconColor}`}
              aria-hidden="true"
            />
            <div className="flex-1">
              {title && (
                <h3
                  id="modal-title"
                  className="mb-2 text-lg font-semibold text-asph-text-primary"
                >
                  {title}
                </h3>
              )}
              <div
                id="modal-description"
                className="whitespace-pre-wrap text-asph-text-secondary"
              >
                {message}
              </div>
            </div>
            <ModalClose className="touch-target-icon p-1" />
          </div>

          <ModalFooter className="bg-asph-bg-tertiary px-6 py-4">
            {type === "confirm" && (
              <Button
                variant="ghost"
                className="touch-target-sm"
                onClick={close}
              >
                {cancelText}
              </Button>
            )}
            <Button
              variant="primary"
              className="touch-target-sm"
              onClick={() => {
                if (onConfirm) {
                  onConfirm();
                }
                close();
              }}
            >
              {confirmText}
            </Button>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
}
