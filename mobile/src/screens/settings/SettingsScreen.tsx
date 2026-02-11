import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { AccountSwitcher } from "../../components";
import { useAuth } from "../../contexts/AuthContext";

interface SettingsScreenProps {
  section?: string;
}

const SETTINGS_SECTIONS = [
  { id: "account", title: "Account", description: "Manage your account settings" },
  { id: "appearance", title: "Appearance", description: "Theme, colors, and display" },
  { id: "notifications", title: "Notifications", description: "Push and in-app notifications" },
  { id: "privacy", title: "Privacy", description: "Control your data and visibility" },
  { id: "accessibility", title: "Accessibility", description: "Screen reader and motion settings" },
  { id: "storage", title: "Storage", description: "Data sync and local storage" },
  { id: "about", title: "About", description: "App version and legal info" },
];

export function SettingsScreen({ section }: SettingsScreenProps) {
  const { signOut, accounts } = useAuth();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
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
      ],
    );
  };

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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <AccountSwitcher
          onAccountSwitch={() => {
            setShowAccountSwitcher(false);
            Alert.alert("Account Switched", "Successfully switched to the selected account.");
          }}
          onAddAccount={handleAddAccount}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      {section && (
        <Text style={styles.activeSection}>Active section: {section}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Management</Text>

        {accounts.length > 1 && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => setShowAccountSwitcher(true)}
          >
            <Text style={styles.itemTitle}>Switch Account</Text>
            <Text style={styles.itemDescription}>
              Manage and switch between {accounts.length} accounts
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.item} onPress={handleSignOut}>
          <Text style={[styles.itemTitle, styles.dangerText]}>Sign Out</Text>
          <Text style={styles.itemDescription}>
            Sign out of your current account
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        {SETTINGS_SECTIONS.map((item) => (
          <TouchableOpacity key={item.id} style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  header: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
    padding: 16,
    paddingTop: 24,
  },
  activeSection: {
    color: "#3b82f6",
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    minHeight: 44,
  },
  itemTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  itemDescription: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  dangerText: {
    color: "#F91880",
  },
  accountSwitcherHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#000",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#1DA1F2",
    fontSize: 16,
  },
});
