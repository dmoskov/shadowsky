import { useParams } from "react-router";
import { AccountSettings } from "../components/settings/AccountSettings";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { BookmarkSettings } from "../components/settings/BookmarkSettings";
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
      case "appearance":
        return <AppearanceSettings />;
      case "notifications":
        return <NotificationSettings />;
      case "privacy":
        return <PrivacySettings />;
      case "bookmarks":
        return <BookmarkSettings />;
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
