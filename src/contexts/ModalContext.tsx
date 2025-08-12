import React, { createContext, useCallback, useContext, useState } from "react";
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

interface ModalContextType {
  showAlert: (message: string, options?: Partial<ModalOptions>) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: Partial<ModalOptions>,
  ) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ModalOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setModalState(null), 300); // Clear state after animation
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modalState && (
        <Modal isOpen={isOpen} onClose={handleClose} {...modalState} />
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
