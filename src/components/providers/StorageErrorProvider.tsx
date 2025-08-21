import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";
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
      bookmarkServiceV2.setErrorCallback(handleStorageError);
    }
  }, [isAuthenticated, handleStorageError]);

  return <>{children}</>;
}
