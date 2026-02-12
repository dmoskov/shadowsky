import { ArrowRight, Database, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LOCAL_STORAGE_KEYS } from "../services/storage/storage-constants";

export const ColumnMigrationNotice: React.FC = () => {
  const navigate = useNavigate();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Check if we've migrated columns and haven't shown the notice yet
    const migrated = localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMNS_MIGRATED);
    const noticeShown = localStorage.getItem(
      LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN,
    );

    if (migrated === "true" && !noticeShown) {
      setShowNotice(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN,
      "true",
    );
    setShowNotice(false);
  };

  const handleGoToSettings = () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN,
      "true",
    );
    setShowNotice(false);
    navigate("/settings/data");
  };

  if (!showNotice) return null;

  return (
    <div
      className="fixed bottom-4 right-4 max-w-md rounded-lg p-4 shadow-lg"
      style={{
        backgroundColor: "var(--asph-bg-secondary)",
        border: "1px solid var(--asph-border-primary)",
        zIndex: 1000,
      }}
    >
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 text-blue-500" />
        <div className="flex-1">
          <h3
            className="mb-1 font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Column Storage Updated
          </h3>
          <p
            className="mb-3 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Your columns have been migrated to the new storage system. You can
            now sync them across devices using AT Protocol!
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGoToSettings}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Enable Sync
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Dismiss"
        >
          <X
            className="h-4 w-4"
            style={{ color: "var(--asph-text-tertiary)" }}
          />
        </button>
      </div>
    </div>
  );
};
