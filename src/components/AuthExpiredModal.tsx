import { LogOut } from "lucide-react";
import { Button } from "./ui/Button";
import { Modal, ModalFooter } from "./ui/Modal";

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
  return (
    <Modal
      isOpen={isOpen}
      size="md"
      role="alertdialog"
      labelledBy="auth-expired-title"
      describedBy="auth-expired-description"
      closeOnBackdrop={false}
      closeOnEscape={false}
      className="bg-asph-bg-secondary"
    >
      {(close) => (
        <>
          <div className="flex items-start gap-3 p-6">
            <LogOut
              className="mt-1 h-6 w-6 flex-shrink-0 text-asph-error"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h3
                id="auth-expired-title"
                className="mb-2 text-lg font-semibold text-asph-text-primary"
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

          <ModalFooter className="bg-asph-bg-tertiary px-6 py-4">
            <Button
              variant="primary"
              className="touch-target-sm flex items-center gap-2"
              onClick={() => {
                close();
                onReLogin();
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log In Again
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
