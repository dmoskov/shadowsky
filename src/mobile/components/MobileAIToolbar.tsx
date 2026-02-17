/**
 * MobileAIToolbar - Compact AI features toolbar for mobile composer
 *
 * Provides tone adjustment, writing feedback, and suggestions in a
 * mobile-friendly bottom sheet / action sheet pattern using React Native
 * Modal, Pressable, and ScrollView primitives.
 */

import { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  TONE_OPTIONS,
  type ToneOptionConfig,
} from "../../components/composer/types";
import type {
  StyleMatchedWritingFeedback,
  ToneOption,
} from "../../services/anthropic";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../hooks/useDynamicType";

// ─── Props ───────────────────────────────────────────────────────────

export interface MobileAIToolbarProps {
  /** Current composer text */
  text: string;

  // Tone adjustment
  showToneOptions: boolean;
  selectedTone: ToneOption | null;
  isAdjustingTone: boolean;
  tonePreview: string | null;
  showTonePreview: boolean;
  onToggleToneOptions: () => void;
  onToneAdjustment: (tone: ToneOption, text: string) => Promise<void>;
  onApplyTone: () => string | null;
  onCancelTone: () => void;

  // Writing feedback
  writingFeedback: StyleMatchedWritingFeedback | null;
  isLoadingFeedback: boolean;
  showWritingFeedback: boolean;
  onRequestFeedback: (text: string) => Promise<void>;
  onCloseFeedback: () => void;
  onApplyCorrected: () => string | null;
  onApplyEnhanced: () => string | null;

  /** Called when the user applies text from AI (tone or feedback) */
  onApplyText: (text: string) => void;

  // Error state
  error: string | null;
  clearError: () => void;
}

// ─── Styles ──────────────────────────────────────────────────────────

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    // Toolbar row
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    } as ViewStyle,
    toolbarButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#f0f0f0",
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 6,
      minHeight: 44,
    } as ViewStyle,
    toolbarButtonActive: {
      backgroundColor: "#e0e7ff",
    } as ViewStyle,
    toolbarButtonDisabled: {
      opacity: 0.5,
    } as ViewStyle,
    toolbarButtonText: {
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 20),
      fontWeight: "600",
      color: "#374151",
    } as TextStyle,
    toolbarIcon: {
      fontSize: scaledFont(16),
    } as TextStyle,

    // Modal overlay
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.4)",
    } as ViewStyle,
    sheet: {
      backgroundColor: "#ffffff",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
      paddingBottom: 34, // Safe area
    } as ViewStyle,
    sheetHandle: {
      width: 36,
      height: 5,
      backgroundColor: "#d1d5db",
      borderRadius: 3,
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 4,
    } as ViewStyle,
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e5e7eb",
    } as ViewStyle,
    sheetTitle: {
      fontSize: scaledFont(18),
      lineHeight: scaledLineHeight(scaledFont, 18, 24),
      fontWeight: "700",
      color: "#111827",
    } as TextStyle,
    sheetCloseText: {
      fontSize: scaledFont(16),
      color: "#6b7280",
      minHeight: 44,
      paddingVertical: 10,
    } as TextStyle,
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 12,
    } as ViewStyle,

    // Tone option card
    toneCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#f9fafb",
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      minHeight: 44,
    } as ViewStyle,
    toneCardPressed: {
      backgroundColor: "#e0e7ff",
      borderColor: "#818cf8",
    } as ViewStyle,
    toneIcon: {
      fontSize: scaledFont(24),
      marginRight: 12,
    } as TextStyle,
    toneLabel: {
      fontSize: scaledFont(16),
      lineHeight: scaledLineHeight(scaledFont, 16, 22),
      fontWeight: "600",
      color: "#111827",
    } as TextStyle,
    toneDesc: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      color: "#6b7280",
    } as TextStyle,
    toneSpinner: {
      marginLeft: "auto",
    } as ViewStyle,

    // Tone preview
    previewSection: {
      marginBottom: 16,
    } as ViewStyle,
    previewLabel: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      fontWeight: "600",
      color: "#6b7280",
      marginBottom: 6,
    } as TextStyle,
    previewBox: {
      backgroundColor: "#f9fafb",
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: "#e5e7eb",
    } as ViewStyle,
    previewBoxHighlighted: {
      borderColor: "#818cf8",
      borderWidth: 2,
    } as ViewStyle,
    previewText: {
      fontSize: scaledFont(15),
      lineHeight: scaledLineHeight(scaledFont, 15, 22),
      color: "#111827",
    } as TextStyle,
    actionRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
    } as ViewStyle,
    actionButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      paddingVertical: 12,
      minHeight: 44,
    } as ViewStyle,
    primaryButton: {
      backgroundColor: "#4f46e5",
    } as ViewStyle,
    secondaryButton: {
      backgroundColor: "#f3f4f6",
    } as ViewStyle,
    primaryButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "700",
      color: "#ffffff",
    } as TextStyle,
    secondaryButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#374151",
    } as TextStyle,

    // Feedback sections
    assessmentGood: {
      backgroundColor: "#ecfdf5",
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#6ee7b7",
    } as ViewStyle,
    assessmentIssues: {
      backgroundColor: "#fffbeb",
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#fcd34d",
    } as ViewStyle,
    assessmentText: {
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 20),
      color: "#111827",
    } as TextStyle,
    feedbackVersionCard: {
      backgroundColor: "#f9fafb",
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#e5e7eb",
    } as ViewStyle,
    feedbackVersionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    } as ViewStyle,
    feedbackVersionTitle: {
      fontSize: scaledFont(15),
      lineHeight: scaledLineHeight(scaledFont, 15, 20),
      fontWeight: "700",
      color: "#111827",
    } as TextStyle,
    feedbackUseButton: {
      backgroundColor: "#4f46e5",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 34,
      justifyContent: "center",
    } as ViewStyle,
    feedbackUseButtonText: {
      fontSize: scaledFont(13),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
    changeItem: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      color: "#6b7280",
      marginTop: 4,
    } as TextStyle,

    // Error banner
    errorBanner: {
      backgroundColor: "#fef2f2",
      borderRadius: 8,
      padding: 12,
      marginHorizontal: 12,
      marginBottom: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    } as ViewStyle,
    errorText: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      color: "#991b1b",
      flex: 1,
    } as TextStyle,
    errorDismiss: {
      fontSize: scaledFont(13),
      color: "#991b1b",
      fontWeight: "700",
      paddingLeft: 12,
      minHeight: 44,
      paddingVertical: 12,
    } as TextStyle,
  });
}

