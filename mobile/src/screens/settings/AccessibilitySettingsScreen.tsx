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
import { ChevronLeftIcon } from '../../components/icons';
import {fontSize} from '../../utils/typography';

interface AccessibilitySettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function AccessibilitySettingsScreen({
  navigation,
}: AccessibilitySettingsScreenProps) {
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
        <Text style={styles.headerTitle}>Accessibility</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.description}>
          Customize accessibility settings to improve your experience
        </Text>

        {/* Display Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>High Contrast Mode</Text>
                <Text style={styles.settingDescription}>
                  Increases color contrast for better readability
                </Text>
              </View>
              <Switch
                value={preferences.highContrast}
                onValueChange={(value) => updatePreference("highContrast", value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Large Text</Text>
                <Text style={styles.settingDescription}>
                  Use larger text throughout the app
                </Text>
              </View>
              <Switch
                value={preferences.largeText}
                onValueChange={(value) => updatePreference("largeText", value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Screen Reader Optimized</Text>
                <Text style={styles.settingDescription}>
                  Optimize layout for screen readers
                </Text>
              </View>
              <Switch
                value={preferences.screenReaderOptimized}
                onValueChange={(value) =>
                  updatePreference("screenReaderOptimized", value)
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        </View>

        {/* Motion & Animations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motion & Animations</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingDescription}>
              Control how animations and transitions appear
            </Text>
            <View style={styles.optionButtons}>
              {([
                { label: "System", value: "system" as const },
                { label: "Normal", value: "off" as const },
                { label: "Reduced", value: "on" as const },
              ]).map((option) => {
                const isSelected = preferences.reduceMotion === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() => updatePreference("reduceMotion", option.value)}
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

        {/* Video Autoplay Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Autoplay</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingDescription}>
              Control when videos auto-play in feeds
            </Text>
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
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Accessibility settings are applied immediately and saved to your
            device.
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
      fontSize: fontSize.headline,
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
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: fontSize.callout,
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
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: fontSize.footnote,
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
      fontSize: fontSize.footnote,
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
      fontSize: fontSize.footnote,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
