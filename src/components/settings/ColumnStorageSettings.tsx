import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Columns, Database } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { columnService } from "../../services/column-service";
import {
  StorageOption,
  StorageOptionSelector,
  StorageType,
} from "./StorageOptionSelector";

export const ColumnStorageSettings: React.FC = () => {
  const { agent } = useAuth();
  const { showConfirm } = useModal();
  const [storageType, setStorageType] = useState<StorageType>("local");
  const [isLoading, setIsLoading] = useState(false);
  const [columnCount, setColumnCount] = useState(0);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Get current storage type from app preferences
  const { data: appPreferences } = useQuery({
    queryKey: ["appPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      appPreferencesService.setAgent(agent);
      return await appPreferencesService.getPreferences();
    },
    enabled: !!agent,
  });

  // Load storage type from preferences
  useEffect(() => {
    if (appPreferences) {
      setStorageType(appPreferences.columnStorageType || "local");
    }
  }, [appPreferences]);

  // Load column count
  useEffect(() => {
    const loadCount = async () => {
      try {
        const count = await columnService.getColumnCount();
        setColumnCount(count);
      } catch (error) {
        console.error("Failed to load column count:", error);
      }
    };
    loadCount();
  }, [storageType]);

  const handleStorageChange = async (newType: StorageType) => {
    if (!agent) {
      setMessage({
        type: "error",
        text: "Authentication required. Please log in again.",
      });
      return;
    }

    // Show warning for custom records
    if (newType === "custom") {
      await showConfirm(
        "⚠️ WARNING: Custom records are PUBLIC!\n\n" +
          "Anyone can view your column configuration if you use this storage method. " +
          "Your home column layout will be visible to anyone who knows how to query AT Protocol records.\n\n" +
          "Are you sure you want to make your column configuration public?",
        async () => {
          // User confirmed - proceed with storage change
          await performStorageChange(newType);
        },
        {
          variant: "warning",
          title: "Public Column Storage",
          confirmText: "Make Public",
          cancelText: "Cancel",
        },
      );
      return;
    }

    // For non-custom storage, proceed directly
    await performStorageChange(newType);
  };

  const performStorageChange = async (newType: StorageType) => {
    if (!agent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Ensure column service has the current agent
      columnService.setAgent(agent);

      // First, migrate existing columns to new storage
      await columnService.migrateStorage(storageType as any, newType as any);

      // Update app preferences in PDS
      appPreferencesService.setAgent(agent);
      await appPreferencesService.updatePreferences({
        columnStorageType: newType as any,
      });

      setStorageType(newType);
      setMessage({
        type: "success",
        text: `Columns migrated to ${getStorageName(newType)} successfully! Reloading page...`,
      });

      // Refresh preferences
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });

      // Update column count
      const count = await columnService.getColumnCount();
      setColumnCount(count);

      // Reload the page to ensure the column service reinitializes with new storage
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to change column storage:", error);
      setMessage({
        type: "error",
        text: "Failed to migrate columns. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStorageName = (type: StorageType) => {
    switch (type) {
      case "local":
        return "Local Storage";
      case "custom":
        return "Custom Records";
    }
  };

  const storageOptions: StorageOption[] = [
    {
      type: "local",
      name: "Local Storage",
      icon: Database,
      description:
        "Store column configuration on this device only. Private and fast.",
      pros: ["Private", "Works offline", "No sync"],
      cons: ["No cross-device sync", "Lost if browser data cleared"],
    },
    {
      type: "custom",
      name: "Custom Records (PUBLIC)",
      icon: Cloud,
      description:
        "Store column configuration as AT Protocol records. WARNING: These are publicly visible to anyone!",
      pros: ["Cross-device sync"],
      cons: [
        "PUBLIC - Anyone can see your columns!",
        "Experimental",
        "May not work with other clients",
      ],
      warning:
        "Anyone can view your column configuration with this storage method!",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Home Columns Storage
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Choose how your home column configuration is stored
        </p>
      </div>

      <StorageOptionSelector
        options={storageOptions}
        selectedType={storageType}
        onSelect={handleStorageChange as any}
        isLoading={isLoading}
      />

      {message && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor:
              message.type === "success"
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#22c55e" : "#ef4444",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(34, 197, 94, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <Columns size={16} style={{ color: "var(--bsky-text-secondary)" }} />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Current Columns
          </span>
        </div>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          You have {columnCount} columns configured using{" "}
          {getStorageName(storageType)}.
        </p>
      </div>
    </div>
  );
};
