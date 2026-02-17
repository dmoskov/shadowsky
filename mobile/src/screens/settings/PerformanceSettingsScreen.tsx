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

interface PerformanceSettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function PerformanceSettingsScreen({
  navigation,
}: PerformanceSettingsScreenProps) {
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
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Optimize app performance and data usage
        </Text>

        {/* Data Usage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Usage</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingName}>Auto-play Videos</Text>
            <View style={styles.optionButtons}>
              {([
                { label: "Always", value: "always" as const },
                { label: "Wi-Fi Only", value: "wifi" as const },
                { label: "Never", value: "never" as const },
              ]).map((option) => {
                const isSelected = preferences.autoPlayVideos === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      updatePreference("autoPlayVideos", option.value)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        isSelected && styles.optionButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingName}>Image Quality</Text>
            <View style={styles.optionButtons}>
              {([
                { label: "High", value: "high" as const },
                { label: "Medium", value: "medium" as const },
                { label: "Low", value: "low" as const },
              ]).map((option) => {
                const isSelected = preferences.imageQuality === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      updatePreference("imageQuality", option.value)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        isSelected && styles.optionButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Background Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background Activity</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Background Fetch</Text>
                <Text style={styles.settingDescription}>
                  Pre-load content when app is in background
                </Text>
              </View>
              <Switch
                value={preferences.backgroundFetchEnabled}
                onValueChange={(value) =>
                  updatePreference("backgroundFetchEnabled", value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>
                  Pre-generate Thread Summaries
                </Text>
                <Text style={styles.settingDescription}>
                  Cache AI summaries for bookmarked threads
                </Text>
              </View>
              <Switch
                value={preferences.enableThreadSummaryPreGen}
                onValueChange={(value) =>
                  updatePreference("enableThreadSummaryPreGen", value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        </View>

        {/* Performance Tips */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Reducing image quality and disabling video autoplay can help save
            data and improve performance on slower connections.
          </Text>
          <Text style={[styles.infoText, { marginTop: 8 }]}>
            Background fetch helps content load faster when you open the app.
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
      marginBottom: 12,
    },
    settingCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surface,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    settingInfo: {
      flex: 1,
      marginRight: 12,
    },
    settingName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    optionButtons: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
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
      color: "#ffffff",
    },
    infoBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.surface,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
