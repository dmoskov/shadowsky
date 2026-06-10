import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

type ModalState = "entering" | "open" | "exiting" | "closed";

export type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

const sizeClasses: Record<ModalSize, string> = {
  sm: "modal-sm",
  md: "modal-md",
  lg: "modal-lg",
  xl: "modal-xl",
  "2xl": "modal-2xl",
  "3xl": "modal-3xl",
  "4xl": "modal-4xl",
  "5xl": "modal-5xl",
};

const ModalCloseContext = createContext<(() => void) | null>(null);

export interface ModalProps {
  isOpen: boolean;
  /** Called once the exit animation has finished. */
  onClose?: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  size?: ModalSize;
  autoHeight?: boolean;
  role?: "dialog" | "alertdialog";
  labelledBy?: string;
  describedBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  backdropClassName?: string;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  size = "md",
  autoHeight = true,
  role = "dialog",
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  backdropClassName = "",
  className = "",
}: ModalProps) {
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

  const close = useCallback(() => {
    setModalState("exiting");
  }, []);

  const handleEntranceEnd = useCallback(() => {
    if (modalState === "entering") {
      setModalState("open");
    }
  }, [modalState]);

  const handleExitEnd = useCallback(() => {
    if (modalState === "exiting") {
      setModalState("closed");
      onClose?.();
    }
  }, [modalState, onClose]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (modalState === "entering" || modalState === "open")
      ) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, modalState, close]);

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
    <ModalCloseContext.Provider value={close}>
      <div
        className={`modal-backdrop ${backdropAnimationClass} ${backdropClassName}`.trim()}
        onClick={closeOnBackdrop ? close : undefined}
        onAnimationEnd={isExiting ? handleExitEnd : undefined}
        role="presentation"
        data-state={modalState}
      >
        <div
          ref={containerRef}
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={`modal-container ${autoHeight ? "modal-auto-height " : ""}${sizeClasses[size]} ${contentAnimationClass} ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={isEntering ? handleEntranceEnd : undefined}
          data-state={modalState}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      </div>
    </ModalCloseContext.Provider>
  );
}

export function ModalHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`modal-header ${className}`.trim()} {...props} />;
}

export function ModalTitle({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`modal-title ${className}`.trim()} {...props} />;
}

export function ModalBody({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`modal-body ${className}`.trim()} {...props} />;
}

export function ModalFooter({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`modal-footer ${className}`.trim()} {...props} />;
}

export function ModalClose({
  className = "",
  onClick,
  children,
  "aria-label": ariaLabel = "Close dialog",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const close = useContext(ModalCloseContext);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`modal-close ${className}`.trim()}
      onClick={(e) => {
        onClick?.(e);
        close?.();
      }}
      {...props}
    >
      {children ?? <X className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
