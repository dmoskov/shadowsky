import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

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
  if (!isOpen) return null;

  const Icon = variantIcons[variant];
  const iconColor = variantColors[variant];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={type === "alert" ? onClose : undefined}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6">
          <Icon className={`mt-1 h-6 w-6 flex-shrink-0 ${iconColor}`} />
          <div className="flex-1">
            {title && (
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
            )}
            <div className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
              {message}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          {type === "confirm" && (
            <button
              onClick={onClose}
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
