import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { usePreferences } from "../../contexts/PreferencesContext";
import { ChevronLeft } from "lucide-react-native";

interface NotificationPreferencesScreenProps {
  navigation: {
    goBack: () => void;
  };
}

const NOTIFICATION_TOGGLES: Array<{
  key: "notifyOnLikes" | "notifyOnReplies" | "notifyOnFollows" | "notifyOnMentions" | "notifyOnQuotes";
  label: string;
  description: string;
}> = [
  {
    key: "notifyOnLikes",
    label: "Likes",
    description: "When someone likes your posts",
  },
  {
    key: "notifyOnReplies",
    label: "Replies",
    description: "When someone replies to your posts",
  },
  {
    key: "notifyOnFollows",
    label: "Follows",
    description: "When someone follows you",
  },
  {
    key: "notifyOnMentions",
    label: "Mentions",
    description: "When someone mentions you in a post",
  },
  {
    key: "notifyOnQuotes",
    label: "Quotes",
    description: "When someone quotes your posts",
  },
];

export function NotificationPreferencesScreen({
  navigation,
}: NotificationPreferencesScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preferences, updatePreference } = usePreferences();

  if (!preferences) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Choose which notifications you want to receive and how
        </Text>

        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Enable Notifications</Text>
          </View>
          <Switch
            value={preferences.notificationsEnabled}
            onValueChange={(value) =>
              updatePreference("notificationsEnabled", value)
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        {preferences.notificationsEnabled && (
          <View style={styles.category}>
            <Text style={styles.categoryTitle}>Notification Types</Text>

            {NOTIFICATION_TOGGLES.map(({ key, label, description }) => (
              <View key={key} style={styles.toggleCard}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Text style={styles.toggleDescription}>{description}</Text>
                </View>
                <Switch
                  value={preferences[key]}
                  onValueChange={(value) => updatePreference(key, value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    backButton: {
      padding: 4,
      width: 60,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    headerSpacer: {
      width: 60,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    category: {
      marginBottom: 24,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    toggleCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleInfo: {
      flex: 1,
      marginRight: 12,
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    toggleDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}
