import { useParams } from "react-router";
import { AccountSettings } from "../components/settings/AccountSettings";
import { AccountsSettings } from "../components/settings/AccountsSettings";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { ComposerSettings } from "../components/settings/ComposerSettings";
import { ContentModerationSettings } from "../components/settings/ContentModerationSettings";
import { DataSettings } from "../components/settings/DataSettings";
import { NotificationSettings } from "../components/settings/NotificationSettings";
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
