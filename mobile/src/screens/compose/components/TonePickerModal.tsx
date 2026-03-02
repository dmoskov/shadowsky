import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { BlurOverlay } from "../../../components/BlurOverlay";
import { CloseIcon, CheckIcon } from "../../../components/icons";
import type { ToneOption } from "../../../services/ai-service";

interface ToneOptionConfig {
  value: ToneOption;
  label: string;
  description: string;
  icon: string;
}

const TONE_OPTIONS: ToneOptionConfig[] = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal and business-like",
    icon: "\uD83D\uDCBC",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Relaxed and friendly",
    icon: "\uD83D\uDE0A",
  },
  {
    value: "humorous",
    label: "Humorous",
    description: "Witty and playful",
    icon: "\uD83D\uDE04",
  },
  {
    value: "informative",
    label: "Informative",
    description: "Educational and clear",
    icon: "\uD83D\uDCDA",
  },
  {
    value: "inspirational",
    label: "Inspirational",
    description: "Motivating and uplifting",
    icon: "\u2728",
  },
];

export interface TonePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTone: (tone: ToneOption) => void;
  isAdjusting: boolean;
  selectedTone: ToneOption | null;
  previewText: string | null;
  originalText: string;
  onApplyTone: () => void;
  onCancelPreview: () => void;
}

export function TonePickerModal({
  visible,
  onClose,
  onSelectTone,
  isAdjusting,
  selectedTone,
  previewText,
  originalText,
  onApplyTone,
  onCancelPreview,
}: TonePickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showPreview = previewText !== null;

  if (showPreview) {
    const toneConfig = TONE_OPTIONS.find((t) => t.value === selectedTone);
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onCancelPreview}
      >
        <View style={styles.overlay}>
          <BlurOverlay intensity={25} />
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {toneConfig?.icon} {toneConfig?.label} Tone
              </Text>
              <TouchableOpacity onPress={onCancelPreview} hitSlop={8}>
                <CloseIcon size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewScroll} bounces={false}>
              <Text style={styles.previewLabel}>Original:</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>{originalText}</Text>
              </View>

              <Text style={styles.previewLabel}>Adjusted:</Text>
              <View style={[styles.previewBox, styles.previewBoxHighlight]}>
                <Text style={styles.previewText}>{previewText}</Text>
              </View>
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancelPreview}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={onApplyTone}
              >
                <CheckIcon size={16} color={colors.text} />
                <Text style={styles.applyButtonText}>Use This Version</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurOverlay intensity={25} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose a Tone</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <CloseIcon size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {TONE_OPTIONS.map((option) => {
            const isSelected = isAdjusting && selectedTone === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  isAdjusting && styles.optionRowDisabled,
                ]}
                activeOpacity={0.7}
                onPress={() => onSelectTone(option.value)}
                disabled={isAdjusting}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>
                {isSelected && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    content: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      maxHeight: "80%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      marginBottom: 8,
    },
    optionRowDisabled: {
      opacity: 0.5,
    },
    optionIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    optionText: {
      flex: 1,
    },
    optionLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    optionDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    // Preview styles
    previewScroll: {
      maxHeight: 300,
      marginBottom: 16,
    },
    previewLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 6,
      marginTop: 8,
    },
    previewBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 12,
    },
    previewBoxHighlight: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    previewText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    previewActions: {
      flexDirection: "row",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    applyButton: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    applyButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