// ─── Sub-components ──────────────────────────────────────────────────

interface ToneOptionsSheetProps {
  visible: boolean;
  isAdjustingTone: boolean;
  selectedTone: ToneOption | null;
  onSelectTone: (tone: ToneOption) => void;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
}

const ToneOptionsSheet = memo<ToneOptionsSheetProps>(
  ({
    visible,
    isAdjustingTone,
    selectedTone,
    onSelectTone,
    onClose,
    styles,
  }) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose a Tone</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.sheetCloseText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody}>
            {TONE_OPTIONS.map((option: ToneOptionConfig) => (
              <ToneOptionRow
                key={option.value}
                option={option}
                isLoading={isAdjustingTone && selectedTone === option.value}
                disabled={isAdjustingTone}
                onSelect={onSelectTone}
                styles={styles}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  ),
);
ToneOptionsSheet.displayName = "ToneOptionsSheet";

interface ToneOptionRowProps {
  option: ToneOptionConfig;
  isLoading: boolean;
  disabled: boolean;
  onSelect: (tone: ToneOption) => void;
  styles: ReturnType<typeof createStyles>;
}

const ToneOptionRow = memo<ToneOptionRowProps>(
  ({ option, isLoading, disabled, onSelect, styles }) => {
    const handlePress = useCallback(
      () => onSelect(option.value),
      [onSelect, option.value],
    );

    return (
      <Pressable
        style={({ pressed }) => [
          styles.toneCard,
          pressed && styles.toneCardPressed,
          disabled && styles.toolbarButtonDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${option.label}: ${option.description}`}
      >
        <Text style={styles.toneIcon}>{option.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.toneLabel}>{option.label}</Text>
          <Text style={styles.toneDesc}>{option.description}</Text>
        </View>
        {isLoading && (
          <ActivityIndicator
            size="small"
            color="#4f46e5"
            style={styles.toneSpinner}
          />
        )}
      </Pressable>
    );
  },
);
ToneOptionRow.displayName = "ToneOptionRow";

interface TonePreviewSheetProps {
  visible: boolean;
  originalText: string;
  adjustedText: string;
  selectedTone: ToneOption | null;
  onApply: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof createStyles>;
}

const TonePreviewSheet = memo<TonePreviewSheetProps>(
  ({
    visible,
    originalText,
    adjustedText,
    selectedTone,
    onApply,
    onCancel,
    styles,
  }) => {
    const toneConfig = TONE_OPTIONS.find((t) => t.value === selectedTone);

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onCancel}
      >
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {toneConfig?.icon} {toneConfig?.label ?? "Adjusted"}
              </Text>
              <Pressable onPress={onCancel} hitSlop={12}>
                <Text style={styles.sheetCloseText}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.sheetBody}>
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Original</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{originalText}</Text>
                </View>
              </View>
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Adjusted</Text>
                <View style={[styles.previewBox, styles.previewBoxHighlighted]}>
                  <Text style={styles.previewText}>{adjustedText}</Text>
                </View>
              </View>
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onApply}
                accessibilityRole="button"
                accessibilityLabel="Use this version"
              >
                <Text style={styles.primaryButtonText}>Use This</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
TonePreviewSheet.displayName = "TonePreviewSheet";

interface WritingFeedbackSheetProps {
  visible: boolean;
  originalText: string;
  feedback: StyleMatchedWritingFeedback;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
}

const WritingFeedbackSheet = memo<WritingFeedbackSheetProps>(
  ({
    visible,
    originalText,
    feedback,
    onApplyCorrected,
    onApplyEnhanced,
    onClose,
    styles,
  }) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Writing Feedback</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.sheetCloseText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody}>
            {/* Assessment */}
            <View
              style={
                feedback.assessment.hasIssues
                  ? styles.assessmentIssues
                  : styles.assessmentGood
              }
            >
              <Text style={styles.assessmentText}>
                {feedback.assessment.hasIssues ? "\u26A0\uFE0F " : "\u2705 "}
                {feedback.assessment.summary}
              </Text>
            </View>

            {/* Original */}
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Original</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>{originalText}</Text>
              </View>
            </View>

            {/* Corrected Version */}
            <View style={styles.feedbackVersionCard}>
              <View style={styles.feedbackVersionHeader}>
                <Text style={styles.feedbackVersionTitle}>Corrected</Text>
                <Pressable
                  style={styles.feedbackUseButton}
                  onPress={onApplyCorrected}
                  accessibilityRole="button"
                  accessibilityLabel="Use corrected version"
                >
                  <Text style={styles.feedbackUseButtonText}>Use This</Text>
                </Pressable>
              </View>
              <Text style={styles.previewText}>
                {feedback.correctedVersion.text}
              </Text>
              {feedback.correctedVersion.changes.map((change, i) => (
                <Text
                  key={`corr-${i}-${change.slice(0, 15)}`}
                  style={styles.changeItem}
                >
                  {"\u2022"} {change}
                </Text>
              ))}
            </View>

            {/* Enhanced Version */}
            <View style={styles.feedbackVersionCard}>
              <View style={styles.feedbackVersionHeader}>
                <Text style={styles.feedbackVersionTitle}>Enhanced</Text>
                <Pressable
                  style={styles.feedbackUseButton}
                  onPress={onApplyEnhanced}
                  accessibilityRole="button"
                  accessibilityLabel="Use enhanced version"
                >
                  <Text style={styles.feedbackUseButtonText}>Use This</Text>
                </Pressable>
              </View>
              <Text style={styles.previewText}>
                {feedback.enhancedVersion.text}
              </Text>
              {feedback.enhancedVersion.improvements.map((imp, i) => (
                <Text
                  key={`enh-${i}-${imp.slice(0, 15)}`}
                  style={styles.changeItem}
                >
                  {"\u2022"} {imp}
                </Text>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  ),
);
WritingFeedbackSheet.displayName = "WritingFeedbackSheet";

// ─── Main Component ──────────────────────────────────────────────────

export const MobileAIToolbar = memo<MobileAIToolbarProps>(
  ({
    text,
    showToneOptions,
    selectedTone,
    isAdjustingTone,
    tonePreview,
    showTonePreview,
    onToggleToneOptions,
    onToneAdjustment,
    onApplyTone,
    onCancelTone,
    writingFeedback,
    isLoadingFeedback,
    showWritingFeedback,
    onRequestFeedback,
    onCloseFeedback,
    onApplyCorrected,
    onApplyEnhanced,
    onApplyText,
    error,
    clearError,
  }) => {
    const { scaledFont } = useDynamicType();
    const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

    const hasText = text.trim().length > 0;

    // Wrap tone selection to pass current text
    const handleToneSelect = useCallback(
      (tone: ToneOption) => {
        onToneAdjustment(tone, text);
      },
      [onToneAdjustment, text],
    );

    // Wrap apply tone to update parent text
    const handleApplyTone = useCallback(() => {
      const adjusted = onApplyTone();
      if (adjusted) onApplyText(adjusted);
    }, [onApplyTone, onApplyText]);

    // Wrap feedback request
    const handleRequestFeedback = useCallback(() => {
      onRequestFeedback(text);
    }, [onRequestFeedback, text]);

    // Wrap corrected apply
    const handleApplyCorrected = useCallback(() => {
      const corrected = onApplyCorrected();
      if (corrected) onApplyText(corrected);
    }, [onApplyCorrected, onApplyText]);

    // Wrap enhanced apply
    const handleApplyEnhanced = useCallback(() => {
      const enhanced = onApplyEnhanced();
      if (enhanced) onApplyText(enhanced);
    }, [onApplyEnhanced, onApplyText]);

    return (
      <View>
        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <Pressable onPress={clearError} hitSlop={8}>
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {/* Toolbar buttons */}
        <View style={styles.toolbar}>
          {/* Tone button */}
          <Pressable
            style={[
              styles.toolbarButton,
              selectedTone && styles.toolbarButtonActive,
              (isAdjustingTone || !hasText) && styles.toolbarButtonDisabled,
            ]}
            onPress={onToggleToneOptions}
            disabled={isAdjustingTone || !hasText}
            accessibilityRole="button"
            accessibilityLabel="Adjust tone"
          >
            <Text style={styles.toolbarIcon}>{"\uD83C\uDFA8"}</Text>
            <Text style={styles.toolbarButtonText}>Tone</Text>
            {isAdjustingTone && (
              <ActivityIndicator size="small" color="#4f46e5" />
            )}
          </Pressable>

          {/* Feedback button */}
          <Pressable
            style={[
              styles.toolbarButton,
              (isLoadingFeedback || !hasText) && styles.toolbarButtonDisabled,
            ]}
            onPress={handleRequestFeedback}
            disabled={isLoadingFeedback || !hasText}
            accessibilityRole="button"
            accessibilityLabel="Get writing feedback"
          >
            <Text style={styles.toolbarIcon}>{"\uD83D\uDCAC"}</Text>
            <Text style={styles.toolbarButtonText}>Feedback</Text>
            {isLoadingFeedback && (
              <ActivityIndicator size="small" color="#4f46e5" />
            )}
          </Pressable>
        </View>

        {/* Tone options sheet */}
        <ToneOptionsSheet
          visible={showToneOptions}
          isAdjustingTone={isAdjustingTone}
          selectedTone={selectedTone}
          onSelectTone={handleToneSelect}
          onClose={onToggleToneOptions}
          styles={styles}
        />

        {/* Tone preview sheet */}
        {showTonePreview && tonePreview != null && (
          <TonePreviewSheet
            visible={showTonePreview}
            originalText={text}
            adjustedText={tonePreview}
            selectedTone={selectedTone}
            onApply={handleApplyTone}
            onCancel={onCancelTone}
            styles={styles}
          />
        )}

        {/* Writing feedback sheet */}
        {showWritingFeedback && writingFeedback != null && (
          <WritingFeedbackSheet
            visible={showWritingFeedback}
            originalText={text}
            feedback={writingFeedback}
            onApplyCorrected={handleApplyCorrected}
            onApplyEnhanced={handleApplyEnhanced}
            onClose={onCloseFeedback}
            styles={styles}
          />
        )}
      </View>
    );
  },
);
MobileAIToolbar.displayName = "MobileAIToolbar";

export default MobileAIToolbar;
