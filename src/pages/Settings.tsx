import { useParams } from "react-router";
import { AccessibilitySettings } from "../components/settings/AccessibilitySettings";
import { AccountSettings } from "../components/settings/AccountSettings";
import { AccountsSettings } from "../components/settings/AccountsSettings";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { ComposerSettings } from "../components/settings/ComposerSettings";
import { ContentModerationSettings } from "../components/settings/ContentModerationSettings";
import { DataSettings } from "../components/settings/DataSettings";
import { HelpSettings } from "../components/settings/HelpSettings";
import { MediaCacheSettings } from "../components/settings/MediaCacheSettings";
import { ModerationHistorySettings } from "../components/settings/ModerationHistorySettings";
import { NotificationSettings } from "../components/settings/NotificationSettings";
import { PerformanceSettings } from "../components/settings/PerformanceSettings";
import { PrivacySettings } from "../components/settings/PrivacySettings";
import { SettingsLayout } from "../components/settings/SettingsLayout";

export const Settings = () => {
  const { section } = useParams<{ section?: string }>();

  const renderSection = () => {
    switch (section) {
      case "account":
        return <AccountSettings />;
      case "accounts":
        return <AccountsSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "accessibility":
        return <AccessibilitySettings />;
      case "composer":
        return <ComposerSettings />;
      case "notifications":
        return <NotificationSettings />;
      case "privacy":
        return <PrivacySettings />;
      case "moderation":
        return <ContentModerationSettings />;
      case "data":
        return <DataSettings />;
      case "media-cache":
        return <MediaCacheSettings />;
      case "moderation-history":
        return <ModerationHistorySettings />;
      case "performance":
        return <PerformanceSettings />;
      case "help":
        return <HelpSettings />;
      default:
        // Default to account settings
        return <AccountSettings />;
    }
  };

  return (
    <SettingsLayout activeSection={section || "account"}>
      {renderSection()}
    </SettingsLayout>
  );
};
