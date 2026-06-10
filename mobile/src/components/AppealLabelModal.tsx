import React, { useState, useMemo } from "react";
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ThemeColors, useTheme } from "../contexts/ThemeContext";
import { AppModal } from "./ui/AppModal";
import { appealLabel } from "../services/atproto/labelers";
import { fontSize } from "../utils/typography";
import { borderRadius } from "../constants/elevation";
import { fontWeights, spacing } from "../constants/spacing";

interface AppealLabelModalProps {
  visible: boolean;
  onClose: () => void;
  subjectUri: string;
  subjectCid?: string;
  labelerDid: string;
  labelVal: string;
  labelerName?: string;
  onAppealSubmitted?: () => void;
}

function AppealLabelModalInner({
  visible,
  onClose,
  subjectUri,
  subjectCid,
  labelerDid,
  labelVal,
  labelerName,
  onAppealSubmitted,
}: AppealLabelModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert("Required", "Please provide a reason for your appeal.");
      return;
    }

    setIsSubmitting(true);
    try {
      await appealLabel({
        subjectUri,
        subjectCid,
        labelerDid,
        labelVal,
        reason: reason.trim(),
      });
      setIsSubmitted(true);
      onAppealSubmitted?.();
    } catch {
      Alert.alert(
        "Error",
        "Failed to submit appeal. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setIsSubmitting(false);
    setIsSubmitted(false);
    onClose();
  };

  const displayLabel =
    labelVal.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  const footer = isSubmitted ? (
    <TouchableOpacity
      style={[styles.button, styles.primaryButton]}
      onPress={handleClose}
    >
      <Text style={styles.primaryButtonText}>Done</Text>
    </TouchableOpacity>
  ) : (
    <>
      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={handleClose}
        disabled={isSubmitting}
      >
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          styles.primaryButton,
          (!reason.trim() || isSubmitting) && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!reason.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Submit Appeal</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title={isSubmitted ? "Appeal Submitted" : "Appeal Label"}
      maxHeight="80%"
      footer={footer}
    >
      {isSubmitted ? (
        <Text style={styles.successText}>
          Your appeal has been submitted to{" "}
          {labelerName || "the labeler"}. They will review your appeal
          and may remove or modify the label.
        </Text>
      ) : (
        <>
          <Text style={styles.description}>
            You are appealing the &ldquo;{displayLabel}&rdquo; label
            {labelerName ? ` applied by ${labelerName}` : ""}.
            Please explain why you believe this label is incorrect.
          </Text>
          <Text style={styles.inputLabel}>Reason for appeal</Text>
          <TextInput
            style={styles.textInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why this label should be removed or changed..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reason.length}/500</Text>
        </>
      )}
    </AppModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    description: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    successText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    inputLabel: {
      fontSize: fontSize.subheadline,
      fontWeight: fontWeights.semibold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      padding: spacing.md,
      fontSize: fontSize.subheadline,
      color: colors.text,
      minHeight: 100,
      backgroundColor: colors.surfaceAlt,
    },
    charCount: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      textAlign: "right",
      marginTop: spacing.xs,
    },
    button: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: borderRadius.medium,
      minWidth: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButton: {
      backgroundColor: colors.surfaceAlt,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: fontWeights.semibold,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: fontSize.subheadline,
      fontWeight: fontWeights.semibold,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}

export const AppealLabelModal = React.memo(AppealLabelModalInner);
