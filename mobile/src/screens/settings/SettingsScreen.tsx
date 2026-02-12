import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from "react-native";
import { AccountSwitcher } from "../../components";
import { useAuth } from "../../contexts/AuthContext";
import { usePreferences } from "../../contexts/PreferencesContext";
import { ArrowLeftIcon } from "../../components/icons";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../constants/theme";
import {
  registerBackgroundFetch,
  unregisterBackgroundFetch,
} from "../../services/background-fetch";
import { openLink } from "../../utils/browser";
import { useRouter } from "expo-router";

interface SettingsScreenProps {
  section?: string;
  onNavigateToBlockedAccounts?: () => void;
  onNavigateToMutedAccounts?: () => void;
}

const APP_VERSION = "0.7.0";

export function SettingsScreen({ section, onNavigateToBlockedAccounts, onNavigateToMutedAccounts }: SettingsScreenProps) {
  const { signOut, accounts, account } = useAuth();
  const { preferences, updatePreference } = usePreferences();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>("calculating...");

  // Calculate cache size on mount
  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    try {
      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      // Calculate approximate size of stored data
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      // Convert to KB or MB
      if (totalSize < 1024) {
        setCacheSize(`${totalSize} B`);
      } else if (totalSize < 1024 * 1024) {
        setCacheSize(`${(totalSize / 1024).toFixed(2)} KB`);
      } else {
        setCacheSize(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (error) {
      console.error("Failed to calculate cache size:", error);
      setCacheSize("unknown");
    }
  };

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

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data including posts, profiles, and images. Your settings and bookmarks will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear React Query cache
              queryClient.clear();

              // Calculate new size
              await calculateCacheSize();

              Alert.alert("Success", "Cache cleared successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const handleClearSearchHistory = () => {
    Alert.alert(
      "Clear Search History",
      "This will delete all your search history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("@shadowsky_search_history");
              Alert.alert("Success", "Search history cleared");
            } catch (error) {
              Alert.alert("Error", "Failed to clear search history");
            }
          },
        },
      ],
    );
  };

  const handleClearBookmarks = () => {
    Alert.alert(
      "Clear Bookmarks",
      "This will delete all your bookmarks. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("shadowsky_bookmarks");
              Alert.alert("Success", "Bookmarks cleared");
            } catch (error) {
              Alert.alert("Error", "Failed to clear bookmarks");
            }
          },
        },
      ],
    );
  };

  const handleOpenBluesky = async () => {
    try {
      await openLink("https://bsky.app");
    } catch (error) {
      Alert.alert("Error", "Cannot open Bluesky");
    }
  };

  const handleOpenGitHub = async () => {
    try {
      await openLink("https://github.com/yourusername/shadowsky");
    } catch (error) {
      Alert.alert("Error", "Cannot open GitHub");
    }
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
              <ArrowLeftIcon size={20} color="#1DA1F2" />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
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

  if (!preferences) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>

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
            onPress={() => setShowAccountSwitcher(true)}
            showChevron
          />
        )}

        <SettingRow
          label="Sign Out"
          onPress={handleSignOut}
          labelStyle={styles.dangerText}
        />
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APPEARANCE</Text>

        <SettingRow label="Theme">
          <View style={styles.themeSelector}>
            {(["dark", "light", "system"] as const).map((theme) => (
              <TouchableOpacity
                key={theme}
                style={[
                  styles.themeButton,
                  preferences.theme === theme && styles.themeButtonActive,
                ]}
                onPress={() => updatePreference("theme", theme)}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    preferences.theme === theme && styles.themeButtonTextActive,
                  ]}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>
      </View>

      {/* Content Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTENT</Text>

        <SettingRow label="Default Feed">
          <View style={styles.themeSelector}>
            {(["following", "discover"] as const).map((feed) => (
              <TouchableOpacity
                key={feed}
                style={[
                  styles.themeButton,
                  preferences.defaultFeed === feed && styles.themeButtonActive,
                ]}
                onPress={() => updatePreference("defaultFeed", feed)}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    preferences.defaultFeed === feed &&
                      styles.themeButtonTextActive,
                  ]}
                >
                  {feed.charAt(0).toUpperCase() + feed.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>

        <SettingRow
          label="Show NSFW Content"
          description="Display posts marked as sensitive"
        >
          <Switch
            value={preferences.showNSFW}
            onValueChange={(value) => updatePreference("showNSFW", value)}
            trackColor={{ false: "#374151", true: colors.primary }}
            thumbColor="#ffffff"
          />
        </SettingRow>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <SettingRow
          label="Enable Notifications"
          description="Master toggle for all notifications"
        >
          <Switch
            value={preferences.notificationsEnabled}
            onValueChange={(value) =>
              updatePreference("notificationsEnabled", value)
            }
            trackColor={{ false: "#374151", true: colors.primary }}
            thumbColor="#ffffff"
          />
        </SettingRow>

        {preferences.notificationsEnabled && (
          <>
            <SettingRow label="Likes">
              <Switch
                value={preferences.notifyOnLikes}
                onValueChange={(value) =>
                  updatePreference("notifyOnLikes", value)
                }
                trackColor={{ false: "#374151", true: colors.primary }}
                thumbColor="#ffffff"
              />
            </SettingRow>

            <SettingRow label="Replies">
              <Switch
                value={preferences.notifyOnReplies}
                onValueChange={(value) =>
                  updatePreference("notifyOnReplies", value)
                }
                trackColor={{ false: "#374151", true: colors.primary }}
                thumbColor="#ffffff"
              />
            </SettingRow>

            <SettingRow label="Follows">
              <Switch
                value={preferences.notifyOnFollows}
                onValueChange={(value) =>
                  updatePreference("notifyOnFollows", value)
                }
                trackColor={{ false: "#374151", true: colors.primary }}
                thumbColor="#ffffff"
              />
            </SettingRow>

            <SettingRow label="Mentions">
              <Switch
                value={preferences.notifyOnMentions}
                onValueChange={(value) =>
                  updatePreference("notifyOnMentions", value)
                }
                trackColor={{ false: "#374151", true: colors.primary }}
                thumbColor="#ffffff"
              />
            </SettingRow>

            <SettingRow label="Quotes">
              <Switch
                value={preferences.notifyOnQuotes}
                onValueChange={(value) =>
                  updatePreference("notifyOnQuotes", value)
                }
                trackColor={{ false: "#374151", true: colors.primary }}
                thumbColor="#ffffff"
              />
            </SettingRow>
          </>
        )}
      </View>

      {/* Moderation Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MODERATION</Text>

        <SettingRow
          label="Blocked Accounts"
          description="Manage accounts you've blocked"
          onPress={() => router.push("/(app)/settings/blocked")}
          showChevron
        />

        <SettingRow
          label="Muted Accounts"
          description="Manage accounts you've muted"
          onPress={() => router.push("/(app)/settings/muted")}
          showChevron
        />
      </View>

      {/* Data & Storage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATA & STORAGE</Text>

        <SettingRow
          label="Background Fetch"
          description="Pre-load fresh content when app is closed"
        >
          <Switch
            value={preferences.backgroundFetchEnabled}
            onValueChange={async (value) => {
              await updatePreference("backgroundFetchEnabled", value);
              if (value) {
                await registerBackgroundFetch();
              } else {
                await unregisterBackgroundFetch();
              }
            }}
            trackColor={{ false: "#374151", true: colors.primary }}
            thumbColor="#ffffff"
          />
        </SettingRow>

        <SettingRow label="Auto-play Videos">
          <View style={styles.themeSelector}>
            {(["always", "wifi", "never"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.themeButton,
                  styles.smallButton,
                  preferences.autoPlayVideos === option &&
                    styles.themeButtonActive,
                ]}
                onPress={() => updatePreference("autoPlayVideos", option)}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    styles.smallButtonText,
                    preferences.autoPlayVideos === option &&
                      styles.themeButtonTextActive,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>

        <SettingRow label="Image Quality">
          <View style={styles.themeSelector}>
            {(["high", "medium", "low"] as const).map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.themeButton,
                  styles.smallButton,
                  preferences.imageQuality === quality &&
                    styles.themeButtonActive,
                ]}
                onPress={() => updatePreference("imageQuality", quality)}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    styles.smallButtonText,
                    preferences.imageQuality === quality &&
                      styles.themeButtonTextActive,
                  ]}
                >
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>

        <SettingRow
          label="Cache Size"
          description={cacheSize}
          onPress={handleClearCache}
          showChevron
        />

        <SettingRow
          label="Clear Search History"
          onPress={handleClearSearchHistory}
          showChevron
        />

        <SettingRow
          label="Clear Bookmarks"
          onPress={handleClearBookmarks}
          labelStyle={styles.dangerText}
          showChevron
        />
      </View>

      {/* Accessibility Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCESSIBILITY</Text>

        <SettingRow
          label="Haptic Feedback"
          description="Vibrate on interactions like likes, reposts, and bookmarks"
        >
          <Switch
            value={preferences.hapticsEnabled}
            onValueChange={(value) => updatePreference("hapticsEnabled", value)}
            trackColor={{ false: "#374151", true: "#3b82f6" }}
            thumbColor="#ffffff"
          />
        </SettingRow>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>

        <SettingRow label="App Name" value="Asphodel" />

        <SettingRow label="Version" value={APP_VERSION} />

        <SettingRow
          label="View on Bluesky"
          onPress={handleOpenBluesky}
          showChevron
        />

        <SettingRow
          label="Report a Bug"
          onPress={handleOpenGitHub}
          showChevron
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Asphodel v{APP_VERSION}</Text>
        <Text style={styles.footerSubtext}>
          A third-party Bluesky client
        </Text>
      </View>
    </ScrollView>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  labelStyle?: object;
  showChevron?: boolean;
}

function SettingRow({
  label,
  description,
  value,
  onPress,
  children,
  labelStyle,
  showChevron,
}: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={[styles.settingLabel, labelStyle]}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {children}
        {showChevron && <Text style={styles.chevron}>›</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    marginTop: 24,
  },
  header: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
    padding: 16,
    paddingTop: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountAvatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  accountHandle: {
    color: "#9ca3af",
    fontSize: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    minHeight: 48,
  },
  settingLeft: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  settingDescription: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingValue: {
    color: "#9ca3af",
    fontSize: 14,
  },
  chevron: {
    color: "#6b7280",
    fontSize: 24,
    fontWeight: "300",
  },
  dangerText: {
    color: "#ef4444",
  },
  themeSelector: {
    flexDirection: "row",
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  themeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeButtonText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  themeButtonTextActive: {
    color: "#ffffff",
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  smallButtonText: {
    fontSize: 12,
  },
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
  },
  footerSubtext: {
    color: "#4b5563",
    fontSize: 12,
    marginTop: 4,
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
  backButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButtonText: {
    color: "#1DA1F2",
    fontSize: 16,
  },
});
