import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  ConfirmDestructiveDialog,
  DestructiveActionSeverity,
} from "../components/ConfirmDestructiveDialog";
import { Modal, ModalType, ModalVariant } from "../components/Modal";

interface ModalOptions {
  type: ModalType;
  variant?: ModalVariant;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

export interface DestructiveConfirmOptions {
  /** Title of the destructive dialog */
  title: string;
  /** Description of what will happen */
  message: string;
  /** Text the user must type to confirm (for high-risk actions) */
  requireTypeConfirmation?: string;
  /** Label for the confirm button */
  confirmButtonLabel?: string;
  /** Label for the cancel button */
  cancelButtonLabel?: string;
  /** Severity level of the action */
  severity?: DestructiveActionSeverity;
  /** Whether the action can be undone */
  canUndo?: boolean;
  /** Additional warning message */
  warningMessage?: string;
}

interface ModalContextType {
  showAlert: (message: string, options?: Partial<ModalOptions>) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: Partial<ModalOptions>,
  ) => Promise<boolean>;
  /** Show a destructive confirmation dialog with warning styling */
  showDestructiveConfirm: (
    options: DestructiveConfirmOptions,
    onConfirm: () => void | Promise<void>,
  ) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | null>(null);

interface DestructiveDialogState extends DestructiveConfirmOptions {
  onConfirm: () => void | Promise<void>;
  isProcessing: boolean;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ModalOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [destructiveState, setDestructiveState] =
    useState<DestructiveDialogState | null>(null);
  const [isDestructiveOpen, setIsDestructiveOpen] = useState(false);
  const resolveDestructiveRef = React.useRef<((value: boolean) => void) | null>(
    null,
  );

  const showAlert = useCallback(
    (message: string, options?: Partial<ModalOptions>) => {
      setModalState({
        type: "alert",
        message,
        variant: options?.variant || "info",
        title: options?.title,
        confirmText: options?.confirmText || "OK",
      });
      setIsOpen(true);
    },
    [],
  );

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      options?: Partial<ModalOptions>,
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setModalState({
          type: "confirm",
          message,
          variant: options?.variant || "info",
          title: options?.title,
          confirmText: options?.confirmText || "OK",
          cancelText: options?.cancelText || "Cancel",
          onConfirm: () => {
            onConfirm();
            resolve(true);
          },
        });
        setIsOpen(true);
      });
    },
    [],
  );

  const showDestructiveConfirm = useCallback(
    (
      options: DestructiveConfirmOptions,
      onConfirm: () => void | Promise<void>,
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveDestructiveRef.current = resolve;
        setDestructiveState({
          ...options,
          onConfirm,
          isProcessing: false,
        });
        setIsDestructiveOpen(true);
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setModalState(null), 300); // Clear state after animation
  }, []);

  const handleDestructiveClose = useCallback(() => {
    setIsDestructiveOpen(false);
    resolveDestructiveRef.current?.(false);
    resolveDestructiveRef.current = null;
    setTimeout(() => setDestructiveState(null), 300); // Clear state after animation
  }, []);

  const handleDestructiveConfirm = useCallback(async () => {
    if (!destructiveState) return;

    setDestructiveState((prev) =>
      prev ? { ...prev, isProcessing: true } : null,
    );

    try {
      await destructiveState.onConfirm();
      setIsDestructiveOpen(false);
      resolveDestructiveRef.current?.(true);
      resolveDestructiveRef.current = null;
      setTimeout(() => setDestructiveState(null), 300);
    } catch (error) {
      console.error("Destructive action failed:", error);
      setDestructiveState((prev) =>
        prev ? { ...prev, isProcessing: false } : null,
      );
    }
  }, [destructiveState]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({ showAlert, showConfirm, showDestructiveConfirm }),
    [showAlert, showConfirm, showDestructiveConfirm],
  );

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {modalState && (
        <Modal isOpen={isOpen} onClose={handleClose} {...modalState} />
      )}
      {destructiveState && (
        <ConfirmDestructiveDialog
          isOpen={isDestructiveOpen}
          onClose={handleDestructiveClose}
          onConfirm={handleDestructiveConfirm}
          title={destructiveState.title}
          message={destructiveState.message}
          requireTypeConfirmation={destructiveState.requireTypeConfirmation}
          confirmButtonLabel={destructiveState.confirmButtonLabel}
          cancelButtonLabel={destructiveState.cancelButtonLabel}
          severity={destructiveState.severity}
          canUndo={destructiveState.canUndo}
          warningMessage={destructiveState.warningMessage}
          isProcessing={destructiveState.isProcessing}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
