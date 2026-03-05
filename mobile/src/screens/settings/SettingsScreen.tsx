import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AccountSwitcher } from "../../components";
import { ArrowLeftIcon } from "../../components/icons";
import { useAuth } from "../../contexts/AuthContext";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  AIFeaturesSection,
  AboutSection,
  AccountSection,
  AppearanceSection,
  ComposerSection,
  ContentSection,
  DataStorageSection,
  InteractionSection,
  ModerationSection,
  NotificationsSection,
  PrivacySection,
  SecuritySection,
} from "./components";
import {fontSize} from '../../utils/typography';

interface SettingsScreenProps {
  section?: string;
  onNavigateToBlockedAccounts?: () => void;
  onNavigateToMutedAccounts?: () => void;
}

export function SettingsScreen({
  section: _section,
  onNavigateToBlockedAccounts: _onNavigateToBlockedAccounts,
  onNavigateToMutedAccounts: _onNavigateToMutedAccounts,
}: SettingsScreenProps) {
  const { signOut } = useAuth();
  const { preferences } = usePreferences();
  const { colors: themeColors } = useTheme();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const styles = createStyles(themeColors);

  const handleAddAccount = () => {
    setShowAccountSwitcher(false);
    Alert.alert(
      "Add Account",
      "You will be taken to the sign-in screen to add another account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            try {
              await signOut();
            } catch {
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ],
    );
  };

  if (showAccountSwitcher) {
    return (
      <View style={styles.container}>
        <View style={styles.accountSwitcherHeader}>
          <TouchableOpacity
            onPress={() => setShowAccountSwitcher(false)}
            style={styles.backButton}
          >
            <View style={styles.backButtonContent}>
              <ArrowLeftIcon size={20} color={themeColors.info} />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
        </View>
        <AccountSwitcher
          onAccountSwitch={() => {
            setShowAccountSwitcher(false);
            Alert.alert(
              "Account Switched",
              "Successfully switched to the selected account.",
            );
          }}
          onAddAccount={handleAddAccount}
        />
      </View>
    );
  }

  if (!preferences) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardDismissMode="on-drag">
      <AccountSection
        onShowAccountSwitcher={() => setShowAccountSwitcher(true)}
      />
      <AppearanceSection />
      <ContentSection />
      <NotificationsSection />
      <PrivacySection />
      <InteractionSection />
      <SecuritySection />
      <ModerationSection />
      <ComposerSection />
      <DataStorageSection />
      <AIFeaturesSection />
      <AboutSection />
    </ScrollView>
  );
}

const createStyles = (themeColors: Record<string, string>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    loadingText: {
      color: themeColors.textSecondary,
      fontSize: fontSize.callout,
      textAlign: "center",
      marginTop: 24,
    },
    header: {
      color: themeColors.text,
      fontSize: fontSize.largeTitle,
      fontWeight: "bold",
      padding: 16,
      paddingTop: 24,
    },
    accountSwitcherHeader: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    backButton: {
      padding: 8,
    },
    backButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    backButtonText: {
      color: themeColors.info,
      fontSize: fontSize.callout,
    },
  });
