import { Image } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurOverlay } from "../../../components/BlurOverlay";
import {fontSize} from '../../../utils/typography';

export interface AltTextModalProps {
  visible: boolean;
  onClose: () => void;
  imageUri: string | undefined;
  initialAltText: string;
  onSave: (altText: string) => void;
  onGenerateAltText: () => Promise<string>;
  colors: any;
}

function AltTextModalInner({
  visible,
  onClose,
  imageUri,
  initialAltText,
  onSave,
  onGenerateAltText,
  colors,
}: AltTextModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 768;
  const [tempAltText, setTempAltText] = useState(initialAltText);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync tempAltText when modal opens with new initialAltText
  React.useEffect(() => {
    if (visible) {
      setTempAltText(initialAltText);
    }
  }, [visible, initialAltText]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedText = await onGenerateAltText();
      setTempAltText(generatedText);
    } catch {
      // Error handling is done in the parent
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onSave(tempAltText);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <BlurOverlay intensity={25} />
        <View
          style={[styles.modalContent, { backgroundColor: colors.background }, isWideScreen && { maxWidth: 600, alignSelf: 'center' as const, borderRadius: 20 }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add Alt Text
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={[
                  styles.modalCloseButton,
                  { color: colors.textSecondary },
                ]}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={[styles.modalDescription, { color: colors.textSecondary }]}
          >
            Describe this image for people who are blind or have low vision.
          </Text>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.modalImage,
                { backgroundColor: colors.surfaceElevated },
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
          <TouchableOpacity
            style={[
              styles.generateAltTextButton,
              { backgroundColor: colors.surfaceElevated },
              isGenerating && styles.generateAltTextButtonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.generateButtonSpinner}
                />
                <Text
                  style={[
                    styles.generateAltTextButtonText,
                    { color: colors.text },
                  ]}
                >
                  Generating...
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.generateAltTextButtonText,
                  { color: colors.text },
                ]}
              >
                ✨ Generate with AI
              </Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={[
              styles.altTextInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.surfaceElevated,
                color: colors.text,
              },
            ]}
            placeholder="Describe this image..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={tempAltText}
            onChangeText={setTempAltText}
            maxLength={1000}
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.saveAltTextButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleSave}
          >
            <Text
              style={[styles.saveAltTextButtonText, { color: colors.text }]}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: fontSize.headline,
    fontWeight: "600",
  },
  modalCloseButton: {
    fontSize: fontSize.largeTitle,
    lineHeight: 32,
  },
  modalDescription: {
    fontSize: fontSize.subheadline,
    marginBottom: 12,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: "contain",
  },
  generateAltTextButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexDirection: "row",
  },
  generateAltTextButtonDisabled: {
    opacity: 0.6,
  },
  generateAltTextButtonText: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
  generateButtonSpinner: {
    marginRight: 8,
  },
  altTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: fontSize.callout,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  saveAltTextButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveAltTextButtonText: {
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
});

export const AltTextModal = React.memo(AltTextModalInner);
