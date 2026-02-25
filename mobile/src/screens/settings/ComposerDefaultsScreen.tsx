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
import { ChevronLeftIcon } from '../../../components/icons';

interface ComposerDefaultsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function ComposerDefaultsScreen({
  navigation,
}: ComposerDefaultsScreenProps) {
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
          <ChevronLeftIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Composer Defaults</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.description}>
          Configure your default posting experience
        </Text>

        {/* Thread Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thread Settings</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingName}>Numbering Format</Text>
            <View style={styles.optionButtons}>
              {([
                { label: "None", value: "none" as const },
                { label: "Simple (1/5)", value: "simple" as const },
                { label: "Brackets ([1/5])", value: "brackets" as const },
                { label: "Thread", value: "thread" as const },
                { label: "Dots", value: "dots" as const },
              ]).map((option) => {
                const isSelected =
                  preferences.threadNumberingFormat === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      updatePreference("threadNumberingFormat", option.value)
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
            <Text style={styles.settingName}>Numbering Position</Text>
            <View style={styles.optionButtons}>
              {([
                { label: "Beginning", value: "beginning" as const },
                { label: "End", value: "end" as const },
              ]).map((option) => {
                const isSelected =
                  preferences.threadNumberingPosition === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      updatePreference("threadNumberingPosition", option.value)
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
            <Text style={styles.settingName}>Post Delay</Text>
            <Text style={styles.settingDescription}>
              Seconds to wait before posting (0 for instant)
            </Text>
            <View style={styles.optionButtons}>
              {([
                { label: "0s", value: 0 },
                { label: "5s", value: 5 },
                { label: "10s", value: 10 },
                { label: "30s", value: 30 },
              ]).map((option) => {
                const isSelected =
                  preferences.postDelaySeconds === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      updatePreference("postDelaySeconds", option.value)
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

        {/* AI Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Features</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Auto-Generate Alt Text</Text>
                <Text style={styles.settingDescription}>
                  Automatically generate alt text for images using AI
                </Text>
              </View>
              <Switch
                value={preferences.autoGenerateAltText}
                onValueChange={(value) =>
                  updatePreference("autoGenerateAltText", value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Hashtag Suggestions</Text>
                <Text style={styles.settingDescription}>
                  Suggest relevant hashtags when composing posts
                </Text>
              </View>
              <Switch
                value={preferences.enableHashtagSuggestions}
                onValueChange={(value) =>
                  updatePreference("enableHashtagSuggestions", value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Default Post Language</Text>
              </View>
              <Text style={styles.languageValue}>
                {preferences.defaultPostLanguage}
              </Text>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Thread numbering and post delay settings apply when creating
            multi-post threads.
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
      flexWrap: "wrap",
      marginTop: 12,
    },
    optionButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
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
    languageValue: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
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
