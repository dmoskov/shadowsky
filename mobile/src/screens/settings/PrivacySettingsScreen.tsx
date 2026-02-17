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

interface PrivacySettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function PrivacySettingsScreen({
  navigation,
}: PrivacySettingsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preferences, updatePreference } = usePreferences();

  if (!preferences) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.description}>Loading preferences...</Text>
      </SafeAreaView>
    );
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
        <Text style={styles.headerTitle}>Privacy & Safety</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Control who can interact with you and your content
        </Text>

        {/* Profile Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Visibility</Text>
          <Text style={styles.sectionDescription}>
            Choose who can see your profile and posts
          </Text>
          <View style={styles.optionButtons}>
            {(["public", "followers", "private"] as const).map((option) => {
              const isSelected = preferences.profileVisibility === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => updatePreference("profileVisibility", option)}
                  accessibilityRole="button"
                  accessibilityLabel={`Profile visibility: ${option}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Who Can Message You */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who Can Message You</Text>
          <Text style={styles.sectionDescription}>
            Control who is allowed to send you direct messages
          </Text>
          <View style={styles.optionButtons}>
            {(["everyone", "followers", "none"] as const).map((option) => {
              const isSelected = preferences.allowMessages === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => updatePreference("allowMessages", option)}
                  accessibilityRole="button"
                  accessibilityLabel={`Allow messages from: ${option}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Who Can Mention You */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who Can Mention You</Text>
          <Text style={styles.sectionDescription}>
            Control who is allowed to mention you in their posts
          </Text>
          <View style={styles.optionButtons}>
            {(["everyone", "followers", "none"] as const).map((option) => {
              const isSelected = preferences.allowMentions === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => updatePreference("allowMentions", option)}
                  accessibilityRole="button"
                  accessibilityLabel={`Allow mentions from: ${option}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Hide from Search Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Hide from Search</Text>
            <Text style={styles.toggleDescription}>
              Prevent your profile from appearing in search results
            </Text>
          </View>
          <Switch
            value={preferences.hideFromSearch}
            onValueChange={(value) => updatePreference("hideFromSearch", value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Content Filtering Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Content Filtering</Text>
            <Text style={styles.toggleDescription}>
              Automatically hide potentially sensitive content
            </Text>
          </View>
          <Switch
            value={preferences.filterContent}
            onValueChange={(value) => updatePreference("filterContent", value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Note: Some privacy settings may not yet be available in the Bluesky
            API and will be stored locally.
          </Text>
        </View>
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    sectionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    optionButtons: {
      flexDirection: "row",
      gap: 8,
    },
    optionButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
      alignItems: "center",
    },
    optionButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    optionButtonTextSelected: {
      color: colors.text,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surface,
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
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
