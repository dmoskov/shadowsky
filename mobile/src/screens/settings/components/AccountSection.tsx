import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "../../../hooks/useTranslation";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";
import {fontSize} from '../../../utils/typography';

interface AccountSectionProps {
  onShowAccountSwitcher: () => void;
}

export function AccountSection({ onShowAccountSwitcher }: AccountSectionProps) {
  const { signOut, accounts, account } = useAuth();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation();
  const sectionStyles = createSectionStyles(themeColors);
  const styles = createStyles(themeColors);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>
        {t("settings.section_account")}
      </Text>

      {account && (
        <View style={styles.accountInfo}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>
              {account.handle.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>
              {account.displayName || account.handle}
            </Text>
            <Text style={styles.accountHandle}>@{account.handle}</Text>
          </View>
        </View>
      )}

      {accounts.length > 1 && (
        <SettingRow
          label="Switch Account"
          description={`Manage ${accounts.length} accounts`}
          onPress={onShowAccountSwitcher}
          showChevron
        />
      )}

      <SettingRow
        label="Sign Out"
        onPress={handleSignOut}
        labelStyle={sectionStyles.dangerText}
      />
    </View>
  );
}

const createStyles = (themeColors: Record<string, string>) =>
  StyleSheet.create({
    accountInfo: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    accountAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: themeColors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    accountAvatarText: {
      color: themeColors.text,
      fontSize: fontSize.title3,
      fontWeight: "bold",
    },
    accountDetails: {
      flex: 1,
    },
    accountName: {
      color: themeColors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
      marginBottom: 2,
    },
    accountHandle: {
      color: themeColors.textSecondary,
      fontSize: fontSize.subheadline,
    },
  });
