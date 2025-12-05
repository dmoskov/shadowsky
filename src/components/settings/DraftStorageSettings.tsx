import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Database, FileText } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { appPreferencesService } from "../../services/app-preferences-service";
import { draftService } from "../../services/draft-service";
import {
  StorageOption,
  StorageOptionSelector,
  StorageType,
} from "./StorageOptionSelector";

export const DraftStorageSettings: React.FC = () => {
  const { agent } = useAuth();
  const { showConfirm, showAlert } = useModal();
  const [storageType, setStorageType] = useState<StorageType>("local");
  const [isLoading, setIsLoading] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
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
      setStorageType(appPreferences.draftStorageType || "local");
    }
  }, [appPreferences]);

  // Load draft count
  useEffect(() => {
    const loadCount = async () => {
      try {
        const count = await draftService.getDraftCount();
        setDraftCount(count);
      } catch (error) {
        // Don't show alert for count loading errors - not critical
        console.error("Failed to load draft count:", error);
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
          "Anyone can view your draft posts if you use this storage method. " +
          "Your unpublished drafts, including any personal content or ideas, will be visible to anyone who knows how to query AT Protocol records.\n\n" +
          "Are you sure you want to make your drafts public?",
        async () => {
          // User confirmed - proceed with storage change
          await performStorageChange(newType);
        },
        {
          variant: "warning",
          title: "Public Draft Storage",
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
      // Ensure draft service has the current agent
      draftService.setAgent(agent);

      // First, migrate existing drafts to new storage
      await draftService.migrateStorage(storageType as any, newType as any);

      // Update app preferences in PDS
      appPreferencesService.setAgent(agent);
      await appPreferencesService.updatePreferences({
        draftStorageType: newType as any,
      });

      setStorageType(newType);
      setMessage({
        type: "success",
        text: `Drafts migrated to ${getStorageName(newType)} successfully! Reloading page...`,
      });

      // Refresh preferences
      await queryClient.invalidateQueries({ queryKey: ["appPreferences"] });

      // Update draft count
      const count = await draftService.getDraftCount();
      setDraftCount(count);

      // Reload the page to ensure the draft service reinitializes with new storage
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to change draft storage:", error);

      // Show more specific error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to migrate drafts. Please try again.";

      setMessage({
        type: "error",
        text: errorMessage,
      });

      // Also show alert for critical errors
      showAlert(errorMessage, {
        variant: "error",
        title: "Storage Migration Failed",
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
      name: "Browser Storage",
      icon: Database,
      description: "Store drafts on this device only. Private and secure.",
      pros: ["Private", "Works offline", "No sync"],
      cons: ["No cross-device sync", "Lost if browser data cleared"],
    },
    {
      type: "custom",
      name: "Custom AT Protocol (PUBLIC)",
      icon: Cloud,
      description:
        "Store drafts as custom AT Protocol records. WARNING: These are publicly visible to anyone!",
      pros: ["Cross-device sync"],
      cons: [
        "PUBLIC - Anyone can see your drafts!",
        "Experimental",
        "May not work with other clients",
      ],
      warning:
        "Anyone can read your unpublished drafts with this storage method!",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Post Drafts Storage
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Choose how your post drafts are stored
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
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-bsky-success/30 bg-bsky-success/10 text-bsky-success"
              : "border-bsky-error/30 bg-bsky-error/10 text-bsky-error"
          }`}
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
          <FileText size={16} style={{ color: "var(--bsky-text-secondary)" }} />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Current Drafts
          </span>
        </div>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          You have {draftCount} drafts stored using{" "}
          {getStorageName(storageType)}.
        </p>
      </div>
    </div>
  );
};
