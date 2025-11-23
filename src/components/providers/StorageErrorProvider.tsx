import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { draftService } from "../../services/draft-service";
import { useStorageErrorManager } from "../../services/storage/storage-error-manager";

/**
 * Provider component that sets up error handling for storage services
 * Should be rendered inside AuthContext and ModalContext
 */
export function StorageErrorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const { handleStorageError } = useStorageErrorManager();

  useEffect(() => {
    if (isAuthenticated) {
      // Set error callbacks for all storage services
      draftService.setErrorCallback(handleStorageError);
      // Note: bookmarkServiceV2 uses official AT Protocol API and doesn't need error callbacks
    }
  }, [isAuthenticated, handleStorageError]);

  return <>{children}</>;
}
