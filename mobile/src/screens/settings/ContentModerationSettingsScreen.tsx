import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useModeration, LabelType, LabelPreference } from "../../contexts/ModerationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ChevronLeft } from "lucide-react-native";


import { createLogger } from '../../utils/logger';

const logger = createLogger('ContentModerationSettingsScreen');
interface ContentModerationSettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

const LABEL_DEFINITIONS: Record<
  LabelType,
  { name: string; description: string; category: string }
> = {
  porn: {
    name: "Adult Content",
    description: "Explicit sexual content",
    category: "Adult Content",
  },
  sexual: {
    name: "Sexually Suggestive",
    description: "Suggestive but not explicit",
    category: "Adult Content",
  },
  nudity: {
    name: "Nudity",
    description: "Non-sexual nudity",
    category: "Adult Content",
  },
  "graphic-media": {
    name: "Graphic Media",
    description: "Graphic violence or disturbing imagery",
    category: "Violent Content",
  },
  gore: {
    name: "Gore",
    description: "Graphic depictions of violence or injury",
    category: "Violent Content",
  },
  nsfl: {
    name: "NSFL",
    description: "Not safe for life content",
    category: "Violent Content",
  },
  spam: {
    name: "Spam",
    description: "Spam or misleading content",
    category: "Other",
  },
  impersonation: {
    name: "Impersonation",
    description: "Account impersonating someone else",
    category: "Other",
  },
  scam: {
    name: "Scam",
    description: "Potential scam or fraudulent content",
    category: "Other",
  },
  misleading: {
    name: "Misleading",
    description: "Potentially misleading information",
    category: "Other",
  },
};

const PREFERENCE_OPTIONS: Array<{
  value: LabelPreference;
  label: string;
  description: string;
}> = [
  {
    value: "show",
    label: "Show",
    description: "Always show this content",
  },
  {
    value: "warn",
    label: "Warn",
    description: "Show with warning overlay",
  },
  {
    value: "hide",
    label: "Hide",
    description: "Never show this content",
  },
];

export function ContentModerationSettingsScreen({
  navigation,
}: ContentModerationSettingsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    contentFilterPreferences,
    setContentFilterPreference,
    resetContentFilterPreferences,
  } = useModeration();

  const handlePreferenceChange = async (
    labelType: LabelType,
    preference: LabelPreference,
  ) => {
    try {
      await setContentFilterPreference(labelType, preference);
    } catch (error) {
      logger.error('Failed to update preference:', error);
    }
  };

  const handleResetAll = async () => {
    try {
      await resetContentFilterPreferences();
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
    }
  };

  // Group labels by category
  const groupedLabels = Object.entries(LABEL_DEFINITIONS).reduce(
    (acc, [labelType, def]) => {
      const category = def.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ labelType: labelType as LabelType, ...def });
      return acc;
    },
    {} as Record<
      string,
      Array<{ labelType: LabelType; name: string; description: string }>
    >,
  );

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
        <Text style={styles.headerTitle}>Content Moderation</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetAll}
          accessibilityRole="button"
          accessibilityLabel="Reset to defaults"
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Control how labeled content is displayed. These settings apply to all
          posts in your feeds.
        </Text>

        {Object.entries(groupedLabels).map(([category, labels]) => (
          <View key={category} style={styles.category}>
            <Text style={styles.categoryTitle}>{category}</Text>

            {labels.map(({ labelType, name, description }) => (
              <View key={labelType} style={styles.labelCard}>
                <View style={styles.labelInfo}>
                  <Text style={styles.labelName}>{name}</Text>
                  <Text style={styles.labelDescription}>{description}</Text>
                </View>

                <View style={styles.preferenceButtons}>
                  {PREFERENCE_OPTIONS.map((option) => {
                    const isSelected =
                      contentFilterPreferences[labelType] === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.preferenceButton,
                          isSelected && styles.preferenceButtonSelected,
                        ]}
                        onPress={() =>
                          handlePreferenceChange(labelType, option.value)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${option.label}: ${option.description}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.preferenceButtonText,
                            isSelected && styles.preferenceButtonTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.infoBold}>Show</Text>: Content appears
            normally without warnings
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.infoBold}>Warn</Text>: Content is hidden
            behind a warning overlay that you can tap to reveal
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.infoBold}>Hide</Text>: Content is completely
            hidden from your feeds
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
  resetButton: {
    padding: 4,
    width: 60,
    alignItems: "flex-end",
  },
  resetButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
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
  labelCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  labelInfo: {
    marginBottom: 12,
  },
  labelName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  labelDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  preferenceButtons: {
    flexDirection: "row",
    gap: 8,
  },
  preferenceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    alignItems: "center",
  },
  preferenceButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  preferenceButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  preferenceButtonTextSelected: {
    color: colors.text,
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
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  infoBold: {
    fontWeight: "600",
    color: colors.text,
  },
  });
}
