import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { BlurOverlay } from "./BlurOverlay";
import { appealLabel } from "../services/atproto/labelers";
import { fontSize } from "../utils/typography";

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
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 768;
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
    } catch (error) {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <BlurOverlay intensity={25} />
        <View style={[styles.container, isWideScreen && { maxWidth: 600, alignSelf: 'center' as const, borderRadius: 20 }]}>
          {isSubmitted ? (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Appeal Submitted</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.content}>
                <Text style={styles.successText}>
                  Your appeal has been submitted to{" "}
                  {labelerName || "the labeler"}. They will review your appeal
                  and may remove or modify the label.
                </Text>
              </View>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleClose}
                >
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Appeal Label</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.content}>
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
              </View>
              <View style={styles.footer}>
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
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit Appeal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "80%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSize.headline,
      fontWeight: "600",
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: fontSize.title2,
      color: colors.textSecondary,
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    successText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    inputLabel: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: fontSize.subheadline,
      color: colors.text,
      minHeight: 100,
      backgroundColor: colors.surface,
    },
    charCount: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      textAlign: "right",
      marginTop: 4,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      minWidth: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}

export const AppealLabelModal = React.memo(AppealLabelModalInner);
